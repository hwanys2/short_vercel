import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import {
  getCampaign,
  mapCampaignToApi,
  repairStuckCampaign,
  withLiveRecipientCounts,
} from '@/lib/mailing/campaign';

export async function GET(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const { admin } = auth;

  const { id } = await params;
  const campaignId = String(id || '').trim();
  if (!campaignId) {
    return NextResponse.json({ success: false, error: '캠페인 ID가 필요합니다.' }, { status: 400 });
  }

  try {
    let campaign = await getCampaign(admin, campaignId);
    if (!campaign) {
      return NextResponse.json({ success: false, error: '캠페인을 찾을 수 없습니다.' }, { status: 404 });
    }

    campaign = await repairStuckCampaign(admin, campaign);
    campaign = await withLiveRecipientCounts(admin, campaign);

    return NextResponse.json({
      success: true,
      campaign: mapCampaignToApi(campaign),
    });
  } catch (err) {
    console.error('[mailing/campaigns/:id] get error:', err);
    return NextResponse.json(
      { success: false, error: err.message || '캠페인 조회 실패' },
      { status: 500 }
    );
  }
}
