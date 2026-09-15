import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAppUser } from '@/lib/session';
import { notifyAdminSlotRequest } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

function isValidHttpUrl(string) {
  try {
    const url = new URL(string.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * GET /api/profile/slot-requests
 * 로그인한 사용자의 슬롯 추가 신청 내역 조회
 */
export async function GET(request) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: rows, error } = await admin
      .from('short_slot_requests')
      .select('id, user_id, sns_url, memo, status, rejection_reason, granted_slots, created_at, reviewed_at')
      .eq('user_id', user.id)
      .order('id', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      requests: rows || [],
    });
  } catch (error) {
    console.error('Fetch user slot requests error:', error);
    return NextResponse.json(
      { success: false, message: '신청 내역을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile/slot-requests
 * SNS 홍보 슬롯 추가 신청 접수
 * Body: { sns_url: string, memo?: string }
 */
export async function POST(request) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawUrl = typeof body?.sns_url === 'string' ? body.sns_url.trim() : '';
    const memo = typeof body?.memo === 'string' ? body.memo.trim() : null;

    if (!rawUrl) {
      return NextResponse.json(
        { success: false, message: 'SNS 게시물 링크를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!isValidHttpUrl(rawUrl)) {
      return NextResponse.json(
        { success: false, message: '올바른 웹 주소(http:// 또는 https://) 형식으로 입력해주세요.' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // 이미 검토 대기 중인 건이 있는지 확인
    const { data: pendingRequests, error: pendingError } = await admin
      .from('short_slot_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .limit(1);

    if (pendingError) throw pendingError;

    if (pendingRequests && pendingRequests.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: '현재 검토 대기 중인 신청 건이 있습니다. 관리자 검토 완료 후 추가 신청해주세요.',
        },
        { status: 400 }
      );
    }

    const { data: inserted, error: insertError } = await admin
      .from('short_slot_requests')
      .insert({
        user_id: user.id,
        sns_url: rawUrl,
        memo: memo ? memo.slice(0, 500) : null,
        status: 'pending',
        granted_slots: 1,
      })
      .select('id, user_id, sns_url, memo, status, rejection_reason, granted_slots, created_at, reviewed_at')
      .single();

    if (insertError) throw insertError;

    // 관리자에게 텔레그램 알림 비동기 발송 (알림 실패해도 신청 접수는 유지)
    notifyAdminSlotRequest({
      userEmail: user.email,
      username: user.username,
      currentSlots: user.max_codes ?? 2,
      snsUrl: rawUrl,
      memo,
    }).catch((err) => {
      console.error('Telegram notification background error:', err);
    });

    return NextResponse.json({
      success: true,
      message: '슬롯 추가 신청이 정상적으로 접수되었습니다. 관리자 확인 후 슬롯이 상향됩니다.',
      request: inserted,
    });
  } catch (error) {
    console.error('Submit slot request error:', error);
    return NextResponse.json(
      { success: false, message: '신청 접수 중 오류가 발생했습니다: ' + error.message },
      { status: 500 }
    );
  }
}
