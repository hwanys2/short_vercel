import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getCampaign, RECIPIENT_TABLE } from '@/lib/mailing/campaign';

export async function GET(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const { admin } = auth;

  const { id } = await params;
  const campaignId = String(id || '').trim();
  if (!campaignId) {
    return NextResponse.json({ success: false, error: '캠페인 ID가 필요합니다.' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

  try {
    const campaign = await getCampaign(admin, campaignId);
    if (!campaign) {
      return NextResponse.json({ success: false, error: '캠페인을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data, error, count } = await admin
      .from(RECIPIENT_TABLE)
      .select('id, user_id, email, status, attempt_count, max_attempts, last_error, updated_at', {
        count: 'exact',
      })
      .eq('campaign_id', campaignId)
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      failures: (data || []).map((r) => ({
        id: r.id,
        userId: r.user_id,
        email: r.email,
        attemptCount: r.attempt_count,
        maxAttempts: r.max_attempts,
        lastError: r.last_error,
        updatedAt: r.updated_at,
      })),
      total: count ?? 0,
    });
  } catch (err) {
    console.error('[mailing/campaigns/:id/failures] error:', err);
    return NextResponse.json(
      { success: false, error: err.message || '실패 목록 조회 실패' },
      { status: 500 }
    );
  }
}
