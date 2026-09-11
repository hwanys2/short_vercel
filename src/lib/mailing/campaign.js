export const CAMPAIGN_TABLE = 'mailing_campaigns';
export const RECIPIENT_TABLE = 'mailing_recipients';
export const BATCH_SIZE = 100;
export const LOCK_DURATION_MS = 90 * 1000;
export const STALE_SENDING_MS = 5 * 60 * 1000;

const RECIPIENT_COUNT_STATUSES = ['sent', 'failed', 'skipped', 'pending', 'sending'];
const ACTIVE_CAMPAIGN_STATUSES = new Set(['preparing', 'queued', 'running']);

export const AUDIENCE_LABELS = {
  system: '필수안내',
  optional: '메일수신동의',
};

export function nowIso() {
  return new Date().toISOString();
}

export function isTransientWorkerError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || err?.cause?.code || '').toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('enotfound') ||
    code === 'econnreset' ||
    code === 'etimedout'
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withDbRetry(fn, { retries = 2, delayMs = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientWorkerError(err) || attempt === retries) throw err;
      await sleep(delayMs * 2 ** attempt);
    }
  }
  throw lastErr;
}

export async function getCampaign(admin, campaignId) {
  return withDbRetry(async () => {
    const { data, error } = await admin
      .from(CAMPAIGN_TABLE)
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
}

export const NO_RECIPIENTS_MESSAGE =
  '발송 대상 수신자가 없습니다. 수신 대상(필수안내/메일수신동의)을 확인하세요.';

export async function repairStuckCampaign(admin, campaign) {
  if (!campaign) return campaign;
  if (campaign.status === 'running' && (campaign.total_recipients || 0) === 0) {
    return updateCampaign(admin, campaign.id, {
      status: 'completed',
      completed_at: nowIso(),
      locked_until: null,
      error_message: NO_RECIPIENTS_MESSAGE,
    });
  }
  return campaign;
}

export async function listCampaigns(admin, { limit = 50, offset = 0 } = {}) {
  const { data, error, count } = await admin
    .from(CAMPAIGN_TABLE)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { campaigns: data || [], total: count ?? 0 };
}

export async function createCampaign(admin, payload) {
  const now = nowIso();
  const { data, error } = await admin
    .from(CAMPAIGN_TABLE)
    .insert({
      ...payload,
      status: 'draft',
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCampaign(admin, campaignId, patch) {
  return withDbRetry(async () => {
    const { data, error } = await admin
      .from(CAMPAIGN_TABLE)
      .update({
        ...patch,
        updated_at: nowIso(),
      })
      .eq('id', campaignId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  });
}

export async function tryAcquireLock(admin, campaign) {
  const now = new Date();
  const nowStr = now.toISOString();
  if (campaign.locked_until && new Date(campaign.locked_until) > now) {
    return false;
  }
  const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS).toISOString();
  return withDbRetry(async () => {
    let query = admin
      .from(CAMPAIGN_TABLE)
      .update({ locked_until: lockUntil, updated_at: nowStr })
      .eq('id', campaign.id)
      .eq('status', 'running');

    if (campaign.locked_until) {
      query = query.lte('locked_until', nowStr);
    } else {
      query = query.is('locked_until', null);
    }

    const { data, error } = await query.select('id').maybeSingle();
    if (error) throw error;
    return !!data;
  });
}

export async function extendLock(admin, campaignId) {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS).toISOString();
  await withDbRetry(async () => {
    const { error } = await admin
      .from(CAMPAIGN_TABLE)
      .update({ locked_until: lockUntil, updated_at: now.toISOString() })
      .eq('id', campaignId)
      .eq('status', 'running');
    if (error) throw error;
  });
}

export async function releaseLock(admin, campaignId) {
  await withDbRetry(() =>
    admin
      .from(CAMPAIGN_TABLE)
      .update({ locked_until: null, updated_at: nowIso() })
      .eq('id', campaignId)
  );
}

export async function releaseExpiredLock(admin, campaignId) {
  const campaign = await getCampaign(admin, campaignId);
  if (!campaign?.locked_until) return campaign;
  if (new Date(campaign.locked_until) > new Date()) return campaign;
  return updateCampaign(admin, campaignId, { locked_until: null });
}

export async function recoverStaleSendingRecipients(admin, campaignId) {
  const cutoff = new Date(Date.now() - STALE_SENDING_MS).toISOString();
  await withDbRetry(async () => {
    const { error } = await admin
      .from(RECIPIENT_TABLE)
      .update({ status: 'pending', updated_at: nowIso() })
      .eq('campaign_id', campaignId)
      .eq('status', 'sending')
      .lt('updated_at', cutoff);
    if (error) throw error;
  });
}

export async function countActionableRecipients(admin, campaignId) {
  return withDbRetry(async () => {
    const { count: pendingOrSending, error: e1 } = await admin
      .from(RECIPIENT_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'sending']);
    if (e1) throw e1;

    const { data: failedRows, error: e2 } = await admin
      .from(RECIPIENT_TABLE)
      .select('attempt_count, max_attempts')
      .eq('campaign_id', campaignId)
      .eq('status', 'failed');
    if (e2) throw e2;

    const retryableFailed = (failedRows || []).filter(
      (r) => r.attempt_count < r.max_attempts
    ).length;

    return (pendingOrSending ?? 0) + retryableFailed;
  });
}

export async function getRecipientStatusCounts(admin, campaignId) {
  return withDbRetry(async () => {
    const counts = {};
    for (const status of RECIPIENT_COUNT_STATUSES) {
      const { count, error } = await admin
        .from(RECIPIENT_TABLE)
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', status);
      if (error) throw error;
      counts[status] = count ?? 0;
    }
    return counts;
  });
}

export function getRecipientTotalCount(counts) {
  return RECIPIENT_COUNT_STATUSES.reduce((total, status) => total + (counts[status] || 0), 0);
}

export async function refreshCampaignCounts(admin, campaignId) {
  const counts = await getRecipientStatusCounts(admin, campaignId);
  return updateCampaign(admin, campaignId, {
    sent_count: counts.sent,
    failed_count: counts.failed,
    skipped_count: counts.skipped,
    total_recipients: getRecipientTotalCount(counts),
  });
}

export function mergeRecipientCounts(campaign, counts) {
  return {
    ...campaign,
    sent_count: counts.sent,
    failed_count: counts.failed,
    skipped_count: counts.skipped,
    total_recipients: getRecipientTotalCount(counts),
  };
}

export async function withLiveRecipientCounts(admin, campaign) {
  if (!campaign || !ACTIVE_CAMPAIGN_STATUSES.has(campaign.status)) return campaign;
  const counts = await getRecipientStatusCounts(admin, campaign.id);
  return mergeRecipientCounts(campaign, counts);
}

export async function findResumableRunningCampaigns(admin) {
  const nowMs = Date.now();
  const rows = await withDbRetry(async () => {
    const { data, error } = await admin
      .from(CAMPAIGN_TABLE)
      .select('id, status, locked_until, error_message')
      .in('status', ['running', 'failed']);
    if (error) throw error;
    return data || [];
  });

  const candidates = rows.filter((row) => {
    if (row.status === 'running') {
      return !row.locked_until || new Date(row.locked_until).getTime() <= nowMs;
    }
    return isTransientWorkerError({ message: row.error_message });
  });

  const resumable = [];
  for (const row of candidates) {
    const actionable = await countActionableRecipients(admin, row.id);
    if (actionable > 0) {
      resumable.push({ id: row.id });
    }
  }
  return resumable;
}

export function mapCampaignToApi(campaign) {
  const total = campaign.total_recipients || 0;
  const processed =
    (campaign.sent_count || 0) + (campaign.failed_count || 0) + (campaign.skipped_count || 0);
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  const pendingCount = Math.max(total - processed, 0);
  const audience = campaign.audience;

  return {
    id: campaign.id,
    audience,
    audienceName: AUDIENCE_LABELS[audience] || audience,
    subject: campaign.subject,
    message: campaign.message,
    status: campaign.status,
    totalRecipients: total,
    sentCount: campaign.sent_count || 0,
    failedCount: campaign.failed_count || 0,
    skippedCount: campaign.skipped_count || 0,
    pendingCount,
    progressPercent: percent,
    errorMessage: campaign.error_message,
    startedAt: campaign.started_at,
    completedAt: campaign.completed_at,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
  };
}
