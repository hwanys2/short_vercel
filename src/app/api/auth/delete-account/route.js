import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest, clearAuthCookie } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    if (body.confirm !== 'DELETE') {
      return NextResponse.json({ success: false, message: '확인 문구를 정확히 입력해주세요.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 사용자의 URL 모두 삭제
    await supabase.from('short_urls').delete().eq('user_id', user.id);

    // 사용자 삭제
    const { error } = await supabase.from('short_users').delete().eq('id', user.id);
    if (error) throw error;

    // 쿠키 삭제
    await clearAuthCookie();

    return NextResponse.json({ success: true, message: '회원탈퇴가 완료되었습니다.' });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json({ success: false, message: '회원탈퇴 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
