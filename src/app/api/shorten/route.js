import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { original_url, custom_code, expire_duration = '1week' } = body;

    if (!original_url) {
      return NextResponse.json(
        { status: 'error', message: '원본 URL은 필수 파라미터입니다.' },
        { status: 400 }
      );
    }

    if (!custom_code || custom_code.trim() === '') {
      return NextResponse.json(
        { status: 'error', message: '단축 코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    const code = custom_code.trim();

    // 코드 형식 검증
    if (!/^[가-힣a-zA-Z0-9_-]+$/.test(code)) {
      return NextResponse.json(
        { status: 'error', message: '단축 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.' },
        { status: 400 }
      );
    }

    // URL 유효성 검사
    const isValidUrl = isUrlValid(original_url);
    if (!isValidUrl) {
      return NextResponse.json(
        { status: 'error', message: '유효한 URL을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 현재 사용자 확인
    const user = getUserFromRequest(request);
    const userId = user?.id || null;

    const supabase = getSupabaseAdmin();

    // 코드 가용성 확인
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
        return NextResponse.json(
          { status: 'error', message: '이미 사용 중인 단축 코드입니다.' },
          { status: 409 }
        );
      }
      // 만료된 코드면 삭제
      await supabase.from('short_urls').delete().eq('id', existing.id);
    }

    // 만료일 계산
    let expirationDate;
    if (userId) {
      // 회원은 100년
      expirationDate = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      const durations = {
        '24h': 24 * 60 * 60 * 1000,
        '48h': 48 * 60 * 60 * 1000,
        '1week': 7 * 24 * 60 * 60 * 1000,
        '1month': 30 * 24 * 60 * 60 * 1000,
      };
      const duration = durations[expire_duration] || durations['1week'];
      expirationDate = new Date(Date.now() + duration).toISOString();
    }

    // URL 삽입
    const insertData = {
      original_url,
      code,
      expiration_date: expirationDate,
      visits: 0,
    };
    if (userId) insertData.user_id = userId;

    const { data: inserted, error } = await supabase
      .from('short_urls')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('URL insert error:', error);
      return NextResponse.json(
        { status: 'error', message: 'URL 단축 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://숏.한국/';
    const shortUrl = userId && user
      ? `${baseUrl}${user.username}/${code}`
      : `${baseUrl}${code}`;

    return NextResponse.json(
      {
        status: 'success',
        message: 'URL이 성공적으로 단축되었습니다.',
        data: {
          short_url: shortUrl,
          original_url,
          code,
          expiration_date: expirationDate,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Shorten error:', error);
    return NextResponse.json(
      { status: 'error', message: 'URL 단축 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function isUrlValid(url) {
  try {
    new URL(url);
    return true;
  } catch {
    // 한글 도메인 등 특수 URL 검증
    return /^(https?:\/\/)?([가-힣\da-z.-]+)\.([가-힣a-z.]{2,6})([/\w가-힣.-]*)*\/?$/.test(url);
  }
}
