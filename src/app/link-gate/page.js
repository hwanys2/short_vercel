'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function LinkGateInner() {
  const searchParams = useSearchParams();
  const username = searchParams.get('username')?.trim() ?? '';
  const code = searchParams.get('code')?.trim() ?? '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://숏.한국/').replace(/\/+$/, '');

  useEffect(() => {
    if (!username || !code) {
      setError('잘못된 링크입니다.');
    }
  }, [username, code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !code) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/link-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, code, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        setError(data.message || '비밀번호가 올바르지 않습니다.');
        return;
      }
      const path = `${encodeURIComponent(username)}/${encodeURIComponent(code)}`;
      window.location.assign(`${baseUrl}/${path}`);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="dashboard-page">
        <div className="container">
          <div className="card" style={{ maxWidth: '480px', margin: '48px auto' }}>
            <div className="card-header">비밀번호가 필요한 링크입니다</div>
            <div className="card-body">
              {username && code && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                  <span style={{ wordBreak: 'break-all' }}>
                    {baseUrl}/{username}/{code}
                  </span>
                  로 이동하려면 아래에 비밀번호를 입력하세요.
                </p>
              )}
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label" htmlFor="link-password">
                    비밀번호
                  </label>
                  <input
                    id="link-password"
                    type="password"
                    className="form-input"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!username || !code}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary" disabled={submitting || !username || !code}>
                    {submitting ? '확인 중...' : '이동'}
                  </button>
                  <Link href="/" className="btn btn-secondary">
                    홈으로
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function LinkGatePage() {
  return (
    <Suspense
      fallback={
        <>
          <Header />
          <main className="dashboard-page">
            <div className="container" style={{ textAlign: 'center', padding: '48px' }}>
              <span className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
            </div>
          </main>
          <Footer />
        </>
      }
    >
      <LinkGateInner />
    </Suspense>
  );
}
