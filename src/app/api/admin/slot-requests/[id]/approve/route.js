import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { MAX_CODES_DEFAULT } from '@/lib/userCodes';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/slot-requests/[id]/approve
 * 관리자 슬롯 신청 승인 -> 사용자 max_codes +1 및 상태 approved 처리
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
    // 1. 신청 건 조회
    const { data: slotReq, error: reqError } = await admin
      .from('short_slot_requests')
      .select('id, user_id, status, sns_url, granted_slots')
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
        { success: false, error: '이미 승인 완료된 신청 건입니다.' },
        { status: 400 }
      );
    }

    // 2. 대상 사용자 정보 및 현재 max_codes 조회
    const { data: targetUser, error: userError } = await admin
      .from('short_users')
      .select('id, email, username, max_codes')
      .eq('id', slotReq.user_id)
      .maybeSingle();

    if (userError) throw userError;
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: '신청한 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const currentMax = typeof targetUser.max_codes === 'number' ? targetUser.max_codes : MAX_CODES_DEFAULT;
    const slotsToAdd = slotReq.granted_slots || 1;
    const nextMax = currentMax + slotsToAdd;

    const now = new Date().toISOString();

    // 3. 사용자 max_codes 업데이트
    const { error: userUpdateError } = await admin
      .from('short_users')
      .update({
        max_codes: nextMax,
        updated_at: now,
      })
      .eq('id', targetUser.id);

    if (userUpdateError) throw userUpdateError;

    // 4. 슬롯 신청 상태를 approved로 업데이트
    const { data: updatedReq, error: reqUpdateError } = await admin
      .from('short_slot_requests')
      .update({
        status: 'approved',
        rejection_reason: null,
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
      message: `${targetUser.email} 계정의 슬롯이 ${currentMax}개에서 ${nextMax}개로 상향 승인되었습니다.`,
      request: updatedReq,
      max_codes: nextMax,
    });
  } catch (error) {
    console.error('Admin approve slot request error:', error);
    return NextResponse.json(
      { success: false, error: '슬롯 신청 승인 중 오류가 발생했습니다: ' + error.message },
      { status: 500 }
    );
  }
}
