import { waitUntil } from '@vercel/functions';
import {
  BATCH_SIZE,
  RECIPIENT_TABLE,
  getCampaign,
  updateCampaign,
  tryAcquireLock,
  extendLock,
  releaseLock,
  releaseExpiredLock,
  recoverStaleSendingRecipients,
  countActionableRecipients,
  refreshCampaignCounts,
  repairStuckCampaign,
  isTransientWorkerError,
  withDbRetry,
  nowIso,
} from '@/lib/mailing/campaign';
import {
  buildEmailHtml,
  createMailTransporter,
  sendOneEmail,
  sleep,
  SEND_DELAY_MS,
} from '@/lib/mailing/email';
import { isRecipientEligible } from '@/lib/mailing/recipients';
import { getSiteOrigin } from '@/lib/siteUrl';

const DEFAULT_LOOP_MAX_MS = 280_000;
export const CRON_LOOP_MAX_MS = 42_000;
const PROGRESS_REFRESH_INTERVAL = 25;
const MIN_RECIPIENT_TIME_REMAINING_MS = 10_000;
const LOCK_RETRY_DELAY_MS = 500;

function hasTimeForRecipient(deadlineAt) {
  return Date.now() + MIN_RECIPIENT_TIME_REMAINING_MS < deadlineAt;
}

export function scheduleCampaignWorker(admin, campaignId, { maxDurationMs = DEFAULT_LOOP_MAX_MS } = {}) {
  waitUntil(
    runCampaignWorkerLoop(admin, campaignId, { maxDurationMs }).catch((err) => {
      console.error(`[mailing/worker] loop failed for ${campaignId}:`, err.message || err);
    })
  );
}

export async function runCampaignWorkerLoop(admin, campaignId, { maxDurationMs = DEFAULT_LOOP_MAX_MS } = {}) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + maxDurationMs;
  let campaign = await getCampaign(admin, campaignId);
  if (!campaign) {
    return { ok: false, reason: 'not_found', needsContinuation: false, batchesRun: 0 };
  }

  campaign = await repairStuckCampaign(admin, campaign);
  await releaseExpiredLock(admin, campaignId);

  if (campaign.status === 'failed' && isTransientWorkerError({ message: campaign.error_message })) {
    const actionable = await countActionableRecipients(admin, campaignId);
    if (actionable > 0) {
      campaign = await updateCampaign(admin, campaignId, {
        status: 'running',
        error_message: null,
        locked_until: null,
      });
    }
  }

  if (campaign.status !== 'running') {
    return {
      ok: true,
      reason: 'not_running',
      status: campaign.status,
      needsContinuation: false,
      batchesRun: 0,
    };
  }

  let result = { needsContinuation: true };
  let batchesRun = 0;

  while (result.needsContinuation && hasTimeForRecipient(deadlineAt)) {
    await releaseExpiredLock(admin, campaignId);
    result = await processCampaignBatch(admin, campaignId, { deadlineAt });
    batchesRun += 1;

    if (!result.needsContinuation) break;

    if (result.reason === 'locked') {
      if (Date.now() + LOCK_RETRY_DELAY_MS >= deadlineAt) break;
      await sleep(LOCK_RETRY_DELAY_MS);
    }
  }

  const timedOut = result.needsContinuation && !hasTimeForRecipient(deadlineAt);
  if (timedOut) {
    console.info(
      `[mailing/worker] loop time budget reached for ${campaignId} after ${batchesRun} batches; cron will resume`
    );
  }

  return { ...result, batchesRun, timedOut };
}

async function fetchActionableBatch(admin, campaignId) {
  return withDbRetry(async () => {
    const { data: pending, error: e1 } = await admin
      .from(RECIPIENT_TABLE)
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (e1) throw e1;

    const remaining = BATCH_SIZE - (pending?.length || 0);
    let failed = [];
    if (remaining > 0) {
      const { data: failedRows, error: e2 } = await admin
        .from(RECIPIENT_TABLE)
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'failed')
        .order('updated_at', { ascending: true })
        .limit(remaining * 3);
      if (e2) throw e2;
      failed = (failedRows || [])
        .filter((r) => r.attempt_count < r.max_attempts)
        .slice(0, remaining);
    }

    return [...(pending || []), ...failed];
  });
}

export async function processCampaignBatch(admin, campaignId, { deadlineAt = Number.POSITIVE_INFINITY } = {}) {
  let campaign = await getCampaign(admin, campaignId);
  if (!campaign) {
    return { ok: false, reason: 'not_found', needsContinuation: false };
  }

  campaign = await repairStuckCampaign(admin, campaign);
  if (campaign.status !== 'running') {
    return { ok: true, reason: 'not_running', status: campaign.status, needsContinuation: false };
  }

  await releaseExpiredLock(admin, campaignId);
  campaign = await getCampaign(admin, campaignId);

  let locked = await tryAcquireLock(admin, campaign);
  if (!locked) {
    await releaseExpiredLock(admin, campaignId);
    campaign = await getCampaign(admin, campaignId);
    locked = await tryAcquireLock(admin, campaign);
  }
  if (!locked) {
    return { ok: true, reason: 'locked', needsContinuation: true };
  }

  try {
    await recoverStaleSendingRecipients(admin, campaignId);

    campaign = await getCampaign(admin, campaignId);
    if (campaign.status !== 'running') {
      await releaseLock(admin, campaignId);
      return { ok: true, reason: 'not_running', status: campaign.status, needsContinuation: false };
    }

    const recipients = await fetchActionableBatch(admin, campaignId);
    if (recipients.length === 0) {
      const actionable = await countActionableRecipients(admin, campaignId);
      if (actionable === 0) {
        await updateCampaign(admin, campaignId, {
          status: 'completed',
          completed_at: nowIso(),
          locked_until: null,
          error_message: null,
        });
        await refreshCampaignCounts(admin, campaignId);
        return { ok: true, reason: 'completed', sent: 0, failed: 0, needsContinuation: false };
      }
      await releaseLock(admin, campaignId);
      return { ok: true, reason: 'waiting_recovery', needsContinuation: true };
    }

    const transporter = createMailTransporter();
    let batchSent = 0;
    let batchFailed = 0;
    let batchProcessed = 0;
    let stoppedForBudget = false;
    const siteOrigin = getSiteOrigin();

    try {
      for (const recipient of recipients) {
        if (!hasTimeForRecipient(deadlineAt)) {
          stoppedForBudget = true;
          break;
        }

        campaign = await getCampaign(admin, campaignId);
        if (campaign.status !== 'running') break;

        const now = nowIso();
        await withDbRetry(() =>
          admin
            .from(RECIPIENT_TABLE)
            .update({ status: 'sending', updated_at: now })
            .eq('id', recipient.id)
            .in('status', ['pending', 'failed'])
        );

        const eligible = await isRecipientEligible(admin, {
          userId: recipient.user_id,
          audience: campaign.audience,
        });

        if (!eligible) {
          await withDbRetry(() =>
            admin
              .from(RECIPIENT_TABLE)
              .update({
                status: 'skipped',
                last_error: 'unsubscribed_or_inactive',
                updated_at: nowIso(),
              })
              .eq('id', recipient.id)
          );
          batchProcessed += 1;
          continue;
        }

        const unsubscribeLink =
          campaign.audience === 'optional'
            ? `${siteOrigin}/unsubscribe/${recipient.user_id}`
            : `${siteOrigin}/profile`;

        const html = buildEmailHtml(campaign.message, {
          unsubscribeLink,
          subject: campaign.subject,
        });

        try {
          await sendOneEmail(transporter, {
            to: recipient.email,
            subject: campaign.subject,
            html,
          });
          await withDbRetry(() =>
            admin
              .from(RECIPIENT_TABLE)
              .update({
                status: 'sent',
                sent_at: nowIso(),
                last_error: null,
                updated_at: nowIso(),
              })
              .eq('id', recipient.id)
          );
          batchSent += 1;
        } catch (mailErr) {
          const attemptCount = (recipient.attempt_count || 0) + 1;
          const exhausted = attemptCount >= recipient.max_attempts;
          await withDbRetry(() =>
            admin
              .from(RECIPIENT_TABLE)
              .update({
                status: exhausted ? 'failed' : 'pending',
                attempt_count: attemptCount,
                last_error: mailErr.message || '발송 실패',
                updated_at: nowIso(),
              })
              .eq('id', recipient.id)
          );
          batchFailed += 1;
          console.error(`[mailing/worker] send failed ${recipient.email}:`, mailErr.message);
        }
        batchProcessed += 1;

        if (batchProcessed % PROGRESS_REFRESH_INTERVAL === 0) {
          await refreshCampaignCounts(admin, campaignId);
          await extendLock(admin, campaignId);
        }

        if (SEND_DELAY_MS > 0) {
          if (Date.now() + SEND_DELAY_MS + MIN_RECIPIENT_TIME_REMAINING_MS >= deadlineAt) {
            stoppedForBudget = true;
            break;
          }
          await sleep(SEND_DELAY_MS);
        }
      }
    } finally {
      transporter.close();
    }

    await refreshCampaignCounts(admin, campaignId);
    await releaseLock(admin, campaignId);

    campaign = await getCampaign(admin, campaignId);
    if (campaign.status === 'running') {
      if (stoppedForBudget) {
        return {
          ok: true,
          reason: 'time_budget',
          sent: batchSent,
          failed: batchFailed,
          needsContinuation: true,
        };
      }

      const actionable = await countActionableRecipients(admin, campaignId);
      if (actionable === 0) {
        await updateCampaign(admin, campaignId, {
          status: 'completed',
          completed_at: nowIso(),
          error_message: null,
        });
        return {
          ok: true,
          reason: 'completed',
          sent: batchSent,
          failed: batchFailed,
          needsContinuation: false,
        };
      }
      return {
        ok: true,
        reason: 'batch_done',
        sent: batchSent,
        failed: batchFailed,
        needsContinuation: true,
      };
    }

    return {
      ok: true,
      reason: 'batch_done',
      sent: batchSent,
      failed: batchFailed,
      needsContinuation: false,
    };
  } catch (err) {
    await releaseLock(admin, campaignId);

    if (isTransientWorkerError(err)) {
      console.error(`[mailing/worker] transient error for ${campaignId}, will retry:`, err.message || err);
      return { ok: true, reason: 'transient_error', needsContinuation: true };
    }

    await updateCampaign(admin, campaignId, {
      status: 'failed',
      error_message: err.message || '워커 처리 중 오류',
      completed_at: nowIso(),
    });
    throw err;
  }
}

export { DEFAULT_LOOP_MAX_MS };
