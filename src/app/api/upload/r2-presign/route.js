import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';
import { guestDuplicateCodeMessage, memberDuplicateCodeMessage } from '@/lib/shortCodeConflictMessage';
import { createR2PresignedUploadUrl, isR2Configured } from '@/lib/r2';
import {
  formatFileSize,
  MAX_FILE_BYTES,
  R2_STORAGE_THRESHOLD_BYTES,
} from '@/lib/shortFilesShared';
import {
  normalizeDisplayFileName,
  resolveAllowedMime,
} from '@/lib/shortFiles';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Cloudflare R2 스토리지 설정이 완료되지 않았습니다. 관리자에게 문의하세요.',
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { status: 'error', message: '요청 데이터가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const { fileName, fileSize, fileType, customCode } = body;

    const size = Number(fileSize);
    if (!fileSize || isNaN(size) || size <= 0) {
      return NextResponse.json(
        { status: 'error', message: '유효한 파일 크기가 아닙니다.' },
        { status: 400 }
      );
    }

    if (size < R2_STORAGE_THRESHOLD_BYTES) {
      return NextResponse.json(
        {
          status: 'error',
          message: `${formatFileSize(R2_STORAGE_THRESHOLD_BYTES)} 미만의 파일은 일반 업로드를 사용해야 합니다.`,
        },
        { status: 400 }
      );
    }

    if (size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          status: 'error',
          message: `파일 크기는 최대 ${formatFileSize(MAX_FILE_BYTES)}까지 업로드할 수 있습니다.`,
        },
        { status: 400 }
      );
    }

    const cleanFileName = normalizeDisplayFileName(fileName);
    const mimeResult = resolveAllowedMime({ name: cleanFileName, type: fileType });
    if (!mimeResult.ok) {
      return NextResponse.json(
        { status: 'error', message: mimeResult.message },
        { status: 400 }
      );
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
        {
          status: 'error',
          message: '단축 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.',
        },
        { status: 400 }
      );
    }

    // 사전 단축 코드 중복 검사 (대용량 업로드 전 확인)
    const user = getUserFromRequest(request);
    const userId = user?.id || null;
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('short_urls')
      .select('id, expiration_date, user_id')
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
    }

    // Presigned PUT URL 발급
    const { presignedUrl, key, publicUrl } = await createR2PresignedUploadUrl({
      fileName: cleanFileName,
      fileSize: size,
      mimeType: mimeResult.mime,
      expiresIn: 3600, // 1시간
    });

    return NextResponse.json({
      status: 'success',
      data: {
        presignedUrl,
        key,
        publicUrl,
        fileName: cleanFileName,
        fileSize: size,
        fileMime: mimeResult.mime,
      },
    });
  } catch (error) {
    console.error('R2 presign error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Presigned URL 발급 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      },
      { status: 500 }
    );
  }
}
