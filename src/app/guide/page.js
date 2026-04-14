import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { buildPageMetadata } from '@/lib/siteMetadata';

export const metadata = buildPageMetadata({
  pathname: '/guide',
  title: '사용 가이드 | 숏.한국',
  description:
    '숏.한국 사용 방법: 비회원·회원 URL 단축, 한글 코드, 만료 기간, 대시보드 관리까지 단계별로 안내합니다.',
});

export default function GuidePage() {
  return (
    <>
      <Header />
      <main>
        <div className="static-page">
          <h1>사용 가이드</h1>
          <p className="page-desc">숏.한국 서비스를 쉽게 사용하는 방법을 안내합니다.</p>

          <h2>1. 비회원 URL 단축</h2>
          <p>메인 페이지에서 바로 URL을 단축할 수 있습니다.</p>
          <ol>
            <li>원본 URL을 입력합니다.</li>
            <li>원하는 단축 코드를 입력합니다. (한글, 영문, 숫자 가능)</li>
            <li>만료 기간을 선택합니다. (24시간, 48시간, 1주일, 1개월)</li>
            <li>&quot;URL 단축하기&quot; 버튼을 클릭합니다.</li>
          </ol>

          <h2>2. 회원 URL 단축 (영구)</h2>
          <p>회원가입 후 로그인하면 영구적으로 유지되는 URL을 만들 수 있습니다.</p>
          <ol>
            <li>회원가입 또는 로그인을 합니다.</li>
            <li>메인 페이지 또는 대시보드에서 URL을 생성합니다.</li>
            <li>생성된 URL은 &quot;숏.한국/닉네임/코드&quot; 형태입니다.</li>
            <li>대시보드에서 모든 URL을 관리할 수 있습니다.</li>
          </ol>

          <h2>3. 대시보드 사용</h2>
          <p>로그인 후 대시보드에서 다음 기능을 사용할 수 있습니다:</p>
          <ul>
            <li>새 URL 생성</li>
            <li>기존 URL 목록 확인</li>
            <li>각 URL의 클릭 통계 확인</li>
            <li>URL 복사 및 삭제</li>
          </ul>

          <h2>4. QR 코드 활용</h2>
          <p>URL 단축 후 자동으로 QR 코드가 생성됩니다. 이 QR 코드를 수업 자료, 인쇄물, 발표 자료 등에 활용하세요.</p>

          <h2>5. API 활용</h2>
          <p>개발자라면 API를 통해 프로그래밍 방식으로 URL을 단축할 수 있습니다. 자세한 내용은 <a href="/api-docs">API 문서</a>를 참고하세요.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
