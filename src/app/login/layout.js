import { buildPageMetadata } from '@/lib/siteMetadata';

export const metadata = buildPageMetadata({
  pathname: '/login',
  title: '로그인 | 숏.한국',
  description: '숏.한국 회원 로그인. 영구 단축 URL과 대시보드를 이용하려면 로그인하세요.',
  robots: { index: false, follow: true },
});

export default function LoginLayout({ children }) {
  return children;
}
