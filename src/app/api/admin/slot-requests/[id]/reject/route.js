import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/slot-requests/[id]/reject
 * 관리자 슬롯 신청 반려 처리
 * Body: { reason?: string }
 */
export async function POST(request, { params }) {
  const gate = await requireAdmin(request);
  if (gate.response) return gate.response;

  const { admin, user: adminUser } = gate;
  const { id } = await params;
  const requestId = parseInt(id, 10);

  if (!requestId || isNaN(requestId)) {
    return NextResponse.json(
      { success: false, error: '유효한 신청 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '홍보 기준에 부합하지 않거나 게시물을 확인할 수 없습니다.';

    // 1. 신청 건 조회
    const { data: slotReq, error: reqError } = await admin
      .from('short_slot_requests')
      .select('id, user_id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (reqError) throw reqError;
    if (!slotReq) {
      return NextResponse.json(
        { success: false, error: '해당 신청 건을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (slotReq.status === 'approved') {
      return NextResponse.json(
        { success: false, error: '이미 승인된 신청 건은 반려할 수 없습니다.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 2. 신청 상태를 rejected로 업데이트
    const { data: updatedReq, error: reqUpdateError } = await admin
      .from('short_slot_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_by: adminUser.id,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', requestId)
      .select()
      .single();

    if (reqUpdateError) throw reqUpdateError;

    return NextResponse.json({
      success: true,
      message: '신청 건이 반려 처리되었습니다.',
      request: updatedReq,
    });
  } catch (error) {
    console.error('Admin reject slot request error:', error);
    return NextResponse.json(
      { success: false, error: '슬롯 신청 반려 중 오류가 발생했습니다: ' + error.message },
      { status: 500 }
    );
  }
}
