import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <>
      <Header />
      <main>
        <div className="not-found-page">
          <div className="not-found-code">404</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '12px' }}>
            페이지를 찾을 수 없습니다
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '400px' }}>
            요청하신 URL이 만료되었거나 존재하지 않습니다.
            올바른 주소인지 확인해주세요.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/" className="btn btn-primary">
              홈으로 이동
            </Link>
            <Link href="/faq" className="btn btn-secondary">
              자주 묻는 질문
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
