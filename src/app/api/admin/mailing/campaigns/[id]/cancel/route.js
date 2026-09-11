import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getCampaign, updateCampaign, mapCampaignToApi, nowIso } from '@/lib/mailing/campaign';

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
    if (['completed', 'cancelled', 'failed'].includes(campaign.status)) {
      return NextResponse.json({ success: false, error: '이미 종료된 캠페인입니다.' }, { status: 400 });
    }

    const updated = await updateCampaign(admin, campaignId, {
      status: 'cancelled',
      locked_until: null,
      completed_at: nowIso(),
    });

    return NextResponse.json({ success: true, campaign: mapCampaignToApi(updated) });
  } catch (err) {
    console.error('[mailing/campaigns/:id/cancel] error:', err);
    return NextResponse.json(
      { success: false, error: err.message || '취소 실패' },
      { status: 500 }
    );
  }
}
