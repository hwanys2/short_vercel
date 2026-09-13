import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAppUser } from '@/lib/session';

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

    const { count, error: countErr } = await admin
      .from('short_urls')
      .select('id', { count: 'exact', head: true })
      .eq('user_code_id', codeId);

    if (countErr) throw countErr;
    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `이 본인 코드 아래에 단축 주소가 ${count}개 있습니다. 링크를 모두 삭제하거나 다른 코드로 옮긴 뒤 삭제해주세요.`,
          url_count: count,
        },
        { status: 409 }
      );
    }

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
    });
  } catch (error) {
    console.error('Delete user code error:', error);
    return NextResponse.json(
      { success: false, message: '본인 코드 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
