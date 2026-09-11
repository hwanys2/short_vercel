import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import {
  getCampaign,
  updateCampaign,
  mapCampaignToApi,
  nowIso,
  NO_RECIPIENTS_MESSAGE,
} from '@/lib/mailing/campaign';
import { collectAllRecipients, insertRecipientSnapshot } from '@/lib/mailing/recipients';
import { scheduleCampaignWorker } from '@/lib/mailing/worker';

export const maxDuration = 300;

export async function POST(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const { admin } = auth;

  const { id } = await params;
  const campaignId = String(id || '').trim();
  if (!campaignId) {
    return NextResponse.json({ success: false, error: '캠페인 ID가 필요합니다.' }, { status: 400 });
  }

  try {
    const campaign = await getCampaign(admin, campaignId);
    if (!campaign) {
      return NextResponse.json({ success: false, error: '캠페인을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!['draft', 'paused', 'queued'].includes(campaign.status)) {
      return NextResponse.json(
        { success: false, error: `현재 상태(${campaign.status})에서는 시작할 수 없습니다.` },
        { status: 400 }
      );
    }

    const isPausedResume = campaign.status === 'paused';

    await updateCampaign(admin, campaignId, {
      status: 'preparing',
      error_message: null,
      started_at: campaign.started_at || nowIso(),
      completed_at: null,
    });

    const { count: existingCount } = await admin
      .from('mailing_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    let recipients = [];
    if (!existingCount) {
      recipients = await collectAllRecipients(admin, {
        audience: campaign.audience,
      });
      await insertRecipientSnapshot(admin, campaignId, recipients);
    }

    if (!existingCount && recipients.length === 0) {
      const completed = await updateCampaign(admin, campaignId, {
        status: 'completed',
        total_recipients: 0,
        sent_count: 0,
        failed_count: 0,
        skipped_count: 0,
        completed_at: nowIso(),
        error_message: NO_RECIPIENTS_MESSAGE,
        locked_until: null,
      });

      return NextResponse.json({
        success: true,
        warning: 'NO_RECIPIENTS',
        campaign: mapCampaignToApi(completed),
      });
    }

    if (isPausedResume) {
      await updateCampaign(admin, campaignId, {
        status: 'running',
        locked_until: null,
      });
    } else {
      await updateCampaign(admin, campaignId, {
        status: 'running',
        total_recipients: recipients.length,
        sent_count: 0,
        failed_count: 0,
        skipped_count: 0,
      });
    }

    scheduleCampaignWorker(admin, campaignId);

    const finalCampaign = await getCampaign(admin, campaignId);
    return NextResponse.json({
      success: true,
      campaign: mapCampaignToApi(finalCampaign),
    });
  } catch (err) {
    console.error('[mailing/campaigns/:id/start] error:', err);
    try {
      await updateCampaign(admin, campaignId, {
        status: 'failed',
        error_message: err.message || '캠페인 시작 실패',
        completed_at: nowIso(),
      });
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      { success: false, error: err.message || '캠페인 시작 실패' },
      { status: 500 }
    );
  }
}
