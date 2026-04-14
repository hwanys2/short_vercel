// 외부 API 호환 엔드포인트 (기존 api.php와 동일한 동작)
// POST /api/v1/shorten 으로 외부에서 호출 가능
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { guestDuplicateCodeMessage } from '@/lib/shortCodeConflictMessage';

export async function GET() {
  return NextResponse.json({
    status: 'success',
    message: 'API 정보',
    data: {
      name: '숏.한국 API',
      version: '1.0',
      description: 'URL 단축 서비스 API',
      endpoints: {
        'POST /': 'URL 단축 요청',
        'GET /': 'API 정보',
      },
      required_params: { original_url: '단축할 원본 URL' },
      optional_params: {
        custom_code: '사용자 지정 단축 코드 (미입력시 자동 생성)',
        expire_duration: '만료 기간 (24h, 48h, 1week, 1month)',
      },
    },
  });
}

export async function POST(request) {
  try {
    let input;
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      input = await request.json();
    } else if (contentType.includes('form')) {
      const formData = await request.formData();
      input = Object.fromEntries(formData);
    } else {
      // try JSON first, then form
      try {
        input = await request.json();
      } catch {
        input = {};
      }
    }

    const originalUrl = input.original_url;
    let customCode = input.custom_code ? input.custom_code.trim() : '';
    const expireDuration = input.expire_duration || '1week';

    if (!originalUrl) {
      return NextResponse.json(
        { status: 'error', message: '원본 URL은 필수 파라미터입니다.' },
        { status: 400 }
      );
    }

    // 유효한 만료 기간 확인
    const validDurations = ['24h', '48h', '1week', '1month'];
    if (!validDurations.includes(expireDuration)) {
      return NextResponse.json(
        { status: 'error', message: '만료 기간은 24h, 48h, 1week, 1month 중 하나만 선택할 수 있습니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 코드가 비어있으면 랜덤 생성
    if (!customCode) {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let found = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        customCode = '';
        for (let i = 0; i < 6; i++) {
          customCode += chars[Math.floor(Math.random() * chars.length)];
        }
        const { data } = await supabase
          .from('short_urls')
          .select('id')
          .eq('code', customCode)
          .is('user_id', null)
          .maybeSingle();
        if (!data) { found = true; break; }
      }
      if (!found) {
        return NextResponse.json(
          { status: 'error', message: '사용 가능한 단축 코드를 생성할 수 없습니다.' },
          { status: 500 }
        );
      }
    } else {
      if (!/^[가-힣a-zA-Z0-9_-]+$/.test(customCode)) {
        return NextResponse.json(
          { status: 'error', message: '단축 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.' },
          { status: 400 }
        );
      }

      const { data: existing } = await supabase
        .from('short_urls')
        .select('expiration_date')
        .eq('code', customCode)
        .is('user_id', null)
        .maybeSingle();

      if (existing) {
        const isExpired = existing.expiration_date && new Date(existing.expiration_date) < new Date();
        if (!isExpired) {
          return NextResponse.json(
            {
              status: 'error',
              message: guestDuplicateCodeMessage(existing.expiration_date),
              expiration_date: existing.expiration_date ?? null,
            },
            { status: 409 }
          );
        }
        await supabase.from('short_urls').delete().eq('code', customCode).is('user_id', null);
      }
    }

    // URL 유효성 검사
    let isValid = false;
    try { new URL(originalUrl); isValid = true; } catch {}
    if (!isValid) {
      isValid = /^(https?:\/\/)?([가-힣\da-z.-]+)\.([가-힣a-z.]{2,6})([/\w가-힣.-]*)*\/?$/.test(originalUrl);
    }
    if (!isValid) {
      return NextResponse.json({ status: 'error', message: '유효한 URL을 입력해주세요.' }, { status: 400 });
    }

    // 만료일 계산
    const durations = {
      '24h': 24 * 60 * 60 * 1000,
      '48h': 48 * 60 * 60 * 1000,
      '1week': 7 * 24 * 60 * 60 * 1000,
      '1month': 30 * 24 * 60 * 60 * 1000,
    };
    const expirationDate = new Date(Date.now() + durations[expireDuration]).toISOString();

    const { error } = await supabase.from('short_urls').insert({
      original_url: originalUrl,
      code: customCode,
      expiration_date: expirationDate,
      visits: 0,
    });

    if (error) {
      console.error('API shorten error:', error);
      return NextResponse.json(
        { status: 'error', message: 'URL 단축 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://숏.한국/';
    return NextResponse.json(
      {
        status: 'success',
        message: 'URL이 성공적으로 단축되었습니다.',
        data: {
          short_url: `${baseUrl}${customCode}`,
          original_url: originalUrl,
          code: customCode,
          expiration_date: expirationDate,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('API shorten exception:', error);
    return NextResponse.json(
      { status: 'error', message: 'URL 단축 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
