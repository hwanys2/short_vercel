import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: '단축 링크를 찾을 수 없습니다 | 숏.한국',
  description:
    '요청하신 단축 주소가 없거나 만료되었을 때 안내하는 페이지입니다. 숏.한국/코드 또는 숏.한국/닉네임/코드 형태의 주소를 사용해 주세요.',
};

export default function MissingShortLinkPage() {
  return (
    <>
      <Header />
      <main>
        <div className="not-found-page">
          <div className="not-found-code">404</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '12px' }}>
            단축 링크를 찾을 수 없습니다
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', maxWidth: '440px' }}>
            이 주소(<strong>/missing.link</strong>)는 단축 코드가 아니라, 잘못되었거나 만료된 단축
            링크를 찾았을 때만 안내하기 위해 쓰는 페이지입니다. 데이터베이스 연결 오류가 아닙니다.
          </p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '440px' }}>
            원하시는 페이지로 가려면{' '}
            <strong>숏.한국/단축코드</strong> 또는 <strong>숏.한국/닉네임/단축코드</strong>처럼
            실제로 만든 단축 주소를 주소창에 입력해 주세요.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link href="/" className="btn btn-primary">
              홈으로 이동
            </Link>
            <Link href="/faq" className="btn btn-secondary">
              자주 묻는 질문
            </Link>
            <Link href="/guide" className="btn btn-secondary">
              사용 가이드
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
