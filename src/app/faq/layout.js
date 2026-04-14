import { buildPageMetadata } from '@/lib/siteMetadata';

export const metadata = buildPageMetadata({
  pathname: '/faq',
  title: '자주 묻는 질문 | 숏.한국',
  description:
    '숏.한국 한글 URL 단축 서비스 FAQ. 비회원·회원 URL, 만료, 한글 코드, API, QR 코드 등 자주 묻는 질문과 답변입니다.',
});

export default function FAQLayout({ children }) {
  return children;
}
