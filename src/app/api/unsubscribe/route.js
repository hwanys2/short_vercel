import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET  ?userId= — 수신거부 확인용 사용자 존재 여부
 * POST body: { userId } — 선택 메일(메일수신동의)만 해제
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = Number(searchParams.get('userId'));
  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId가 필요합니다.' }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: user, error } = await admin
      .from('short_users')
      .select('id, email, accepts_optional_mail')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      alreadyUnsubscribed: user.accepts_optional_mail === false,
      emailMasked: maskEmail(user.email),
    });
  } catch (err) {
    console.error('[unsubscribe] GET error:', err);
    return NextResponse.json(
      { success: false, error: err.message || '조회 실패' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const userId = Number(body.userId ?? body.uid);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId가 필요합니다.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: user, error } = await admin
      .from('short_users')
      .select('id, accepts_optional_mail')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (user.accepts_optional_mail === false) {
      return NextResponse.json({
        success: true,
        alreadyUnsubscribed: true,
        message: '이미 선택 메일 수신을 거부하셨습니다.',
      });
    }

    const { error: updErr } = await admin
      .from('short_users')
      .update({
        accepts_optional_mail: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updErr) throw updErr;

    return NextResponse.json({
      success: true,
      message: '선택 메일(메일수신동의) 구독이 취소되었습니다. 필수 안내는 계속 받을 수 있습니다.',
    });
  } catch (err) {
    console.error('[unsubscribe] POST error:', err);
    return NextResponse.json(
      { success: false, error: err.message || '구독 취소 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function maskEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at <= 1) return '***';
  return `${s.slice(0, 2)}***${s.slice(at)}`;
}
