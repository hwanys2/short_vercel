'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const USERNAME_REGEX = /^[가-힣a-zA-Z0-9_\-]+$/;

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          router.replace('/login');
          return;
        }
        if (!data.needsOnboarding && data.user?.username) {
          router.replace('/dashboard');
          return;
        }
        setEmail(data.user?.email || '');
      })
      .catch(() => router.replace('/login'))
      .finally(() => setChecking(false));
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!USERNAME_REGEX.test(username.trim())) {
      setError('닉네임은 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(data.message || '닉네임 설정에 실패했습니다.');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-body" style={{ textAlign: 'center' }}>
            <span className="spinner" /> 확인 중...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" className="logo" style={{ fontSize: '2rem' }}>
            숏.한국
          </Link>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            단축 주소에 사용할 본인 코드를 설정해주세요.
          </p>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <h2>본인 코드 설정</h2>
          </div>
          <div className="auth-body">
            {email && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                로그인 계정: {email}
              </p>
            )}
            {error && <div className="alert alert-danger">⚠️ {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="onboard-username">
                  닉네임 (본인 코드)
                </label>
                <input
                  id="onboard-username"
                  type="text"
                  className="form-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  maxLength={50}
                />
                <small
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  숏.한국/<strong>{username || '닉네임'}</strong>/단축코드 — 가입 후 변경이 어렵습니다.
                </small>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '8px' }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> 저장 중...
                  </>
                ) : (
                  '시작하기'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
