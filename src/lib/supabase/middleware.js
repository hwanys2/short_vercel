import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

/**
 * 앱 경로에서만 Supabase Auth 세션 쿠키를 갱신한다.
 * 단축 URL rewrite 경로에서는 호출하지 말 것.
 */
export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // JWT 서명 검증 + 필요 시 토큰 갱신 (getSession 대신 getClaims 사용)
  await supabase.auth.getClaims();

  return supabaseResponse;
}
