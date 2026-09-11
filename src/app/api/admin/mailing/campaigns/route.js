import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import {
  createCampaign,
  listCampaigns,
  mapCampaignToApi,
  withLiveRecipientCounts,
} from '@/lib/mailing/campaign';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const { admin } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
    const { campaigns, total } = await listCampaigns(admin, { limit, offset });
    const liveCampaigns = await Promise.all(
      campaigns.map((campaign) => withLiveRecipientCounts(admin, campaign))
    );
    return NextResponse.json({
      success: true,
      campaigns: liveCampaigns.map(mapCampaignToApi),
      total,
    });
  } catch (err) {
    console.error('[mailing/campaigns] list error:', err);
    return NextResponse.json(
      { success: false, error: err.message || '캠페인 목록 조회 실패' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const { admin, user } = auth;

  try {
    const body = await request.json();
    const audience = body.audience === 'optional' ? 'optional' : body.audience === 'system' ? 'system' : null;
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body.message === 'string' ? body.message : '';

    if (!audience || !subject || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'audience, subject, message는 필수입니다.' },
        { status: 400 }
      );
    }

    const campaign = await createCampaign(admin, {
      created_by: user.id,
      audience,
      subject,
      message,
    });

    return NextResponse.json(
      { success: true, campaign: mapCampaignToApi(campaign) },
      { status: 201 }
    );
  } catch (err) {
    console.error('[mailing/campaigns] create error:', err);
    return NextResponse.json(
      { success: false, error: err.message || '캠페인 생성 실패' },
      { status: 500 }
    );
  }
}
