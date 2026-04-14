import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';
import { memberDuplicateCodeMessage } from '@/lib/shortCodeConflictMessage';

function decodeCodeParam(code) {
  try {
    return decodeURIComponent(code);
  } catch {
    return code;
  }
}

export async function GET(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { code: rawCode } = await params;
    const code = decodeCodeParam(rawCode);
    const supabase = getSupabaseAdmin();

    const { data: row, error } = await supabase
      .from('short_urls')
      .select('id, code, original_url, created_at, visits, last_visit')
      .eq('code', code)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return NextResponse.json({ success: false, message: 'URL을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, url: row });
  } catch (error) {
    console.error('Get URL error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { code: rawCode } = await params;
    const code = decodeCodeParam(rawCode);
    const body = await request.json();
    const { original_url, custom_code } = body;
    const newCode = typeof custom_code === 'string' ? custom_code.trim() : '';
    const orig = typeof original_url === 'string' ? original_url.trim() : '';

    if (!orig) {
      return NextResponse.json({ success: false, message: '원본 URL을 입력해주세요.' }, { status: 400 });
    }
    if (!newCode) {
      return NextResponse.json({ success: false, message: '단축 코드를 입력해주세요.' }, { status: 400 });
    }
    if (!/^[가-힣a-zA-Z0-9_-]+$/.test(newCode)) {
      return NextResponse.json(
        { success: false, message: '단축 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: row, error: fetchErr } = await supabase
      .from('short_urls')
      .select('id, code, original_url, created_at, visits, last_visit')
      .eq('code', code)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!row) {
      return NextResponse.json({ success: false, message: 'URL을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (newCode !== row.code) {
      const { data: taken } = await supabase
        .from('short_urls')
        .select('id')
        .eq('code', newCode)
        .eq('user_id', user.id)
        .neq('id', row.id)
        .maybeSingle();

      if (taken) {
        return NextResponse.json({ success: false, message: memberDuplicateCodeMessage() }, { status: 409 });
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from('short_urls')
      .update({ original_url: orig, code: newCode })
      .eq('id', row.id)
      .eq('user_id', user.id)
      .select('id, code, original_url, created_at, visits, last_visit')
      .single();

    if (updErr) {
      if (updErr.code === '23505') {
        return NextResponse.json({ success: false, message: memberDuplicateCodeMessage() }, { status: 409 });
      }
      console.error('Patch URL error:', updErr);
      return NextResponse.json({ success: false, message: 'URL 수정 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'URL이 수정되었습니다.',
      url: updated,
    });
  } catch (error) {
    console.error('Patch URL error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { code } = await params;
    const supabase = getSupabaseAdmin();

    const { error, count } = await supabase
      .from('short_urls')
      .delete()
      .eq('code', decodeCodeParam(code))
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'URL이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete URL error:', error);
    return NextResponse.json({ success: false, message: 'URL 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
