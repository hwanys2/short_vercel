import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import {
  getCampaign,
  updateCampaign,
  mapCampaignToApi,
  releaseExpiredLock,
  countActionableRecipients,
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

    if (!['running', 'failed'].includes(campaign.status)) {
      return NextResponse.json(
        {
          success: false,
          error:
            '발송 중 또는 실패 상태의 캠페인만 수동 재개할 수 있습니다. 일시정지된 캠페인은 시작을 사용하세요.',
        },
        { status: 400 }
      );
    }

    const actionable = await countActionableRecipients(admin, campaignId);
    if (actionable === 0) {
      return NextResponse.json(
        { success: false, error: '재개할 대기 수신자가 없습니다.' },
        { status: 400 }
      );
    }

    if (campaign.status === 'failed') {
      await updateCampaign(admin, campaignId, {
        status: 'running',
        error_message: null,
        completed_at: null,
        locked_until: null,
      });
    } else {
      await releaseExpiredLock(admin, campaignId);
    }

    scheduleCampaignWorker(admin, campaignId);

    const finalCampaign = await getCampaign(admin, campaignId);
    return NextResponse.json({
      success: true,
      campaign: mapCampaignToApi(finalCampaign),
    });
  } catch (err) {
    console.error('[mailing/campaigns/:id/resume] error:', err);
    return NextResponse.json(
      { success: false, error: err.message || '캠페인 재개 실패' },
      { status: 500 }
    );
  }
}
