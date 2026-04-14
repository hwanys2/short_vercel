'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sanitizeAsciiPasswordInput } from '@/lib/passwordInput';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '', password_confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.password_confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (form.password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    if (!/^[가-힣a-zA-Z0-9_-]+$/.test(form.username)) {
      setError('닉네임은 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
            회원으로 가입하여 영구적인 단축 URL을 만들어보세요.
          </p>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <h2>👤 회원가입</h2>
          </div>
          <div className="auth-body">
            {error && <div className="alert alert-danger">⚠️ {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-username">닉네임</label>
                <input
                  id="reg-username"
                  type="text"
                  className="form-input"
                  value={form.username}
                  onChange={(e) => update('username', e.target.value)}
                  required
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                  숏.한국/<strong>{form.username || '닉네임'}</strong>/단축코드 형태로 사용됩니다.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">이메일</label>
                <input
                  id="reg-email"
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">
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
                  id="reg-password"
                  type="password"
                  className="form-input"
                  value={form.password}
                  onChange={(e) => update('password', sanitizeAsciiPasswordInput(e.target.value))}
                  required
                  lang="en"
                  inputMode="latin"
                  spellCheck={false}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                  ℹ️ 최소 8자, 영문·숫자·기호(반각)만 사용됩니다. 한글 입력은 자동으로 제외됩니다.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-password-confirm">
                  비밀번호 확인
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
                  id="reg-password-confirm"
                  type="password"
                  className="form-input"
                  value={form.password_confirm}
                  onChange={(e) => update('password_confirm', sanitizeAsciiPasswordInput(e.target.value))}
                  required
                  lang="en"
                  inputMode="latin"
                  spellCheck={false}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
                {loading ? <><span className="spinner" /> 가입 중...</> : '회원가입'}
              </button>
            </form>

            <div className="auth-option">
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
