import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { isValidEmail } from '@/lib/authBridge';
import {
  getCampaign,
  updateCampaign,
  refreshCampaignCounts,
  mapCampaignToApi,
  RECIPIENT_TABLE,
  nowIso,
} from '@/lib/mailing/campaign';
import { scheduleCampaignWorker } from '@/lib/mailing/worker';

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

    if (!['completed', 'failed', 'paused'].includes(campaign.status)) {
      return NextResponse.json(
        { success: false, error: '완료·실패·일시정지 상태의 캠페인만 실패자 재발송할 수 있습니다.' },
        { status: 400 }
      );
    }

    const { data: failedRows, error: fErr } = await admin
      .from(RECIPIENT_TABLE)
      .select('id, email')
      .eq('campaign_id', campaignId)
      .eq('status', 'failed');
    if (fErr) throw fErr;

    if (!failedRows?.length) {
      return NextResponse.json(
        { success: false, error: '재발송할 실패 수신자가 없습니다.' },
        { status: 400 }
      );
    }

    const invalidRowIds = failedRows.filter((r) => !isValidEmail(r.email)).map((r) => r.id);
    const validRowIds = failedRows.filter((r) => isValidEmail(r.email)).map((r) => r.id);

    if (invalidRowIds.length > 0) {
      await admin
        .from(RECIPIENT_TABLE)
        .update({
          status: 'skipped',
          last_error: 'invalid_email_format',
          updated_at: nowIso(),
        })
        .in('id', invalidRowIds);
    }

    if (validRowIds.length === 0) {
      await refreshCampaignCounts(admin, campaignId);
      const finalCampaign = await getCampaign(admin, campaignId);
      return NextResponse.json({
        success: true,
        resetCount: 0,
        skippedInvalidCount: invalidRowIds.length,
        message: '형식에 맞지 않는 이메일은 건너뜀(skipped) 처리되었습니다. 유효한 재발송 대상이 없습니다.',
        campaign: mapCampaignToApi(finalCampaign),
      });
    }

    const { error: uErr } = await admin
      .from(RECIPIENT_TABLE)
      .update({
        status: 'pending',
        attempt_count: 0,
        last_error: null,
        updated_at: nowIso(),
      })
      .in('id', validRowIds);
    if (uErr) throw uErr;

    await updateCampaign(admin, campaignId, {
      status: 'running',
      error_message: null,
      completed_at: null,
      locked_until: null,
    });

    scheduleCampaignWorker(admin, campaignId);

    await refreshCampaignCounts(admin, campaignId);
    const finalCampaign = await getCampaign(admin, campaignId);
    return NextResponse.json({
      success: true,
      resetCount: validRowIds.length,
      skippedInvalidCount: invalidRowIds.length,
      campaign: mapCampaignToApi(finalCampaign),
    });
  } catch (err) {
    console.error('[mailing/campaigns/:id/retry-failed] error:', err);
    return NextResponse.json(
      { success: false, error: err.message || '실패자 재발송 시작 실패' },
      { status: 500 }
    );
  }
}
