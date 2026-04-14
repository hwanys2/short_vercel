'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sanitizeAsciiPasswordInput } from '@/lib/passwordInput';

export default function LoginPage() {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.message);
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" className="logo" style={{ fontSize: '2rem' }}>
            숏.한국
          </Link>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            회원으로 로그인하여 영구적인 단축 URL을 만들어보세요.
          </p>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <h2>🔐 로그인</h2>
          </div>
          <div className="auth-body">
            {error && <div className="alert alert-danger">⚠️ {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">이메일 또는 닉네임</label>
                <input
                  id="login-email"
                  type="text"
                  className="form-input"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  비밀번호
                  <span
                    style={{
                      fontWeight: 400,
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      marginLeft: '8px',
                    }}
                  >
                    (영문·숫자로 입력)
                  </span>
                </label>
                <input
                  id="login-password"
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(sanitizeAsciiPasswordInput(e.target.value))}
                  required
                  autoComplete="current-password"
                  lang="en"
                  inputMode="latin"
                  spellCheck={false}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  한글은 입력되지 않습니다.
                </small>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
                {loading ? <><span className="spinner" /> 로그인 중...</> : '로그인'}
              </button>
            </form>

            <div className="auth-option">
              계정이 없으신가요? <Link href="/register">회원가입</Link>
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
