import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest, hashPassword } from '@/lib/auth';
import { guestDuplicateCodeMessage, memberDuplicateCodeMessage } from '@/lib/shortCodeConflictMessage';
import { buildShortUrl } from '@/lib/siteUrl';
import {
  buildStoragePath,
  deleteShortFile,
  deleteShortUrlWithFile,
  uploadShortFile,
  validateUploadFile,
} from '@/lib/shortFiles';

export const runtime = 'nodejs';

export async function POST(request) {
  let uploadedPath = null;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const customCode = form.get('custom_code');
    const expireDuration = form.get('expire_duration') || '1week';
    const linkPasswordEnabled = form.get('link_password_enabled') === 'true' || form.get('link_password_enabled') === '1';
    const linkPassword = typeof form.get('link_password') === 'string' ? form.get('link_password') : '';

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { status: 'error', message: '파일을 선택해주세요.' },
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
    if (!/^[가-힣a-zA-Z0-9_-]+$/.test(code)) {
      return NextResponse.json(
        { status: 'error', message: '단축 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.' },
        { status: 400 }
      );
    }

    const user = getUserFromRequest(request);
    const userId = user?.id || null;
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('short_urls')
      .select('id, expiration_date, user_id, type, file_path')
      .eq('code', code);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      const isExpired = existing.expiration_date && new Date(existing.expiration_date) < new Date();
      if (!isExpired) {
        const message = userId
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
    if (userId) {
      expirationDate = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      const durations = {
        '24h': 24 * 60 * 60 * 1000,
        '48h': 48 * 60 * 60 * 1000,
        '1week': 7 * 24 * 60 * 60 * 1000,
        '1month': 30 * 24 * 60 * 60 * 1000,
      };
      const duration = durations[expireDuration] || durations['1week'];
      expirationDate = new Date(Date.now() + duration).toISOString();
    }

    const storagePath = buildStoragePath({ userId, fileName: validated.fileName });
    await uploadShortFile({ file, path: storagePath, mime: validated.mime });
    uploadedPath = storagePath;

    const insertData = {
      original_url: '__file__',
      code,
      expiration_date: expirationDate,
      visits: 0,
      type: 'file',
      file_path: storagePath,
      file_name: validated.fileName,
      file_size: validated.fileSize,
      file_mime: validated.mime,
    };

    if (userId) insertData.user_id = userId;

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
      username: userId && user ? user.username : undefined,
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
    return NextResponse.json(
      { status: 'error', message: '파일 공유 주소 생성 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
