import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { buildPageMetadata } from '@/lib/siteMetadata';

export const metadata = buildPageMetadata({
  pathname: '/guide',
  title: '사용 가이드 | 숏.한국',
  description:
    '숏.한국 사용 방법: 비회원·회원 URL 단축, 텍스트·파일 공유, 한글 코드, 만료 기간, 대시보드 관리까지 단계별로 안내합니다.',
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

          <h2>2. 텍스트 공유</h2>
          <p>메인 페이지에서 &quot;텍스트 공유&quot; 탭을 선택해 긴 텍스트를 단축 주소로 공유할 수 있습니다.</p>

          <h2>3. 파일 공유</h2>
          <p>문서·이미지·압축파일(ZIP 등)을 단축 주소로 공유할 수 있습니다. 모든 파일은 Cloudflare R2 스토리지로 초고속 직접 업로드됩니다. (최대 5GB 지원)</p>
          <ul>
            <li>허용: PDF, Office, HWP, TXT/HTML/MD/CSV, 이미지(PNG/JPG/GIF/WEBP), 압축파일(ZIP/7Z/TAR/GZ/RAR) 등 (실행 파일은 ZIP 압축 권장)</li>
            <li><strong>용량별 수명 주기(보관 및 자동 삭제) 규칙:</strong>
              <ul style={{ marginTop: '6px' }}>
                <li><strong>10MB 이하 (일반 파일):</strong> 30일간 보관 후 자동 삭제됩니다. (비회원은 만료 기간 설정 가능, 기본 30일)</li>
                <li><strong>10MB 초과 ~ 1GB (대용량 파일):</strong> 스토리지 자원 관리를 위해 7일간 보관 후 자동 삭제됩니다.</li>
                <li><strong>1GB 초과 ~ 5GB (초대용량 파일):</strong> 대용량 자원 보호를 위해 2일간 보관 후 자동 삭제됩니다.</li>
              </ul>
            </li>
            <li><strong>회원 파일 공유의 장점:</strong> 회원의 단축 주소는 영구 보존됩니다. 파일 보관 기간이 만료되면 다운로드가 차단되고 저장본이 삭제되지만 주소는 남습니다. 대시보드 [수정]에서 새 파일을 재등록하면 다운로드 기간이 다시 연장됩니다.</li>
          </ul>

          <h2>4. 회원 URL 단축 (영구)</h2>
          <p>회원가입 후 로그인하면 영구적으로 유지되는 URL·텍스트를 만들 수 있습니다. (파일 공유는 단축 주소가 유지되며 위 3번의 보관 기간 및 재등록 기능 적용)</p>
          <ol>
            <li>회원가입 또는 로그인을 합니다.</li>
            <li>메인 페이지 또는 대시보드에서 단축 주소를 생성합니다.</li>
            <li>생성된 URL은 &quot;숏.한국/닉네임/코드&quot; 형태입니다.</li>
            <li>대시보드에서 모든 링크를 관리할 수 있습니다.</li>
          </ol>

          <h2>5. 대시보드 사용</h2>
          <p>로그인 후 대시보드에서 다음 기능을 사용할 수 있습니다:</p>
          <ul>
            <li>새 URL·텍스트·파일 공유 생성</li>
            <li>기존 목록 확인</li>
            <li>각 링크의 클릭 통계 확인</li>
            <li>복사·수정·삭제</li>
          </ul>

          <h2>6. QR 코드 활용</h2>
          <p>단축 후 자동으로 QR 코드가 생성됩니다. 이 QR 코드를 수업 자료, 인쇄물, 발표 자료 등에 활용하세요.</p>

          <h2>7. API 활용</h2>
          <p>개발자라면 API를 통해 프로그래밍 방식으로 URL을 단축할 수 있습니다. 자세한 내용은 <a href="/api-docs">API 문서</a>를 참고하세요.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
