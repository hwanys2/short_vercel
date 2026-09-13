import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAppUser } from '@/lib/session';
import { resolveLinkScope } from '@/lib/userCodes';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const user = await requireAppUser(request);
    const userId = user?.id || null;
    const codeIdParam = searchParams.get('code_id');

    if (!code) {
      return NextResponse.json({ available: false, message: '코드를 입력해주세요.' });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('short_urls')
      .select('expiration_date, user_id, user_code_id')
      .eq('code', code);

    if (userId) {
      const scope = resolveLinkScope(user, codeIdParam);
      if (!scope.ok) {
        return NextResponse.json({ available: false, message: scope.message });
      }
      if (scope.temp) {
        // 회원 임시 주소(숏.한국/코드)는 비회원과 같은 네임스페이스
        query = query.is('user_id', null);
      } else {
        query = query.eq('user_code_id', scope.code.id);
      }
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
