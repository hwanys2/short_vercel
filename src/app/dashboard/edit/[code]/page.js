'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function EditUrlPage() {
  const router = useRouter();
  const params = useParams();
  const routeCode = typeof params?.code === 'string' ? params.code : params?.code?.[0] ?? '';

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalUrl, setOriginalUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [error, setError] = useState('');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://숏.한국/';

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          router.replace('/login');
        } else {
          setUser(data.user);
        }
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoadingUser(false));
  }, [router]);

  const loadUrl = useCallback(async () => {
    if (!routeCode || !user) return;
    setLoadingUrl(true);
    setError('');
    try {
      const res = await fetch(`/api/urls/${encodeURIComponent(routeCode)}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'URL을 불러올 수 없습니다.');
        setOriginalUrl('');
        setCustomCode('');
        return;
      }
      setOriginalUrl(data.url.original_url);
      setCustomCode(data.url.code);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoadingUrl(false);
    }
  }, [routeCode, user]);

  useEffect(() => {
    if (user) loadUrl();
  }, [user, loadUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/urls/${encodeURIComponent(routeCode)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_url: originalUrl, custom_code: customCode }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || '수정에 실패했습니다.');
        return;
      }
      alert(data.message || 'URL이 수정되었습니다.');
      router.replace('/dashboard');
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser || !user) {
    return (
      <>
        <Header />
        <main className="dashboard-page">
          <div className="container" style={{ textAlign: 'center', padding: '48px' }}>
            <span className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="dashboard-page">
        <div className="container">
          <div className="dashboard-header">
            <h1>URL 수정</h1>
            <div className="user-badge">
              단축 주소: {baseUrl}
              {user.username}/코드
            </div>
          </div>

          <div className="card" style={{ maxWidth: '800px', margin: '0 auto 24px' }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <span>✏️ 단축 URL 편집</span>
              <Link href="/dashboard" className="btn btn-secondary btn-sm">
                대시보드로
              </Link>
            </div>
            <div className="card-body">
              {loadingUrl ? (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <span className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
                </div>
              ) : error && !originalUrl && !customCode ? (
                <div className="alert alert-danger">⚠️ {error}</div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>⚠️ {error}</div>}
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-original">원본 URL</label>
                    <input
                      id="edit-original"
                      type="url"
                      className="form-input"
                      placeholder="https://example.com"
                      value={originalUrl}
                      onChange={(e) => setOriginalUrl(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-code">단축 코드</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {user.username}/
                      </span>
                      <input
                        id="edit-code"
                        type="text"
                        className="form-input"
                        style={{ flex: '1', minWidth: '140px' }}
                        placeholder="원하는코드"
                        value={customCode}
                        onChange={(e) => setCustomCode(e.target.value)}
                        required
                        pattern="[가-힣a-zA-Z0-9_-]+"
                        title="한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? '저장 중...' : '저장'}
                    </button>
                    <Link href="/dashboard" className="btn btn-secondary">
                      취소
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
