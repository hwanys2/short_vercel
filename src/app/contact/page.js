import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = { title: '문의 | 숏.한국' };

export default function ContactPage() {
  return (
    <>
      <Header />
      <main>
        <div className="static-page">
          <h1>문의</h1>
          <p className="page-desc">숏.한국 서비스에 대한 문의사항이 있으시면 아래 방법으로 연락해주세요.</p>

          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-body">
              <h3 style={{ marginBottom: '16px' }}>📧 이메일 문의</h3>
              <p>서비스 관련 문의, 버그 신고, 제안 사항 등이 있으시면 이메일로 연락해주세요.</p>
              <p><a href="mailto:hwanys2@naver.com">hwanys2@naver.com</a></p>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h3 style={{ marginBottom: '16px' }}>🔧 자주 발생하는 문제</h3>
              <ul>
                <li><strong>URL이 작동하지 않아요:</strong> 비회원 URL은 만료 기간이 지나면 자동으로 삭제됩니다.</li>
                <li><strong>로그인이 안 돼요:</strong> 비밀번호는 영문, 숫자, 특수문자만 사용 가능합니다.</li>
                <li><strong>단축 코드가 이미 사용 중이에요:</strong> 다른 사용자가 이미 사용 중인 코드일 수 있습니다. 다른 코드를 시도해보세요.</li>
              </ul>
              <p style={{ marginTop: '12px' }}>자세한 내용은 <a href="/faq">자주 묻는 질문</a> 페이지를 확인해주세요.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
