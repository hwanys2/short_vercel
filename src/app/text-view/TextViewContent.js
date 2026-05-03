'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function TextViewContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const username = searchParams.get('username');

  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const fallbackRef = useRef(null);

  useEffect(() => {
    if (!code) {
      setError(true);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ code });
    if (username) params.set('username', username);

    fetch(`/api/text-content?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTextContent(data.text_content);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [code, username]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Fallback for older browsers
      if (fallbackRef.current) {
        fallbackRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      }
    }
  }, [textContent]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://숏.한국/';
  const shortUrl = username
    ? `${baseUrl}${username}/${code}`
    : `${baseUrl}${code}`;

  const charCount = textContent.length;
  const lineCount = textContent ? textContent.split('\n').length : 0;

  if (loading) {
    return (
      <>
        <Header />
        <main>
          <div className="text-viewer-page">
            <div className="text-viewer-card">
              <div className="text-viewer-loading">
                <span className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
                <p>텍스트를 불러오는 중...</p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <main>
          <div className="text-viewer-page">
            <div className="text-viewer-card">
              <div className="text-viewer-error">
                <div className="text-viewer-error-icon">😢</div>
                <h2>텍스트를 찾을 수 없습니다</h2>
                <p>요청하신 단축 주소가 없거나 만료되었습니다.</p>
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
            {/* Header */}
            <div className="text-viewer-header">
              <div className="text-viewer-header-left">
                <div className="text-viewer-icon">📋</div>
                <div>
                  <h2 className="text-viewer-title">공유된 텍스트</h2>
                  <div className="text-viewer-meta">
                    <span>{charCount.toLocaleString()}자</span>
                    <span className="text-viewer-meta-dot">·</span>
                    <span>{lineCount.toLocaleString()}줄</span>
                  </div>
                </div>
              </div>
              <button
                className={`btn text-viewer-copy-btn ${copied ? 'is-copied' : 'btn-primary'}`}
                onClick={handleCopy}
                type="button"
              >
                {copied ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    복사 완료!
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    전체 복사
                  </>
                )}
              </button>
            </div>

            {/* Text Content */}
            <div className="text-viewer-body">
              <pre className="text-viewer-content">{textContent}</pre>
            </div>

            {/* Footer bar */}
            <div className="text-viewer-footer">
              <div className="text-viewer-source">
                <span className="text-viewer-source-label">단축 주소</span>
                <code className="text-viewer-source-url">{shortUrl}</code>
              </div>
              <div className="text-viewer-footer-actions">
                <button
                  className={`btn btn-sm ${copied ? 'text-viewer-copy-btn is-copied' : 'btn-primary'}`}
                  onClick={handleCopy}
                  type="button"
                >
                  {copied ? '✓ 복사됨' : '📋 전체 복사'}
                </button>
                <Link href="/" className="btn btn-secondary btn-sm">
                  나도 만들기
                </Link>
              </div>
            </div>
          </div>

          {/* Branding */}
          <p className="text-viewer-branding">
            <Link href="/">숏.한국</Link>으로 텍스트·URL을 간편하게 공유하세요
          </p>
        </div>
      </main>
      <Footer />

      {/* Hidden textarea fallback for copy */}
      <textarea
        ref={fallbackRef}
        value={textContent}
        readOnly
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
        }}
      />
    </>
  );
}
