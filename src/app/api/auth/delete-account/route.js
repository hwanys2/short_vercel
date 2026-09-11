import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAppUser } from '@/lib/session';
import { clearAuthCookie } from '@/lib/auth';
import { deleteShortFiles } from '@/lib/shortFiles';

export async function POST(request) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (body.confirm !== 'DELETE') {
      return NextResponse.json(
        { success: false, message: '확인 문구를 정확히 입력해주세요.' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: fileRows } = await admin
      .from('short_urls')
      .select('file_path')
      .eq('user_id', user.id)
      .eq('type', 'file')
      .not('file_path', 'is', null);

    const paths = (fileRows || []).map((r) => r.file_path).filter(Boolean);
    if (paths.length > 0) {
      await deleteShortFiles(paths);
    }

    await admin.from('short_urls').delete().eq('user_id', user.id);

    const authUserId = user.auth_user_id || user.authUserId || null;

    const { error } = await admin.from('short_users').delete().eq('id', user.id);
    if (error) throw error;

    if (authUserId) {
      try {
        await admin.auth.admin.deleteUser(authUserId);
      } catch (authDelErr) {
        console.error('Auth user delete error:', authDelErr);
      }
    }

    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch (_) {
      /* ignore */
    }

    await clearAuthCookie();

    return NextResponse.json({
      success: true,
      message: '회원탈퇴가 완료되었습니다.',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { success: false, message: '회원탈퇴 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
