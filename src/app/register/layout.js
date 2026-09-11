import { buildPageMetadata } from '@/lib/siteMetadata';

export const metadata = buildPageMetadata({
  pathname: '/register',
  title: '회원가입 | 숏.한국',
  description:
    '숏.한국 Google 회원가입. 본인 코드를 설정하면 영구 한글 단축 주소(숏.한국/닉네임/코드)를 이용할 수 있습니다.',
  robots: { index: false, follow: true },
});

export default function RegisterLayout({ children }) {
  return children;
}
