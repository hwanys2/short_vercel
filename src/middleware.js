import { NextResponse } from 'next/server';

// 정적 페이지 경로 (이 경로들은 리다이렉트 처리하지 않음)
const STATIC_PATHS = [
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
  const pathname = request.nextUrl.pathname;

  // 루트 경로는 메인 페이지
  if (pathname === '/') {
    return NextResponse.next();
  }

  // 정적 경로는 패스
  if (STATIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // URL 세그먼트 추출
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 1) {
    // 숏.한국/코드 패턴 → 리다이렉트 API로 전달
    const code = segments[0];
    return NextResponse.rewrite(
      new URL(`/api/redirect?code=${encodeURIComponent(code)}`, request.url)
    );
  } else if (segments.length === 2) {
    // 숏.한국/유저명/코드 패턴 → 리다이렉트 API로 전달
    const username = segments[0];
    const code = segments[1];
    return NextResponse.rewrite(
      new URL(
        `/api/redirect?username=${encodeURIComponent(username)}&code=${encodeURIComponent(code)}`,
        request.url
      )
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 모든 경로에 매칭하되, _next/static, _next/image, favicon.ico 제외
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
