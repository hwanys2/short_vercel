import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = { title: '블로그 | 숏.한국' };

export default function BlogPage() {
  return (
    <>
      <Header />
      <main>
        <div className="static-page">
          <h1>블로그</h1>
          <p className="page-desc">숏.한국의 소식과 사용 팁을 안내합니다.</p>

          <article className="card" style={{ marginBottom: '24px' }}>
            <div className="card-body">
              <h2 style={{ fontSize: '1.3rem', marginTop: 0 }}>🚀 숏.한국 서비스 업데이트 안내</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>2026년 4월</p>
              <p>숏.한국이 더 빠르고 안정적인 서비스를 위해 인프라를 업그레이드했습니다. 새로운 기능과 개선된 성능을 경험해보세요.</p>
              <ul>
                <li>더 빠른 응답 속도</li>
                <li>개선된 UI/UX</li>
                <li>안정적인 서버 인프라</li>
              </ul>
            </div>
          </article>

          <article className="card" style={{ marginBottom: '24px' }}>
            <div className="card-body">
              <h2 style={{ fontSize: '1.3rem', marginTop: 0 }}>📚 교사를 위한 숏.한국 활용 팁</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>2025년</p>
              <p>교실에서 숏.한국을 효과적으로 활용하는 방법을 소개합니다.</p>
              <ul>
                <li>수업 자료 링크를 한글 URL로 공유하기</li>
                <li>QR 코드를 활용한 학습지 연결</li>
                <li>학생들이 쉽게 접속할 수 있는 짧은 주소 만들기</li>
              </ul>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
