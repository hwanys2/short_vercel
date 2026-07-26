'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { buildShortUrl } from '@/lib/siteUrl';

export default function FileViewContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const username = searchParams.get('username');

  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!code) {
      setError(true);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ code });
    if (username) params.set('username', username);

    fetch(`/api/file-meta?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMeta(data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [code, username]);

  const shortUrl = buildShortUrl({ code, username: username || undefined });

  const downloadHref = (() => {
    const params = new URLSearchParams({ code: code || '' });
    if (username) params.set('username', username);
    return `/api/file-download?${params}`;
  })();

  if (loading) {
    return (
      <>
        <Header />
        <main>
          <div className="text-viewer-page">
            <div className="text-viewer-card">
              <div className="text-viewer-loading">
                <span className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
                <p>파일을 불러오는 중...</p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (error || !meta) {
    return (
      <>
        <Header />
        <main>
          <div className="text-viewer-page">
            <div className="text-viewer-card">
              <div className="text-viewer-error">
                <div className="text-viewer-error-icon">😢</div>
                <h2>파일을 찾을 수 없습니다</h2>
                <p>요청하신 단축 주소가 없거나 만료·삭제되었습니다.</p>
                <Link href="/" className="btn btn-primary">
                  숏.한국 홈으로
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main>
        <div className="text-viewer-page">
          <div className="text-viewer-card">
            <div className="text-viewer-header">
              <div className="text-viewer-header-left">
                <div className="text-viewer-icon">📎</div>
                <div>
                  <h2 className="text-viewer-title">공유된 파일</h2>
                  <div className="text-viewer-meta">
                    <span>{meta.file_size_label}</span>
                    {meta.file_mime ? (
                      <>
                        <span className="text-viewer-meta-dot">·</span>
                        <span>{meta.file_mime}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
              <a className="btn btn-primary text-viewer-copy-btn" href={downloadHref}>
                ⬇ 다운로드
              </a>
            </div>

            <div className="text-viewer-body" style={{ padding: '28px 24px' }}>
              <p style={{ margin: 0, fontSize: '1.05rem', wordBreak: 'break-all' }}>
                <strong>{meta.file_name}</strong>
              </p>
              <p style={{ margin: '12px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                링크가 만료되거나 삭제되면 파일도 함께 제거됩니다.
              </p>
            </div>

            <div className="text-viewer-footer">
              <div className="text-viewer-source">
                <span className="text-viewer-source-label">단축 주소</span>
                <code className="text-viewer-source-url">{shortUrl}</code>
              </div>
              <div className="text-viewer-footer-actions">
                <a className="btn btn-primary btn-sm" href={downloadHref}>
                  ⬇ 다운로드
                </a>
                <Link href="/" className="btn btn-secondary btn-sm">
                  나도 만들기
                </Link>
              </div>
            </div>
          </div>

          <p className="text-viewer-branding">
            <Link href="/">숏.한국</Link>으로 URL·텍스트·파일을 간편하게 공유하세요
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
