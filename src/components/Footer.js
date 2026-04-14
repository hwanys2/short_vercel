import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-links">
          <Link href="/faq">자주 묻는 질문</Link>
          <Link href="/guide">사용 가이드</Link>
          <Link href="/api-docs">API 문서</Link>
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/contact">문의</Link>
          <Link href="/blog">블로그</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} 숏.한국 - 한국어 URL 단축 서비스</p>
      </div>
    </footer>
  );
}
