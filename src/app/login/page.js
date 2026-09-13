'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { sanitizeAsciiPasswordInput } from '@/lib/passwordInput';
import Turnstile from '@/components/Turnstile';
import GoogleSignInButton from '@/components/GoogleSignInButton';

const ERROR_MESSAGES = {
  auth_callback: '로그인에 실패했습니다. 다시 시도해주세요.',
  auth_exchange: '인증 처리에 실패했습니다. 다시 시도해주세요.',
  no_email: '이메일 정보를 가져올 수 없습니다.',
  email_unverified: '이메일이 확인되지 않은 계정입니다.',
  account_conflict:
    '이 이메일은 이미 다른 계정에 연결되어 있습니다. 기존 방식으로 로그인해 주세요.',
  link_failed: '계정 연동에 실패했습니다. 잠시 후 다시 시도해주세요.',
  already_registered:
    '이미 가입된 이메일입니다. Google 또는 기존 아이디(비밀번호)로 로그인해 주세요.',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err && ERROR_MESSAGES[err]) {
      setError(ERROR_MESSAGES[err]);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password, turnstileToken }),
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

            <GoogleSignInButton
              label="Google 계정으로 로그인"
              disabled={loading}
              style={{ marginTop: 0 }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '24px 0 20px',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ flex: 1, height: 1, background: 'var(--border, #ddd)' }} />
              또는 아이디로 로그인
              <div style={{ flex: 1, height: 1, background: 'var(--border, #ddd)' }} />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">
                  이메일 또는 닉네임
                </label>
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
                <small
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  한글은 입력되지 않습니다.
                </small>
              </div>

              <Turnstile
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken('')}
              />

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '8px' }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> 로그인 중...
                  </>
                ) : (
                  '아이디로 로그인'
                )}
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="auth-card">
            <div className="auth-body" style={{ textAlign: 'center' }}>
              <span className="spinner" /> 로딩 중...
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
