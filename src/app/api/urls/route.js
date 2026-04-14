import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';
import { memberDuplicateCodeMessage } from '@/lib/shortCodeConflictMessage';

// 내 URL 목록 가져오기
export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '10');
    const offset = (page - 1) * perPage;

    const supabase = getSupabaseAdmin();

    // 전체 개수
    const { count } = await supabase
      .from('short_urls')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // URL 목록
    const { data: urls, error } = await supabase
      .from('short_urls')
      .select('code, original_url, created_at, visits, last_visit')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      urls: urls || [],
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage),
    });
  } catch (error) {
    console.error('Get URLs error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}

// 대시보드에서 URL 생성
export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { original_url, custom_code } = body;
    const code = custom_code?.trim();

    if (!code || !original_url) {
      return NextResponse.json({ success: false, message: '필수 항목을 입력해주세요.' }, { status: 400 });
    }

    if (!/^[가-힣a-zA-Z0-9_-]+$/.test(code)) {
      return NextResponse.json(
        { success: false, message: '단축 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 중복 확인
    const { data: existing } = await supabase
      .from('short_urls')
      .select('id')
      .eq('code', code)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, message: memberDuplicateCodeMessage() },
        { status: 409 }
      );
    }

    // 100년 만료
    const expirationDate = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('short_urls').insert({
      original_url,
      code,
      user_id: user.id,
      expiration_date: expirationDate,
      visits: 0,
    });

    if (error) {
      console.error('URL create error:', error);
      return NextResponse.json({ success: false, message: 'URL 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'URL이 성공적으로 생성되었습니다.' });
  } catch (error) {
    console.error('Create URL error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}
