'use client';

import Link from 'next/link';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function RegisterPage() {
  return (
    <div className="auth-page">
      <div>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" className="logo" style={{ fontSize: '2rem' }}>
            숏.한국
          </Link>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Google로 가입한 뒤, 단축 주소용 본인 코드를 설정합니다.
          </p>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <h2>회원가입</h2>
          </div>
          <div className="auth-body">
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.95rem',
                lineHeight: 1.6,
                marginBottom: '20px',
              }}
            >
              신규 가입은 <strong>Google 계정만</strong> 지원합니다.
              <br />
              가입 직후 <strong>숏.한국/본인코드/단축코드</strong>에 쓸 닉네임을 직접 정합니다.
            </p>

            <GoogleSignInButton label="Google로 가입하기" intent="signup" />

            <ol
              style={{
                marginTop: '24px',
                paddingLeft: '1.2rem',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                lineHeight: 1.7,
              }}
            >
              <li>Google 계정으로 인증합니다.</li>
              <li>본인 코드(닉네임)를 입력합니다.</li>
              <li>대시보드에서 영구 단축 URL을 만듭니다.</li>
            </ol>

            <div className="auth-option" style={{ marginTop: '20px' }}>
              이미 계정이 있으신가요? <Link href="/login">로그인</Link>
            </div>
          </div>
        </div>

        <div className="auth-back">
          <Link href="/">← 홈으로 돌아가기</Link>
        </div>
      </div>
    </div>
  );
}
