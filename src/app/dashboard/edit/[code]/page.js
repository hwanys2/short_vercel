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
  const [urlType, setUrlType] = useState('url'); // 'url' | 'text'
  const [originalUrl, setOriginalUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [hadPasswordProtection, setHadPasswordProtection] = useState(false);
  const [linkPassword, setLinkPassword] = useState('');
  const [confirmLinkPassword, setConfirmLinkPassword] = useState('');
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
        setTextContent('');
        setCustomCode('');
        return;
      }
      const type = data.url.type || 'url';
      setUrlType(type);
      setOriginalUrl(data.url.original_url);
      setTextContent(data.url.text_content || '');
      setCustomCode(data.url.code);
      const protectedNow = !!data.url.password_enabled;
      setPasswordEnabled(protectedNow);
      setHadPasswordProtection(protectedNow);
      setLinkPassword('');
      setConfirmLinkPassword('');
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

    if (passwordEnabled && linkPassword) {
      if (linkPassword.length < 6) {
        setError('링크 비밀번호는 6자 이상이어야 합니다.');
        return;
      }
      if (linkPassword !== confirmLinkPassword) {
        setError('비밀번호 확인이 일치하지 않습니다.');
        return;
      }
    }

    if (passwordEnabled && !linkPassword.trim() && !hadPasswordProtection) {
      setError('비밀번호 보호를 켤 경우 비밀번호를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        custom_code: customCode,
        link_password_enabled: passwordEnabled,
      };

      if (urlType === 'text') {
        payload.text_content = textContent;
      } else {
        payload.original_url = originalUrl;
      }

      if (passwordEnabled && linkPassword.trim()) {
        payload.link_password = linkPassword.trim();
      }

      const res = await fetch(`/api/urls/${encodeURIComponent(routeCode)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || '수정에 실패했습니다.');
        return;
      }
      alert(data.message || '수정되었습니다.');
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

  const isText = urlType === 'text';
  const pageTitle = isText ? '텍스트 수정' : 'URL 수정';
  const cardTitle = isText ? '📋 텍스트 편집' : '✏️ 단축 URL 편집';

  return (
    <>
      <Header />
      <main className="dashboard-page">
        <div className="container">
          <div className="dashboard-header">
            <h1>{pageTitle}</h1>
            <div className="user-badge">
              단축 주소: {baseUrl}
              {user.username}/코드
            </div>
          </div>

          <div className="card" style={{ maxWidth: '800px', margin: '0 auto 24px' }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <span>{cardTitle}</span>
              <Link href="/dashboard" className="btn btn-secondary btn-sm">
                대시보드로
              </Link>
            </div>
            <div className="card-body">
              {loadingUrl ? (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <span className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
                </div>
              ) : error && !customCode ? (
                <div className="alert alert-danger">⚠️ {error}</div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>⚠️ {error}</div>}

                  {/* URL 타입: 원본 URL 입력 */}
                  {!isText && (
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
                  )}

                  {/* 텍스트 타입: 텍스트 내용 입력 */}
                  {isText && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-text-content">텍스트 내용</label>
                      <textarea
                        id="edit-text-content"
                        className="form-input form-textarea"
                        placeholder="공유할 텍스트를 입력하세요"
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        required
                        rows={8}
                        maxLength={50000}
                      />
                      {textContent.length > 0 && (
                        <div className="form-textarea-counter">
                          {textContent.length.toLocaleString()} / 50,000자
                        </div>
                      )}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={passwordEnabled}
                        onChange={(e) => {
                          setPasswordEnabled(e.target.checked);
                          if (!e.target.checked) {
                            setLinkPassword('');
                            setConfirmLinkPassword('');
                          }
                        }}
                      />
                      비밀번호로 보호 (단축 주소 방문 시 비밀번호 입력 후 이동)
                    </label>
                  </div>
                  {passwordEnabled && (
                    <>
                      <div className="form-group">
                        <label className="form-label" htmlFor="edit-link-password">
                          링크 비밀번호{hadPasswordProtection ? ' (변경 시에만 입력)' : ''}
                        </label>
                        <input
                          id="edit-link-password"
                          type="password"
                          className="form-input"
                          autoComplete="new-password"
                          placeholder={hadPasswordProtection ? '변경하지 않으려면 비워 두세요' : '6자 이상'}
                          value={linkPassword}
                          onChange={(e) => setLinkPassword(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="edit-link-password-confirm">비밀번호 확인</label>
                        <input
                          id="edit-link-password-confirm"
                          type="password"
                          className="form-input"
                          autoComplete="new-password"
                          placeholder="비밀번호를 다시 입력하세요"
                          value={confirmLinkPassword}
                          onChange={(e) => setConfirmLinkPassword(e.target.value)}
                        />
                      </div>
                    </>
                  )}
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
