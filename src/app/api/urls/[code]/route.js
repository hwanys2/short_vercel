import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';
import { requireAppUser } from '@/lib/session';
import { guestDuplicateCodeMessage, memberDuplicateCodeMessage } from '@/lib/shortCodeConflictMessage';
import { deleteShortFile, deleteShortUrlWithFile } from '@/lib/shortFiles';
import { isR2Key } from '@/lib/r2';
import {
  R2_SMALL_FOLDER_THRESHOLD_BYTES,
  R2_LARGE_FOLDER_THRESHOLD_BYTES,
} from '@/lib/shortFilesShared';
import { resolveLinkScope } from '@/lib/userCodes';
import {
  clampTempExpirationIso,
  isValidTempDuration,
  tempLinkExpirationIso,
} from '@/lib/tempLinks';

const PERMANENT_MS = 100 * 365 * 24 * 60 * 60 * 1000;

const ROW_COLUMNS =
  'id, code, original_url, file_path, created_at, expiration_date, visits, last_visit, link_password_hash, link_password_unlock_version, type, text_content, file_name, file_size, file_mime, user_id, user_code_id, created_by_user_id';

function sanitizeUrlRow(row) {
  if (!row) return row;
  const {
    link_password_hash: _h,
    link_password_unlock_version: _v,
    file_path: _fp,
    created_by_user_id: _cb,
    user_id,
    ...rest
  } = row;
  return {
    ...rest,
    is_temp: user_id == null,
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

/**
 * 요청의 스코프(code_id) 해석. body 우선, 없으면 쿼리.
 * 'temp' → 내가 만든 임시 주소(user_id NULL) / 숫자 → 본인 코드
 */
function resolveScope(user, request, bodyCodeId) {
  const { searchParams } = new URL(request.url);
  const fromQuery = searchParams.get('code_id');
  const param = bodyCodeId !== undefined && bodyCodeId !== null ? bodyCodeId : fromQuery;
  return resolveLinkScope(user, param);
}

/** 스코프에 맞는 단일 행 조회 (소유권 검증 포함) */
async function fetchScopedRow(supabase, user, scope, code, columns = ROW_COLUMNS) {
  let query = supabase.from('short_urls').select(columns).eq('code', code);
  if (scope.temp) {
    query = query.is('user_id', null).eq('created_by_user_id', user.id);
  } else {
    query = query.eq('user_code_id', scope.code.id).eq('user_id', user.id);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

function scopeUsername(scope) {
  return scope.temp ? null : scope.code.username;
}

export async function GET(request, { params }) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { code: rawCode } = await params;
    const code = decodeCodeParam(rawCode);
    const scoped = resolveScope(user, request);
    if (!scoped.ok) {
      return NextResponse.json({ success: false, message: scoped.message }, { status: scoped.status });
    }

    const supabase = getSupabaseAdmin();
    const row = await fetchScopedRow(supabase, user, scoped, code);

    if (!row) {
      return NextResponse.json({ success: false, message: 'URL을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      url: {
        ...sanitizeUrlRow(row),
        user_code_id: row.user_code_id != null ? Number(row.user_code_id) : null,
        code_username: scopeUsername(scoped),
      },
    });
  } catch (error) {
    console.error('Get URL error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { code: rawCode } = await params;
    const code = decodeCodeParam(rawCode);
    const body = await request.json();
    const {
      original_url,
      custom_code,
      text_content,
      new_file_key,
      new_file_name,
      new_file_size,
      new_file_mime,
      new_public_url,
      user_code_id: moveToScopeParam,
      expire_duration,
    } = body;
    const newCode = typeof custom_code === 'string' ? custom_code.trim() : '';

    const scoped = resolveScope(user, request, body.code_id);
    if (!scoped.ok) {
      return NextResponse.json({ success: false, message: scoped.message }, { status: scoped.status });
    }

    const supabase = getSupabaseAdmin();
    const row = await fetchScopedRow(supabase, user, scoped, code);

    if (!row) {
      return NextResponse.json({ success: false, message: 'URL을 찾을 수 없습니다.' }, { status: 404 });
    }

    const rowType = row.type || 'url';
    const isTextType = rowType === 'text';
    const isFileType = rowType === 'file';
    const isHtmlType = rowType === 'html';

    if (isTextType) {
      if (text_content !== undefined) {
        if (!text_content || typeof text_content !== 'string' || !text_content.trim()) {
          return NextResponse.json({ success: false, message: '공유할 텍스트를 입력해주세요.' }, { status: 400 });
        }
        if (text_content.length > 50000) {
          return NextResponse.json({ success: false, message: '텍스트는 50,000자까지 입력 가능합니다.' }, { status: 400 });
        }
      }
    } else if (isFileType || isHtmlType) {
      if (new_file_key) {
        if (!isR2Key(new_file_key)) {
          return NextResponse.json({ success: false, message: '유효한 스토리지 파일 키가 아닙니다.' }, { status: 400 });
        }
      }
    } else {
      const orig = typeof original_url === 'string' ? original_url.trim() : '';
      if (!orig) {
        return NextResponse.json({ success: false, message: '원본 URL을 입력해주세요.' }, { status: 400 });
      }
    }

    if (!newCode) {
      return NextResponse.json({ success: false, message: '단축 코드를 입력해주세요.' }, { status: 400 });
    }
    if (!/^[가-힣a-zA-Z0-9_\-]+$/.test(newCode)) {
      return NextResponse.json(
        { success: false, message: '단축 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 이동 대상: 다른 본인 코드 / 임시 주소 / (미지정) 현재 스코프 유지
    let target = scoped;
    if (moveToScopeParam !== undefined && moveToScopeParam !== null && moveToScopeParam !== '') {
      const moved = resolveLinkScope(user, moveToScopeParam);
      if (!moved.ok) {
        return NextResponse.json({ success: false, message: moved.message }, { status: moved.status });
      }
      target = moved;
    }

    if (expire_duration !== undefined && expire_duration !== null && expire_duration !== '') {
      if (!isValidTempDuration(expire_duration)) {
        return NextResponse.json({ success: false, message: '유효하지 않은 만료 기간입니다.' }, { status: 400 });
      }
      if (!target.temp) {
        return NextResponse.json(
          { success: false, message: '만료 기간은 임시 주소에만 설정할 수 있습니다.' },
          { status: 400 }
        );
      }
    }

    const updateFields = { code: newCode, created_by_user_id: user.id };
    if (target.temp) {
      updateFields.user_id = null;
      updateFields.user_code_id = null;
    } else {
      updateFields.user_id = user.id;
      updateFields.user_code_id = target.code.id;
    }

    // 만료 처리
    // - 임시 → 본인 코드(영구): URL/텍스트/HTML은 100년, 파일은 보관 기간 유지
    // - 본인 코드 → 임시: URL/텍스트/HTML은 선택 기간(기본 1주일), 파일은 보관 기간(최대 30일로 상한)
    // - 임시 → 임시: expire_duration 있으면 지금부터 재설정(연장), 파일은 변경 불가
    const convertingToTemp = target.temp && !scoped.temp;
    const convertingToPermanent = !target.temp && scoped.temp;
    if (!isFileType) {
      if (convertingToPermanent) {
        updateFields.expiration_date = new Date(Date.now() + PERMANENT_MS).toISOString();
      } else if (target.temp && expire_duration) {
        updateFields.expiration_date = tempLinkExpirationIso(expire_duration);
      } else if (convertingToTemp) {
        updateFields.expiration_date = tempLinkExpirationIso('1week');
      }
    } else if (convertingToTemp) {
      updateFields.expiration_date = clampTempExpirationIso(row.expiration_date);
    }

    if (isTextType) {
      if (text_content !== undefined) {
        updateFields.text_content = text_content;
      }
    } else if (isFileType || isHtmlType) {
      if (new_file_key) {
        if (row.file_path) {
          await deleteShortFile(row.file_path);
        }
        updateFields.file_path = new_file_key;
        updateFields.file_name = new_file_name || (isHtmlType ? 'index.html' : 'file');
        updateFields.file_size = Number(new_file_size) || 0;
        updateFields.file_mime = isHtmlType ? 'text/html; charset=utf-8' : (new_file_mime || 'application/octet-stream');
        updateFields.original_url = new_public_url || new_file_key;

        if (isHtmlType) {
          if (!target.temp) {
            updateFields.expiration_date = new Date(Date.now() + PERMANENT_MS).toISOString();
          } else {
            updateFields.expiration_date = tempLinkExpirationIso(expire_duration || '1month');
          }
        } else {
          const newSize = Number(new_file_size) || 0;
          let retentionMs = 30 * 24 * 60 * 60 * 1000;
          if (newSize > R2_LARGE_FOLDER_THRESHOLD_BYTES) {
            retentionMs = 2 * 24 * 60 * 60 * 1000;
          } else if (newSize > R2_SMALL_FOLDER_THRESHOLD_BYTES) {
            retentionMs = 7 * 24 * 60 * 60 * 1000;
          }
          updateFields.expiration_date = new Date(Date.now() + retentionMs).toISOString();
        }
      }
    } else {
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

    // 주소(코드) 또는 소속(본인 코드/임시)이 바뀌면 대상 네임스페이스에서 중복 검사
    const scopeChanged = Boolean(target.temp) !== Boolean(scoped.temp) ||
      (!target.temp && Number(target.code.id) !== Number(row.user_code_id));
    const slugOrScopeChanged = newCode !== row.code || scopeChanged;
    if (slugOrScopeChanged) {
      let dupQuery = supabase
        .from('short_urls')
        .select('id, expiration_date, user_id, type, file_path')
        .eq('code', newCode)
        .neq('id', row.id);
      dupQuery = target.temp ? dupQuery.is('user_id', null) : dupQuery.eq('user_code_id', target.code.id);
      const { data: taken } = await dupQuery.maybeSingle();

      if (taken) {
        const takenExpired = taken.expiration_date && new Date(taken.expiration_date) < new Date();
        if (target.temp && takenExpired) {
          // 만료된 비회원/임시 코드는 정리 후 사용
          await deleteShortUrlWithFile(taken);
        } else {
          return NextResponse.json(
            {
              success: false,
              message: target.temp ? guestDuplicateCodeMessage(taken.expiration_date) : memberDuplicateCodeMessage(),
              expiration_date: taken.expiration_date ?? null,
            },
            { status: 409 }
          );
        }
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from('short_urls')
      .update(updateFields)
      .eq('id', row.id)
      .eq('created_by_user_id', user.id)
      .select(
        'id, code, original_url, created_at, expiration_date, visits, last_visit, link_password_hash, type, file_name, file_size, file_mime, user_id, user_code_id'
      )
      .single();

    if (updErr) {
      if (updErr.code === '23505') {
        return NextResponse.json(
          { success: false, message: target.temp ? guestDuplicateCodeMessage(null) : memberDuplicateCodeMessage() },
          { status: 409 }
        );
      }
      console.error('Patch URL error:', updErr);
      return NextResponse.json({ success: false, message: 'URL 수정 중 오류가 발생했습니다.' }, { status: 500 });
    }

    let successMessage;
    if (convertingToPermanent) {
      successMessage = '영구 주소(내 코드)로 전환되었습니다.';
    } else if (convertingToTemp) {
      successMessage = '임시 주소(숏.한국/코드)로 전환되었습니다.';
    } else if (isTextType) {
      successMessage = '텍스트가 수정되었습니다.';
    } else if (isHtmlType) {
      successMessage = new_file_key
        ? '새 HTML 파일이 성공적으로 등록되었습니다.'
        : '웹페이지 링크가 수정되었습니다.';
    } else if (isFileType) {
      successMessage = new_file_key
        ? '새 파일이 성공적으로 등록되었으며 다운로드 기간이 갱신되었습니다.'
        : '파일 공유 링크가 수정되었습니다.';
    } else if (target.temp && expire_duration) {
      successMessage = 'URL이 수정되고 만료 기간이 다시 설정되었습니다.';
    } else {
      successMessage = 'URL이 수정되었습니다.';
    }

    return NextResponse.json({
      success: true,
      message: successMessage,
      url: {
        ...sanitizeUrlRow(updated),
        user_code_id: updated.user_code_id != null ? Number(updated.user_code_id) : null,
        code_username: scopeUsername(target),
      },
    });
  } catch (error) {
    console.error('Patch URL error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { code } = await params;
    const decoded = decodeCodeParam(code);
    const scoped = resolveScope(user, request);
    if (!scoped.ok) {
      return NextResponse.json({ success: false, message: scoped.message }, { status: scoped.status });
    }

    const supabase = getSupabaseAdmin();
    const row = await fetchScopedRow(supabase, user, scoped, decoded, 'id, type, file_path');

    if (!row) {
      return NextResponse.json({ success: false, message: 'URL을 찾을 수 없습니다.' }, { status: 404 });
    }

    if ((row.type === 'file' || row.type === 'html') && row.file_path) {
      await deleteShortFile(row.file_path);
    }

    const { error } = await supabase
      .from('short_urls')
      .delete()
      .eq('id', row.id)
      .eq('created_by_user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'URL이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete URL error:', error);
    return NextResponse.json({ success: false, message: 'URL 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
