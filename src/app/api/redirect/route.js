import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeShortPathSegment, readMiddlewareShortHeader } from '@/lib/pathSegments';
import { isValidLinkUnlockCookie } from '@/lib/linkUnlock';

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
    let urlType = 'url';

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
        .select('original_url, id, link_password_hash, link_password_unlock_version, type, text_content')
        .eq('code', code)
        .eq('user_id', user.id)
        .single();

      if (urlData) {
        const protectedLink =
          urlData.link_password_hash != null && String(urlData.link_password_hash).length > 0;
        const unlockVersion = Number(urlData.link_password_unlock_version) || 0;

        if (protectedLink) {
          if (isValidLinkUnlockCookie(request, username, code, unlockVersion)) {
            originalUrl = urlData.original_url;
            urlType = urlData.type || 'url';
            supabase.rpc('increment_short_url_visits', { url_id: urlData.id }).then(() => {});
          } else {
            const gate = new URL('/link-gate', request.url);
            gate.searchParams.set('username', username);
            gate.searchParams.set('code', code);
            return NextResponse.redirect(gate, 302);
          }
        } else {
          originalUrl = urlData.original_url;
          urlType = urlData.type || 'url';
          supabase.rpc('increment_short_url_visits', { url_id: urlData.id }).then(() => {});
        }
      }
    } else {
      // 비회원 URL 패턴: /code (만료되지 않은 것만)
      const { data: urlData } = await supabase
        .from('short_urls')
        .select('original_url, id, expiration_date, type, text_content')
        .eq('code', code)
        .gt('expiration_date', new Date().toISOString())
        .order('user_id', { ascending: true, nullsFirst: true })
        .limit(1)
        .single();

      if (urlData) {
        originalUrl = urlData.original_url;
        urlType = urlData.type || 'url';
        supabase.rpc('increment_short_url_visits', { url_id: urlData.id }).then(() => {});
      }
    }

    if (originalUrl) {
      // 텍스트 타입이면 텍스트 뷰어 페이지로 리다이렉트
      if (urlType === 'text') {
        const textViewUrl = new URL('/text-view', request.url);
        textViewUrl.searchParams.set('code', code);
        if (username) {
          textViewUrl.searchParams.set('username', username);
        }
        return NextResponse.redirect(textViewUrl, 302);
      }

      return NextResponse.redirect(originalUrl, 302);
    }

    // URL을 찾지 못한 경우
    return NextResponse.redirect(new URL('/missing.link', request.url), 302);
  } catch (error) {
    console.error('Redirect error:', error);
    return NextResponse.redirect(new URL('/missing.link', request.url), 302);
  }
}
