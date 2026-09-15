import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAppUser } from '@/lib/session';
import { deleteShortFiles } from '@/lib/shortFiles';

export async function DELETE(request, { params }) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { id: rawId } = await params;
    const codeId = Number(rawId);
    if (!Number.isFinite(codeId) || codeId <= 0) {
      return NextResponse.json({ success: false, message: '유효하지 않은 본인 코드입니다.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: row, error: fetchErr } = await admin
      .from('short_user_codes')
      .select('id, username, is_primary, user_id')
      .eq('id', codeId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!row) {
      return NextResponse.json({ success: false, message: '본인 코드를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (row.is_primary) {
      return NextResponse.json(
        { success: false, message: '기본 본인 코드는 삭제할 수 없습니다. 변경만 가능합니다.' },
        { status: 400 }
      );
    }

    // 1. 해당 본인 코드에 속한 파일(R2/Supabase) 정리
    const { data: fileRows } = await admin
      .from('short_urls')
      .select('file_path')
      .eq('user_code_id', codeId)
      .eq('user_id', user.id)
      .not('file_path', 'is', null);

    const paths = (fileRows || []).map((r) => r.file_path).filter(Boolean);
    if (paths.length > 0) {
      try {
        await deleteShortFiles(paths);
      } catch (fileErr) {
        console.error('Delete files error during user code deletion:', fileErr);
      }
    }

    // 2. 삭제 대상 단축 URL 개수 파악
    const { count } = await admin
      .from('short_urls')
      .select('id', { count: 'exact', head: true })
      .eq('user_code_id', codeId)
      .eq('user_id', user.id);

    // 3. 해당 본인 코드에 속한 단축 URL 삭제 (short_visits, short_visits_daily는 ON DELETE CASCADE로 자동 삭제)
    const { error: urlDelErr } = await admin
      .from('short_urls')
      .delete()
      .eq('user_code_id', codeId)
      .eq('user_id', user.id);

    if (urlDelErr) {
      console.error('Delete short_urls error during user code deletion:', urlDelErr);
      throw urlDelErr;
    }

    // 4. 본인 코드 행 삭제
    const { error: delErr } = await admin
      .from('short_user_codes')
      .delete()
      .eq('id', codeId)
      .eq('user_id', user.id)
      .eq('is_primary', false);

    if (delErr) {
      if (delErr.code === '23503') {
        return NextResponse.json(
          {
            success: false,
            message: '이 본인 코드에 연결된 단축 주소가 있어 삭제할 수 없습니다.',
          },
          { status: 409 }
        );
      }
      throw delErr;
    }

    return NextResponse.json({
      success: true,
      message: '본인 코드가 삭제되었습니다.',
      deleted_username: row.username,
      deleted_urls_count: count || 0,
    });
  } catch (error) {
    console.error('Delete user code error:', error);
    return NextResponse.json(
      { success: false, message: '본인 코드 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
