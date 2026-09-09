'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { buildShortUrl } from '@/lib/siteUrl';

export default function TextViewContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const username = searchParams.get('username');

  const [originalContent, setOriginalContent] = useState('');
  const [editableContent, setEditableContent] = useState('');
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
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
          setOriginalContent(data.text_content);
          setEditableContent(data.text_content);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [code, username]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editableContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      if (fallbackRef.current) {
        fallbackRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      }
    }
  }, [editableContent]);

  const handleReset = useCallback(() => {
    setEditableContent(originalContent);
  }, [originalContent]);

  const shortUrl = buildShortUrl({ code, username: username || undefined });

  const isModified = editableContent !== originalContent;
  const charCount = editableContent.length;
  const lineCount = editableContent ? editableContent.split('\n').length : 0;

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
            <div className="text-viewer-header">
              <div className="text-viewer-header-left">
                <div className="text-viewer-icon">📋</div>
                <div>
                  <h2 className="text-viewer-title">공유된 텍스트</h2>
                  <div className="text-viewer-meta">
                    <span>{charCount.toLocaleString()}자</span>
                    <span className="text-viewer-meta-dot">·</span>
                    <span>{lineCount.toLocaleString()}줄</span>
                    {isModified && (
                      <>
                        <span className="text-viewer-meta-dot">·</span>
                        <span className="text-viewer-meta-modified">수정됨</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-viewer-header-actions">
                <div className="text-viewer-mode-tabs" role="tablist" aria-label="보기 모드">
                  <button
                    type="button"
                    role="tab"
                    className={`text-viewer-mode-tab ${mode === 'view' ? 'is-active' : ''}`}
                    aria-selected={mode === 'view'}
                    onClick={() => setMode('view')}
                  >
                    마크다운
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`text-viewer-mode-tab ${mode === 'edit' ? 'is-active' : ''}`}
                    aria-selected={mode === 'edit'}
                    onClick={() => setMode('edit')}
                  >
                    편집
                  </button>
                </div>
                <button
                  className={`btn text-viewer-copy-btn ${copied ? 'is-copied' : 'btn-primary'}`}
                  onClick={handleCopy}
                  type="button"
                >
                  {copied ? '복사 완료!' : '복사하기'}
                </button>
              </div>
            </div>

            <p className="text-viewer-edit-hint">
              {mode === 'view'
                ? '마크다운으로 렌더링됩니다. 편집 탭에서 복사 전 내용을 수정할 수 있습니다. 원본은 변경되지 않습니다.'
                : '복사 전 내용을 자유롭게 수정할 수 있습니다. 원본 데이터는 변경되지 않습니다.'}
            </p>
            <div className="text-viewer-body">
              {mode === 'view' ? (
                <div className="text-viewer-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                    {editableContent || ' '}
                  </ReactMarkdown>
                </div>
              ) : (
                <textarea
                  className="text-viewer-content text-viewer-editor"
                  value={editableContent}
                  onChange={(e) => setEditableContent(e.target.value)}
                  spellCheck={false}
                  aria-label="공유된 텍스트 (복사 전 수정 가능)"
                />
              )}
            </div>

            <div className="text-viewer-footer">
              <div className="text-viewer-source">
                <span className="text-viewer-source-label">단축 주소</span>
                <code className="text-viewer-source-url">{shortUrl}</code>
              </div>
              <div className="text-viewer-footer-actions">
                {isModified && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleReset}
                    type="button"
                  >
                    원본으로 되돌리기
                  </button>
                )}
                <button
                  className={`btn btn-sm ${copied ? 'text-viewer-copy-btn is-copied' : 'btn-primary'}`}
                  onClick={handleCopy}
                  type="button"
                >
                  {copied ? '✓ 복사됨' : '📋 복사하기'}
                </button>
                <Link href="/" className="btn btn-secondary btn-sm">
                  나도 만들기
                </Link>
              </div>
            </div>
          </div>

          <p className="text-viewer-branding">
            <Link href="/">숏.한국</Link>으로 텍스트·URL을 간편하게 공유하세요
          </p>
        </div>
      </main>
      <Footer />

      <textarea
        ref={fallbackRef}
        value={editableContent}
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
