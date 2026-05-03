import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest, hashPassword } from '@/lib/auth';
import { memberDuplicateCodeMessage } from '@/lib/shortCodeConflictMessage';

function sanitizeUrlRow(row) {
  if (!row) return row;
  const { link_password_hash: _h, link_password_unlock_version: _v, ...rest } = row;
  return {
    ...rest,
    password_enabled: !!row.link_password_hash,
  };
}

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
      .select('id, code, original_url, created_at, visits, last_visit, link_password_hash, type, text_content')
      .eq('code', code)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return NextResponse.json({ success: false, message: 'URL을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, url: sanitizeUrlRow(row) });
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
    const { original_url, custom_code, text_content } = body;
    const newCode = typeof custom_code === 'string' ? custom_code.trim() : '';

    // 기존 row 조회 (type 포함)
    const supabase = getSupabaseAdmin();

    const { data: row, error: fetchErr } = await supabase
      .from('short_urls')
      .select(
        'id, code, original_url, created_at, visits, last_visit, link_password_hash, link_password_unlock_version, type, text_content'
      )
      .eq('code', code)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!row) {
      return NextResponse.json({ success: false, message: 'URL을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isTextType = (row.type || 'url') === 'text';

    // 타입별 검증
    if (isTextType) {
      // 텍스트 타입: text_content 검증
      if (text_content !== undefined) {
        if (!text_content || typeof text_content !== 'string' || !text_content.trim()) {
          return NextResponse.json({ success: false, message: '공유할 텍스트를 입력해주세요.' }, { status: 400 });
        }
        if (text_content.length > 50000) {
          return NextResponse.json({ success: false, message: '텍스트는 50,000자까지 입력 가능합니다.' }, { status: 400 });
        }
      }
    } else {
      // URL 타입: original_url 검증
      const orig = typeof original_url === 'string' ? original_url.trim() : '';
      if (!orig) {
        return NextResponse.json({ success: false, message: '원본 URL을 입력해주세요.' }, { status: 400 });
      }
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

    const updateFields = { code: newCode };

    if (isTextType) {
      // 텍스트 타입: text_content 업데이트
      if (text_content !== undefined) {
        updateFields.text_content = text_content;
      }
    } else {
      // URL 타입: original_url 업데이트
      updateFields.original_url = typeof original_url === 'string' ? original_url.trim() : row.original_url;
    }

    const ver = Number(row.link_password_unlock_version) || 0;
    const hasHash = !!(row.link_password_hash && String(row.link_password_hash).length > 0);

    if (Object.prototype.hasOwnProperty.call(body, 'link_password_enabled')) {
      const enabled = Boolean(body.link_password_enabled);
      const pwd = typeof body.link_password === 'string' ? body.link_password.trim() : '';

      if (!enabled) {
        updateFields.link_password_hash = null;
        updateFields.link_password_unlock_version = ver + 1;
      } else {
        if (pwd) {
          if (pwd.length < 6) {
            return NextResponse.json(
              { success: false, message: '비밀번호는 6자 이상이어야 합니다.' },
              { status: 400 }
            );
          }
          updateFields.link_password_hash = await hashPassword(pwd);
          updateFields.link_password_unlock_version = ver + 1;
        } else if (!hasHash) {
          return NextResponse.json(
            { success: false, message: '비밀번호 보호를 켤 경우 비밀번호를 입력해주세요.' },
            { status: 400 }
          );
        }
      }
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
      .update(updateFields)
      .eq('id', row.id)
      .eq('user_id', user.id)
      .select('id, code, original_url, created_at, visits, last_visit, link_password_hash')
      .single();

    if (updErr) {
      if (updErr.code === '23505') {
        return NextResponse.json({ success: false, message: memberDuplicateCodeMessage() }, { status: 409 });
      }
      console.error('Patch URL error:', updErr);
      return NextResponse.json({ success: false, message: 'URL 수정 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const successMessage = isTextType ? '텍스트가 수정되었습니다.' : 'URL이 수정되었습니다.';

    return NextResponse.json({
      success: true,
      message: successMessage,
      url: sanitizeUrlRow(updated),
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
