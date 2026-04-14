import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = { title: '개인정보처리방침 | 숏.한국' };

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main>
        <div className="static-page">
          <h1>개인정보처리방침</h1>
          <p className="page-desc">숏.한국의 개인정보 처리에 관한 방침입니다.</p>

          <h2>1. 수집하는 개인정보</h2>
          <ul>
            <li><strong>회원가입 시:</strong> 닉네임, 이메일, 비밀번호(암호화 저장)</li>
            <li><strong>서비스 이용 시:</strong> URL 접속 기록, 방문 횟수</li>
          </ul>

          <h2>2. 개인정보의 이용 목적</h2>
          <ul>
            <li>서비스 제공 및 회원 관리</li>
            <li>URL 단축 서비스 운영</li>
            <li>서비스 개선 및 통계 분석</li>
          </ul>

          <h2>3. 개인정보의 보관 기간</h2>
          <p>회원 정보는 회원 탈퇴 시까지 보관되며, 탈퇴 시 즉시 삭제됩니다. 비회원 URL 정보는 만료 기간 경과 후 자동으로 삭제됩니다.</p>

          <h2>4. 개인정보의 제3자 제공</h2>
          <p>숏.한국은 이용자의 개인정보를 제3자에게 제공하지 않습니다.</p>

          <h2>5. 개인정보의 보호</h2>
          <p>비밀번호는 bcrypt 알고리즘으로 암호화하여 저장하며, SSL/TLS 암호화 통신을 사용합니다.</p>

          <h2>6. 이용자의 권리</h2>
          <ul>
            <li>언제든지 회원 정보를 조회, 수정, 삭제할 수 있습니다.</li>
            <li>회원탈퇴를 통해 모든 개인정보를 삭제할 수 있습니다.</li>
          </ul>

          <h2>7. 문의</h2>
          <p>개인정보 관련 문의는 <a href="/contact">문의 페이지</a>를 이용해주세요.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
