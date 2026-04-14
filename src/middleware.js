import { NextResponse } from 'next/server';
import { normalizeShortPathSegment } from '@/lib/pathSegments';

// 정적 페이지 경로 (이 경로들은 리다이렉트 처리하지 않음)
// 단축 코드는 [가-힣a-zA-Z0-9_-]+ 만 허용 → 점(.)이 들어간 경로는 예약(리다이렉트 루프 방지)
const STATIC_PATHS = [
  '/missing.link',
  '/login',
  '/register',
  '/dashboard',
  '/faq',
  '/guide',
  '/terms',
  '/privacy',
  '/contact',
  '/blog',
  '/api-docs',
  '/api',
  '/_next',
  '/favicon',
  '/images',
  '/robots.txt',
  '/sitemap.xml',
  '/ads.txt',
];

export function middleware(request) {
  const rawPath = request.nextUrl.pathname;
  const pathname = rawPath.replace(/\/+$/, '') || '/';

  // 루트 경로는 메인 페이지
  if (pathname === '/') {
    return NextResponse.next();
  }

  // 정적 경로는 패스
  if (STATIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // URL 세그먼트 추출 (퍼센트 인코딩·NFC 정규화 후 DB와 동일한 문자열로 조회)
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 1) {
    // 숏.한국/코드 패턴 → 리다이렉트 API로 전달
    const code = normalizeShortPathSegment(segments[0]);
    const u = new URL('/api/redirect', request.url);
    u.searchParams.set('code', code);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('short-code', encodeURIComponent(code));
    return NextResponse.rewrite(u, { request: { headers: requestHeaders } });
  } else if (segments.length === 2) {
    // 숏.한국/유저명/코드 패턴 → 리다이렉트 API로 전달
    const username = normalizeShortPathSegment(segments[0]);
    const code = normalizeShortPathSegment(segments[1]);
    const u = new URL('/api/redirect', request.url);
    u.searchParams.set('username', username);
    u.searchParams.set('code', code);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('short-username', encodeURIComponent(username));
    requestHeaders.set('short-code', encodeURIComponent(code));
    return NextResponse.rewrite(u, { request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 모든 경로에 매칭하되, _next/static, _next/image, favicon.ico 제외
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
