import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeShortPathSegment, readMiddlewareShortHeader } from '@/lib/pathSegments';

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const code =
    readMiddlewareShortHeader(request, 'short-code') ??
    (searchParams.get('code') != null ? normalizeShortPathSegment(searchParams.get('code')) : null);
  const username =
    readMiddlewareShortHeader(request, 'short-username') ??
    (searchParams.get('username') != null
      ? normalizeShortPathSegment(searchParams.get('username'))
      : null);

  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    let originalUrl = null;

    if (username) {
      // 회원 URL 패턴: /username/code
      const { data: user } = await supabase
        .from('short_users')
        .select('id')
        .eq('username', username)
        .single();

      if (!user) {
        return NextResponse.redirect(new URL('/missing.link', request.url), 302);
      }

      const { data: urlData } = await supabase
        .from('short_urls')
        .select('original_url, id')
        .eq('code', code)
        .eq('user_id', user.id)
        .single();

      if (urlData) {
        originalUrl = urlData.original_url;
        // 방문 횟수 업데이트 (비동기, 실패해도 리다이렉트 진행)
        supabase
          .from('short_urls')
          .update({ visits: urlData.visits + 1, last_visit: new Date().toISOString() })
          .eq('id', urlData.id)
          .then(() => {});
        // RPC로 atomic increment
        supabase.rpc('increment_short_url_visits', { url_id: urlData.id }).then(() => {});
      }
    } else {
      // 비회원 URL 패턴: /code (만료되지 않은 것만)
      const { data: urlData } = await supabase
        .from('short_urls')
        .select('original_url, id, expiration_date')
        .eq('code', code)
        .gt('expiration_date', new Date().toISOString())
        .order('user_id', { ascending: true, nullsFirst: true })
        .limit(1)
        .single();

      if (urlData) {
        originalUrl = urlData.original_url;
        supabase.rpc('increment_short_url_visits', { url_id: urlData.id }).then(() => {});
      }
    }

    if (originalUrl) {
      return NextResponse.redirect(originalUrl, 302);
    }

    // URL을 찾지 못한 경우
    return NextResponse.redirect(new URL('/missing.link', request.url), 302);
  } catch (error) {
    console.error('Redirect error:', error);
    return NextResponse.redirect(new URL('/missing.link', request.url), 302);
  }
}
