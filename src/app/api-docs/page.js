import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = { title: 'API 문서 | 숏.한국' };

export default function ApiDocsPage() {
  return (
    <>
      <Header />
      <main>
        <div className="static-page">
          <h1>API 문서</h1>
          <p className="page-desc">숏.한국 URL 단축 API를 사용하여 프로그래밍 방식으로 URL을 단축하세요.</p>

          <h2>기본 정보</h2>
          <ul>
            <li><strong>Base URL:</strong> <code>https://숏.한국/api/v1/shorten</code></li>
            <li><strong>형식:</strong> JSON</li>
            <li><strong>인증:</strong> 현재 인증 없이 사용 가능</li>
          </ul>

          <h2>URL 단축 요청</h2>
          <h3>POST /api/v1/shorten</h3>

          <p><strong>요청 파라미터:</strong></p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>파라미터</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>필수</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>설명</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: '8px' }}><code>original_url</code></td><td>✅</td><td>단축할 원본 URL</td></tr>
              <tr><td style={{ padding: '8px' }}><code>custom_code</code></td><td>❌</td><td>사용자 지정 단축 코드 (미입력시 자동 생성)</td></tr>
              <tr><td style={{ padding: '8px' }}><code>expire_duration</code></td><td>❌</td><td>만료 기간: 24h, 48h, 1week, 1month</td></tr>
            </tbody>
          </table>

          <p><strong>예제 요청:</strong></p>
          <pre><code>{`curl -X POST https://숏.한국/api/v1/shorten \\
  -H "Content-Type: application/json" \\
  -d '{
    "original_url": "https://example.com/very-long-url",
    "custom_code": "예제",
    "expire_duration": "1week"
  }'`}</code></pre>

          <p><strong>성공 응답 (201):</strong></p>
          <pre><code>{`{
  "status": "success",
  "message": "URL이 성공적으로 단축되었습니다.",
  "data": {
    "short_url": "https://숏.한국/예제",
    "original_url": "https://example.com/very-long-url",
    "code": "예제",
    "expiration_date": "2026-04-21T10:00:00.000Z"
  }
}`}</code></pre>

          <p><strong>에러 응답:</strong></p>
          <pre><code>{`{
  "status": "error",
  "message": "이미 사용 중인 단축 코드입니다."
}`}</code></pre>

          <h2>API 정보 확인</h2>
          <h3>GET /api/v1/shorten</h3>
          <p>API 엔드포인트 정보와 사용 가능한 파라미터를 반환합니다.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
