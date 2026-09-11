import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(request) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (typeof body.accepts_optional_mail !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'accepts_optional_mail(boolean)이 필요합니다.' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('short_users')
      .update({
        accepts_optional_mail: body.accepts_optional_mail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id, accepts_optional_mail')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      accepts_optional_mail: data.accepts_optional_mail,
    });
  } catch (err) {
    console.error('[profile/mail-consent] error:', err);
    return NextResponse.json(
      { success: false, message: '메일 수신 설정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
