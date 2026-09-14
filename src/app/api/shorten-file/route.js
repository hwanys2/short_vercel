import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';
import { requireAppUser } from '@/lib/session';
import { guestDuplicateCodeMessage, memberDuplicateCodeMessage } from '@/lib/shortCodeConflictMessage';
import { buildShortUrl } from '@/lib/siteUrl';
import { isR2Key } from '@/lib/r2';
import {
  R2_STORAGE_THRESHOLD_BYTES,
  R2_SMALL_FOLDER_THRESHOLD_BYTES,
  R2_LARGE_FOLDER_THRESHOLD_BYTES,
  formatFileSize,
} from '@/lib/shortFilesShared';
import {
  buildStoragePath,
  deleteShortFile,
  deleteShortUrlWithFile,
  uploadShortFile,
  validateUploadFile,
} from '@/lib/shortFiles';
import { resolveLinkScope } from '@/lib/userCodes';
import { tempLinkDurationMs } from '@/lib/tempLinks';

export const runtime = 'nodejs';

/**
 * 파일 링크 만료일. userId 는 "회원 본인 코드(영구) 링크"일 때만 전달한다.
 * 회원 임시 주소는 비회원과 동일 규칙(선택 기간)을 따른다.
 */
function calculateFileExpirationDate({ userId, expireDuration, fileSize }) {
  const size = Number(fileSize) || 0;

  // 1. 1GB 초과 ~ 5GB 초대용량 파일: 2일(48시간) 후 만료
  if (size > R2_LARGE_FOLDER_THRESHOLD_BYTES) {
    return new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  }

  // 2. 10MB 초과 ~ 1GB 대용량 파일: 7일(1주일) 후 만료
  if (size > R2_SMALL_FOLDER_THRESHOLD_BYTES) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  // 3. 0 ~ 10MB 일반 파일
  if (userId) {
    // 회원은 30일 보관 (만료 시 단축 주소는 영구 유지되며, 대시보드 수정에서 새 파일 재등록 시 연장)
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  // 비회원·회원 임시 주소는 선택한 만료 기간 적용 (기본 1개월/30일)
  return new Date(Date.now() + tempLinkDurationMs(expireDuration, '1month')).toISOString();
}

/** 응답/삽입 공통: 스코프에 따른 소유 컬럼 */
function applyOwnerColumns(insertData, { userId, ownerCode, isTemp }) {
  if (userId && ownerCode && !isTemp) {
    insertData.user_id = userId;
    insertData.user_code_id = ownerCode.id;
    insertData.created_by_user_id = userId;
  } else if (userId && isTemp) {
    insertData.created_by_user_id = userId;
  }
  return insertData;
}

export async function POST(request) {
  const contentType = request.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let uploadedPath = null;

  try {
    const user = await requireAppUser(request);
    const userId = user?.id || null;
    // code_id는 JSON/FormData에서 각각 읽음 — 아래에서 설정 ('temp' 면 임시 주소)
    let ownerCode = null;
    let isTemp = false;
    const supabase = getSupabaseAdmin();

    // ========================================================
    // 1. R2 업로드 완료 처리 (JSON 요청)
    // ========================================================
    if (isJson) {
      const body = await request.json().catch(() => null);
      if (!body) {
        return NextResponse.json(
          { status: 'error', message: '요청 데이터가 올바르지 않습니다.' },
          { status: 400 }
        );
      }

      if (userId) {
        const scope = resolveLinkScope(user, body.code_id);
        if (!scope.ok) {
          return NextResponse.json(
            { status: 'error', message: scope.message },
            { status: scope.status }
          );
        }
        isTemp = scope.temp;
        ownerCode = scope.code;
      }
      const isMemberPermanent = Boolean(userId && ownerCode && !isTemp);

      const {
        key,
        publicUrl,
        fileName,
        fileSize,
        fileMime,
        customCode,
        expireDuration = '1week',
        linkPasswordEnabled = false,
        linkPassword = '',
        type = 'file',
      } = body;

      const isHtmlType = type === 'html';

      if (!key || !isR2Key(key)) {
        return NextResponse.json(
          { status: 'error', message: '유효한 스토리지 키가 아닙니다.' },
          { status: 400 }
        );
      }

      uploadedPath = key;

      const code = typeof customCode === 'string' ? customCode.trim() : '';
      if (!code) {
        return NextResponse.json(
          { status: 'error', message: '단축 코드를 입력해주세요.' },
          { status: 400 }
        );
      }

      if (!/^[가-힣a-zA-Z0-9_\-]+$/.test(code)) {
        return NextResponse.json(
          {
            status: 'error',
            message: '단축 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.',
          },
          { status: 400 }
        );
      }

      // 기존 중복 코드 검사
      let query = supabase
        .from('short_urls')
        .select('id, expiration_date, user_id, type, file_path')
        .eq('code', code);

      if (isMemberPermanent) {
        query = query.eq('user_code_id', ownerCode.id);
      } else {
        query = query.is('user_id', null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        const isExpired = existing.expiration_date && new Date(existing.expiration_date) < new Date();
        if (!isExpired) {
          const message = isMemberPermanent
            ? memberDuplicateCodeMessage()
            : guestDuplicateCodeMessage(existing.expiration_date);
          return NextResponse.json(
            {
              status: 'error',
              message,
              expiration_date: existing.expiration_date ?? null,
            },
            { status: 409 }
          );
        }
        await deleteShortUrlWithFile(existing);
      }

      let expirationDate;
      if (isHtmlType) {
        if (isMemberPermanent) {
          // 회원 HTML 웹페이지: 영구 보관 (100년)
          expirationDate = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
        } else {
          // 비회원 및 임시 HTML 웹페이지: 선택 기간 적용 (기본 1개월)
          expirationDate = new Date(Date.now() + tempLinkDurationMs(expireDuration, '1month')).toISOString();
        }
      } else {
        expirationDate = calculateFileExpirationDate({
          userId: isMemberPermanent ? userId : null,
          expireDuration,
          fileSize,
        });
      }

      const insertData = applyOwnerColumns(
        {
          original_url: publicUrl || key,
          code,
          expiration_date: expirationDate,
          visits: 0,
          type: isHtmlType ? 'html' : 'file',
          file_path: key,
          file_name: fileName || (isHtmlType ? 'index.html' : 'file'),
          file_size: Number(fileSize) || 0,
          file_mime: isHtmlType ? 'text/html; charset=utf-8' : (fileMime || 'application/octet-stream'),
        },
        { userId, ownerCode, isTemp }
      );

      if (linkPasswordEnabled) {
        const rawPwd = typeof linkPassword === 'string' ? linkPassword.trim() : '';
        if (!rawPwd || rawPwd.length < 6) {
          await deleteShortFile(uploadedPath);
          uploadedPath = null;
          return NextResponse.json(
            { status: 'error', message: '비밀번호 보호를 켤 경우 비밀번호는 6자 이상이어야 합니다.' },
            { status: 400 }
          );
        }
        insertData.link_password_hash = await hashPassword(rawPwd);
      }

      const { error: insertError } = await supabase.from('short_urls').insert(insertData).select().single();

      if (insertError) {
        console.error('R2 short url insert error:', insertError);
        await deleteShortFile(uploadedPath);
        uploadedPath = null;
        return NextResponse.json(
          { status: 'error', message: '단축 주소 생성 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      const shortUrl = buildShortUrl({
        code,
        username: isMemberPermanent ? ownerCode.username : undefined,
      });

      return NextResponse.json(
        {
          status: 'success',
          message: isHtmlType
            ? 'HTML 웹페이지 공유 주소가 성공적으로 만들어졌습니다.'
            : '파일 공유 주소가 성공적으로 만들어졌습니다.',
          data: {
            short_url: shortUrl,
            original_url: publicUrl,
            code,
            expiration_date: expirationDate,
            type: isHtmlType ? 'html' : 'file',
            file_name: fileName || (isHtmlType ? 'index.html' : 'file'),
            file_size: fileSize,
            username: isMemberPermanent ? ownerCode.username : null,
            user_code_id: isMemberPermanent ? ownerCode.id : null,
            is_temp: Boolean(userId && isTemp),
            managed: Boolean(userId),
          },
        },
        { status: 201 }
      );
    }

    // ========================================================
    // 2. 레거시 FormData 업로드 (하위 호환 지원)
    // ========================================================
    const form = await request.formData();
    const file = form.get('file');
    const customCode = form.get('custom_code');
    const expireDuration = form.get('expire_duration') || '1week';
    const linkPasswordEnabled =
      form.get('link_password_enabled') === 'true' || form.get('link_password_enabled') === '1';
    const linkPassword = typeof form.get('link_password') === 'string' ? form.get('link_password') : '';
    const formCodeId = form.get('code_id');

    if (userId) {
      const scope = resolveLinkScope(user, formCodeId);
      if (!scope.ok) {
        return NextResponse.json(
          { status: 'error', message: scope.message },
          { status: scope.status }
        );
      }
      isTemp = scope.temp;
      ownerCode = scope.code;
    }
    const isMemberPermanent = Boolean(userId && ownerCode && !isTemp);

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { status: 'error', message: '파일을 선택해주세요.' },
        { status: 400 }
      );
    }

    if (file.size >= R2_STORAGE_THRESHOLD_BYTES) {
      return NextResponse.json(
        {
          status: 'error',
          message: `${formatFileSize(R2_STORAGE_THRESHOLD_BYTES)} 이상의 파일은 Cloudflare R2 직접 업로드를 사용해야 합니다.`,
        },
        { status: 400 }
      );
    }

    const validated = validateUploadFile(file);
    if (!validated.ok) {
      return NextResponse.json({ status: 'error', message: validated.message }, { status: 400 });
    }

    const code = typeof customCode === 'string' ? customCode.trim() : '';
    if (!code) {
      return NextResponse.json(
        { status: 'error', message: '단축 코드를 입력해주세요.' },
        { status: 400 }
      );
    }
    if (!/^[가-힣a-zA-Z0-9_\-]+$/.test(code)) {
      return NextResponse.json(
        { status: 'error', message: '단축 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('short_urls')
      .select('id, expiration_date, user_id, type, file_path')
      .eq('code', code);

    if (isMemberPermanent) {
      query = query.eq('user_code_id', ownerCode.id);
    } else {
      query = query.is('user_id', null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      const isExpired = existing.expiration_date && new Date(existing.expiration_date) < new Date();
      if (!isExpired) {
        const message = isMemberPermanent
          ? memberDuplicateCodeMessage()
          : guestDuplicateCodeMessage(existing.expiration_date);
        return NextResponse.json(
          {
            status: 'error',
            message,
            expiration_date: existing.expiration_date ?? null,
          },
          { status: 409 }
        );
      }
      await deleteShortUrlWithFile(existing);
    }

    const expirationDate = calculateFileExpirationDate({
      userId: isMemberPermanent ? userId : null,
      expireDuration,
      fileSize: validated.fileSize,
    });

    const storagePath = buildStoragePath({ userId, fileName: validated.fileName });
    await uploadShortFile({ file, path: storagePath, mime: validated.mime });
    uploadedPath = storagePath;

    const insertData = applyOwnerColumns(
      {
        original_url: '__file__',
        code,
        expiration_date: expirationDate,
        visits: 0,
        type: 'file',
        file_path: storagePath,
        file_name: validated.fileName,
        file_size: validated.fileSize,
        file_mime: validated.mime,
      },
      { userId, ownerCode, isTemp }
    );

    if (linkPasswordEnabled) {
      const rawPwd = linkPassword.trim();
      if (!rawPwd || rawPwd.length < 6) {
        await deleteShortFile(uploadedPath);
        uploadedPath = null;
        return NextResponse.json(
          { status: 'error', message: '비밀번호 보호를 켤 경우 비밀번호는 6자 이상이어야 합니다.' },
          { status: 400 }
        );
      }
      insertData.link_password_hash = await hashPassword(rawPwd);
    }

    const { error } = await supabase.from('short_urls').insert(insertData).select().single();

    if (error) {
      console.error('File URL insert error:', error);
      await deleteShortFile(uploadedPath);
      uploadedPath = null;
      return NextResponse.json(
        { status: 'error', message: '단축 주소 생성 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const shortUrl = buildShortUrl({
      code,
      username: isMemberPermanent ? ownerCode.username : undefined,
    });

    return NextResponse.json(
      {
        status: 'success',
        message: '파일 공유 주소가 성공적으로 만들어졌습니다.',
        data: {
          short_url: shortUrl,
          original_url: null,
          code,
          expiration_date: expirationDate,
          type: 'file',
          file_name: validated.fileName,
          file_size: validated.fileSize,
          username: isMemberPermanent ? ownerCode.username : null,
          user_code_id: isMemberPermanent ? ownerCode.id : null,
          is_temp: Boolean(userId && isTemp),
          managed: Boolean(userId),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Shorten file error:', error);
    if (uploadedPath) {
      try {
        await deleteShortFile(uploadedPath);
      } catch {}
    }
    if (error?.name === 'ShortFileStorageError') {
      return NextResponse.json(
        { status: 'error', message: error.message },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { status: 'error', message: '파일 공유 주소 생성 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
