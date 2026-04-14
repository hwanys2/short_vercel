import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const user = getUserFromRequest(request);
    const userId = user?.id || null;

    if (!code) {
      return NextResponse.json({ available: false, message: '코드를 입력해주세요.' });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('short_urls')
      .select('expiration_date, user_id')
      .eq('code', code);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data } = await query.maybeSingle();

    if (!data) {
      return NextResponse.json({ available: true });
    }

    const isExpired = data.expiration_date && new Date(data.expiration_date) < new Date();
    if (isExpired) {
      return NextResponse.json({ available: true, expired: true });
    }

    return NextResponse.json({
      available: false,
      expiration_date: data.expiration_date,
    });
  } catch (error) {
    console.error('Check code error:', error);
    return NextResponse.json({ available: false, message: '확인 중 오류가 발생했습니다.' });
  }
}
