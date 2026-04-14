import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = { title: '이용약관 | 숏.한국' };

export default function TermsPage() {
  return (
    <>
      <Header />
      <main>
        <div className="static-page">
          <h1>이용약관</h1>
          <p className="page-desc">숏.한국 서비스 이용약관입니다.</p>

          <h2>제1조 (목적)</h2>
          <p>이 약관은 숏.한국(이하 &quot;서비스&quot;)의 이용에 관한 기본적인 사항을 규정함을 목적으로 합니다.</p>

          <h2>제2조 (서비스의 내용)</h2>
          <p>서비스는 긴 URL을 짧은 주소로 변환하는 URL 단축 서비스를 제공합니다.</p>
          <ul>
            <li>비회원: 최대 1개월간 유지되는 단축 URL 생성</li>
            <li>회원: 영구적으로 유지되는 개인 단축 URL 생성 및 관리</li>
          </ul>

          <h2>제3조 (이용자의 의무)</h2>
          <ul>
            <li>불법적인 콘텐츠에 대한 URL 단축은 금지됩니다.</li>
            <li>악성코드, 피싱, 스팸 등의 목적으로 서비스를 사용할 수 없습니다.</li>
            <li>서비스의 정상적인 운영을 방해하는 행위는 금지됩니다.</li>
          </ul>

          <h2>제4조 (서비스의 변경 및 중단)</h2>
          <p>서비스는 운영상 필요한 경우 서비스의 내용을 변경하거나 중단할 수 있으며, 이 경우 사전에 공지합니다.</p>

          <h2>제5조 (면책 조항)</h2>
          <p>서비스는 단축 URL이 가리키는 외부 사이트의 내용에 대해 책임지지 않습니다. URL 단축 서비스의 가용성에 대해 최선을 다하지만, 100% 보장하지는 않습니다.</p>

          <h2>제6조 (개인정보 보호)</h2>
          <p>개인정보 처리에 관한 사항은 <a href="/privacy">개인정보처리방침</a>에 따릅니다.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
