'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import {
  FILE_SHARE_NOTICE_GUEST,
  FILE_SHARE_NOTICE_MEMBER,
  formatFileSize,
  MAX_FILE_BYTES,
  getFileCapacityRetentionInfo,
} from '@/lib/shortFilesShared';
import { uploadShortFileAuto } from '@/lib/fileUploadClient';
import { useLinkScope, parseScopeSelectValue } from '@/lib/useLinkScope';
import { TEMP_SCOPE, TEMP_LINK_DURATION_OPTIONS } from '@/lib/tempLinks';

function cleanMacTextEditHtmlString(htmlString) {
  if (
    !htmlString ||
    (!htmlString.includes('Cocoa HTML Writer') &&
      !htmlString.includes('&lt;!DOCTYPE') &&
      !htmlString.includes('&lt;html'))
  ) {
    return htmlString;
  }
  const bodyMatch = htmlString.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : htmlString;
  content = content
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span class="Apple-converted-space">[\s\S]*?<\/span>/gi, ' ')
    .replace(/<[^>]+>/gi, '');
  content = content
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  return content.trim();
}

export default function UrlForm({ user, onResult }) {
  const [mode, setMode] = useState('url'); // 'url' | 'text' | 'file' | 'html'
  const [htmlInputMode, setHtmlInputMode] = useState('file'); // 'file' | 'paste'
  const [htmlCode, setHtmlCode] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState(null);
  const [customCode, setCustomCode] = useState('');
  const [expireDuration, setExpireDuration] = useState('1week');
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [linkPassword, setLinkPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState('');
  const abortControllerRef = useRef(null);

  // 로그인 사용자: 본인 코드(영구) 또는 임시 주소(숏.한국/코드) 선택
  const {
    scope: selectedScope,
    isTemp,
    codes: userCodes,
    activeUsername,
    setScope: setSelectedScope,
    selectValue: scopeSelectValue,
  } = useLinkScope(user);
  const isLoggedIn = Boolean(user?.id);
  /** 본인 코드로 영구 링크를 만드는 경우 */
  const isMemberPermanent = isLoggedIn && !isTemp;

  // 업로드 도중 사용자가 실수로 탭을 닫거나 새로고침하는 것을 방지
  useEffect(() => {
    if (!loading || !uploadProgress) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [loading, uploadProgress]);

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const baseUrl = '숏.한국/';
  const prefix = isMemberPermanent ? `${baseUrl}${activeUsername}/` : baseUrl;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (passwordProtect) {
      if (!linkPassword.trim() || linkPassword.trim().length < 6) {
        setError('링크 비밀번호는 6자 이상이어야 합니다.');
        return;
      }
      if (linkPassword !== confirmPassword) {
        setError('비밀번호 확인이 일치하지 않습니다.');
        return;
      }
    }

    if (mode === 'file' || mode === 'html') {
      if (mode === 'html' && htmlInputMode === 'paste') {
        if (!htmlCode.trim()) {
          setError('HTML 코드를 입력해주세요.');
          return;
        }
      } else if (!file) {
        setError(mode === 'html' ? 'HTML 파일을 선택해주세요.' : '파일을 선택해주세요.');
        return;
      }
      if (mode === 'html' && htmlInputMode !== 'paste' && file) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'html' && ext !== 'htm') {
          setError('HTML 파일(.html, .htm)만 업로드할 수 있습니다.');
          return;
        }
      }
      if (file && file.size > MAX_FILE_BYTES) {
        setError(`파일 크기는 최대 ${formatFileSize(MAX_FILE_BYTES)}까지 가능합니다.`);
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'file' || mode === 'html') {
        let uploadTargetFile = file;
        if (mode === 'html' && htmlInputMode === 'paste') {
          const cleaned = cleanMacTextEditHtmlString(htmlCode.trim());
          const blob = new Blob([cleaned], { type: 'text/html; charset=utf-8' });
          uploadTargetFile = new File([blob], 'index.html', { type: 'text/html; charset=utf-8' });
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const result = await uploadShortFileAuto({
          file: uploadTargetFile,
          customCode: customCode.trim(),
          codeId: isLoggedIn ? selectedScope : null,
          expireDuration,
          linkPasswordEnabled: passwordProtect,
          linkPassword: passwordProtect ? linkPassword.trim() : '',
          onProgress: (progress) => {
            setUploadProgress(progress);
          },
          signal: abortController.signal,
          type: mode,
          folder: mode === 'html' ? 'html' : null,
        });

        onResult(result.data);
        setFile(null);
        setHtmlCode('');
        setCustomCode('');
        setPasswordProtect(false);
        setLinkPassword('');
        setConfirmPassword('');
        if (e.target?.querySelector?.('#share-file')) {
          e.target.querySelector('#share-file').value = '';
        }
        if (e.target?.querySelector?.('#share-html')) {
          e.target.querySelector('#share-html').value = '';
        }
        return;
      }

      const body = {
        custom_code: customCode.trim(),
        expire_duration: expireDuration,
        type: mode,
      };
      if (isLoggedIn && selectedScope != null) body.code_id = selectedScope;

      if (mode === 'url') {
        body.original_url = originalUrl;
      } else {
        body.text_content = textContent;
      }

      body.link_password_enabled = passwordProtect;
      if (passwordProtect) {
        body.link_password = linkPassword.trim();
      }

      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.status === 'success') {
        onResult(data.data);
        setOriginalUrl('');
        setTextContent('');
        setCustomCode('');
        setPasswordProtect(false);
        setLinkPassword('');
        setConfirmPassword('');
      } else {
        setError(data.message);
      }
    } catch (err) {
      if (err?.name === 'AbortError' || err?.message?.includes('취소')) {
        setError('파일 업로드가 취소되었습니다.');
      } else {
        console.error('Shorten error:', err);
        setError(err?.message || '네트워크 오류가 발생했습니다.');
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const handleFileChange = (selectedFile) => {
    setError('');
    setFile(selectedFile);
    if (!selectedFile) return;

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();

    if (mode === 'html') {
      if (ext !== 'html' && ext !== 'htm') {
        setError('HTML 파일(.html, .htm)만 업로드할 수 있습니다.');
        setFile(null);
        const fileInput = document.getElementById('share-html');
        if (fileInput) fileInput.value = '';
        return;
      }
      setExpireDuration('1month');

      // Mac 텍스트 편집기 등으로 저장 시 서식(RTF) 이스케이프가 발생한 경우 자동 복원
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result;
        if (typeof text === 'string' && (text.includes('Cocoa HTML Writer') || text.includes('&lt;!DOCTYPE') || text.includes('&lt;html'))) {
          const cleaned = cleanMacTextEditHtmlString(text);
          const blob = new Blob([cleaned], { type: 'text/html; charset=utf-8' });
          const cleanedFile = new File([blob], selectedFile.name, { type: 'text/html; charset=utf-8' });
          setFile(cleanedFile);
        } else {
          setFile(selectedFile);
        }
      };
      reader.readAsText(selectedFile);
      return;
    }

    const blockedExts = ['exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'dll', 'sys', 'apk', 'dmg', 'pkg', 'iso', 'sh', 'ps1', 'vbs', 'jar', 'js', 'mjs', 'cjs', 'php', 'asp', 'aspx', 'jsp', 'cgi', 'svg'];
    if (ext && blockedExts.includes(ext)) {
      setError('보안상 직접 실행 파일(.exe, .apk, .dmg 등) 및 스크립트는 업로드할 수 없습니다. 프로그램 공유는 ZIP 압축 파일로 묶어서 업로드해주세요.');
      setFile(null);
      const fileInput = document.getElementById('share-file');
      if (fileInput) fileInput.value = '';
      return;
    }

    if (selectedFile.size > 1024 * 1024 * 1024) {
      setExpireDuration('48h');
    } else if (selectedFile.size > 10 * 1024 * 1024) {
      setExpireDuration('1week');
    } else {
      setExpireDuration('1month');
    }
  };

  const handleModeChange = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setError('');
    setFile(null);
    setHtmlCode('');
    if (newMode === 'file' && file) {
      if (file.size > 1024 * 1024 * 1024) {
        setExpireDuration('48h');
      } else if (file.size > 10 * 1024 * 1024) {
        setExpireDuration('1week');
      } else {
        setExpireDuration('1month');
      }
    } else if (newMode === 'html') {
      setExpireDuration('1month');
    }
  };

  const handleLoadSampleHtml = async () => {
    try {
      const res = await fetch('/sample-vibe.html');
      if (res.ok) {
        const code = await res.text();
        setHtmlCode(code);
      }
    } catch (err) {
      console.error('Failed to load sample HTML:', err);
    }
  };

  const isFileMode = mode === 'file';
  const isLargeR2 = isFileMode && Boolean(file && file.size > 1024 * 1024 * 1024);
  const isNormalR2 = isFileMode && Boolean(file && file.size > 10 * 1024 * 1024 && file.size <= 1024 * 1024 * 1024);
  const isSmallFile = isFileMode && Boolean(file && file.size <= 10 * 1024 * 1024);
  const isR2File = isLargeR2 || isNormalR2 || isSmallFile;

  let durationOptions = [...TEMP_LINK_DURATION_OPTIONS];

  if (isLargeR2) {
    // 1GB 초과 파일: 딱 2일(48시간)만 가능
    durationOptions = [
      { value: '48h', label: '🔒 2일 (48시간 후 종료 - 저장 기간 일치)' },
    ];
  } else if (isNormalR2) {
    // 10MB 초과 ~ 1GB 이하 파일: 딱 7일(1주일)만 가능
    durationOptions = [
      { value: '1week', label: '🔒 7일 (1주일 후 종료 - 저장 기간 일치)' },
    ];
  }

  const memberBadgeText =
    mode === 'html'
      ? '회원 웹페이지는 영구적으로 보관됩니다 (삭제 시 R2에서도 즉시 삭제)'
      : mode === 'file'
      ? '파일 공유는 10MB 이하 30일, 10MB~1GB 7일, 1GB 초과 2일간 보관 후 자동 삭제됩니다 (주소는 영구 유지)'
      : `회원 ${mode === 'url' ? 'URL' : '텍스트'}은 영구적으로 유지됩니다`;

  const showDurationPicker = !isMemberPermanent || (isR2File && mode !== 'html');

  return (
    <div className="url-form-container">
      <form onSubmit={handleSubmit}>
        {/* Mode Tabs */}
        <div className="mode-tabs" role="tablist" aria-label="입력 모드 선택">
          <button
            type="button"
            role="tab"
            className={`mode-tab ${mode === 'url' ? 'is-active' : ''}`}
            aria-selected={mode === 'url'}
            aria-label="URL 단축"
            onClick={() => handleModeChange('url')}
          >
            <span className="mode-tab-icon" aria-hidden="true">🔗</span>
            <span className="mode-tab-text">
              <span className="mode-tab-text-full">URL 단축</span>
              <span className="mode-tab-text-short">URL</span>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            className={`mode-tab ${mode === 'text' ? 'is-active' : ''}`}
            aria-selected={mode === 'text'}
            aria-label="텍스트 공유"
            onClick={() => handleModeChange('text')}
          >
            <span className="mode-tab-icon" aria-hidden="true">📋</span>
            <span className="mode-tab-text">
              <span className="mode-tab-text-full">텍스트 공유</span>
              <span className="mode-tab-text-short">텍스트</span>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            className={`mode-tab ${mode === 'file' ? 'is-active' : ''}`}
            aria-selected={mode === 'file'}
            aria-label="파일 공유"
            onClick={() => handleModeChange('file')}
          >
            <span className="mode-tab-icon" aria-hidden="true">📎</span>
            <span className="mode-tab-text">
              <span className="mode-tab-text-full">파일 공유</span>
              <span className="mode-tab-text-short">파일</span>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            className={`mode-tab ${mode === 'html' ? 'is-active' : ''}`}
            aria-selected={mode === 'html'}
            aria-label="웹페이지 (HTML)"
            onClick={() => handleModeChange('html')}
          >
            <span className="mode-tab-icon" aria-hidden="true">🌐</span>
            <span className="mode-tab-text">
              <span className="mode-tab-text-full">웹페이지 (HTML)</span>
              <span className="mode-tab-text-short">HTML</span>
            </span>
          </button>
        </div>

        {/* URL / Text / File / HTML Input */}
        <div className="form-group">
          {mode === 'url' ? (
            <>
              <label className="form-label" htmlFor="original-url">원본 URL</label>
              <input
                id="original-url"
                type="url"
                className="form-input"
                placeholder="https://example.com/very-long-url-here"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                required
              />
            </>
          ) : mode === 'text' ? (
            <>
              <label className="form-label" htmlFor="text-content">공유할 텍스트</label>
              <textarea
                id="text-content"
                className="form-input form-textarea"
                placeholder="프롬프트, 코드, 메시지 등 공유할 텍스트를 입력하세요"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                required
                rows={5}
                maxLength={50000}
              />
              {textContent.length > 0 && (
                <div className="form-textarea-counter">
                  {textContent.length.toLocaleString()} / 50,000자
                </div>
              )}
            </>
          ) : mode === 'html' ? (
            <>
              {/* HTML 입력 방식 토글: 파일 업로드 vs 코드 직접 붙여넣기 */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => { setHtmlInputMode('file'); setError(''); }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: htmlInputMode === 'file' ? '600' : '500',
                    border: '1px solid',
                    borderColor: htmlInputMode === 'file' ? 'var(--primary, #3b82f6)' : 'var(--border-color, #e2e8f0)',
                    background: htmlInputMode === 'file' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    color: htmlInputMode === 'file' ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📁 HTML 파일 업로드
                </button>
                <button
                  type="button"
                  onClick={() => { setHtmlInputMode('paste'); setError(''); }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: htmlInputMode === 'paste' ? '600' : '500',
                    border: '1px solid',
                    borderColor: htmlInputMode === 'paste' ? 'var(--primary, #3b82f6)' : 'var(--border-color, #e2e8f0)',
                    background: htmlInputMode === 'paste' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    color: htmlInputMode === 'paste' ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📝 HTML 코드 직접 입력
                </button>
              </div>

              {htmlInputMode === 'file' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" htmlFor="share-html" style={{ margin: 0 }}>
                      HTML 파일 (.html, .htm)
                    </label>
                    <a
                      href="/sample-vibe.html"
                      download="sample-vibe.html"
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        color: '#2563eb',
                        background: 'rgba(59, 130, 246, 0.08)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      📥 샘플 파일 다운로드
                    </a>
                  </div>
                  <input
                    id="share-html"
                    type="file"
                    accept=".html,.htm,text/html"
                    className="form-input"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    required={!file}
                  />

                  {/* 선택된 HTML 파일 상세 정보 및 안내 배너 */}
                  {file && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px 14px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        fontSize: '0.88rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '600', wordBreak: 'break-all' }}>🌐 {file.name}</span>
                        <span style={{ fontWeight: '700', color: '#2563eb', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-color, #1e293b)', lineHeight: '1.45', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <span style={{ flexShrink: 0 }}>🚀</span>
                        <span>
                          {isMemberPermanent ? (
                            <><strong>회원 영구 보관:</strong> 링크를 삭제하기 전까지 영구적으로 웹사이트가 열리며, 링크 삭제 시 R2 스토리지에서도 즉시 삭제됩니다.</>
                          ) : (
                            <><strong>임시 보관:</strong> 선택한 만료 기간 동안 웹사이트가 열리며, 기간 종료 시 R2 파일과 링크가 자동 정리됩니다.</>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" htmlFor="html-code" style={{ margin: 0 }}>
                      HTML 코드 붙여넣기
                    </label>
                    <button
                      type="button"
                      onClick={handleLoadSampleHtml}
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        color: '#2563eb',
                        background: 'rgba(59, 130, 246, 0.08)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      ✨ 샘플 코드 채우기
                    </button>
                  </div>
                  <textarea
                    id="html-code"
                    className="form-input form-textarea"
                    placeholder="<!DOCTYPE html><html>... (여기에 완성된 단일 HTML 코드를 붙여넣으세요)"
                    value={htmlCode}
                    onChange={(e) => setHtmlCode(e.target.value)}
                    required
                    rows={8}
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                  {htmlCode.length > 0 && (
                    <div className="form-textarea-counter" style={{ marginTop: '4px' }}>
                      {htmlCode.length.toLocaleString()}자 입력됨 (자동으로 index.html 변환 후 R2에 호스팅됩니다)
                    </div>
                  )}
                </>
              )}

              <div className="url-form-file-hint" style={{ marginTop: '10px', lineHeight: '1.5' }}>
                <p style={{ margin: '0 0 6px 0' }}>
                  💡 <strong>바이브코딩(Claude, Cursor, Bolt, v0 등) 단일 HTML 호스팅:</strong>
                  <br />
                  단축 주소 접속 시 다운로드가 아닌 <strong>웹사이트 화면이 브라우저에서 바로 열립니다.</strong>
                  <br />
                  (Tailwind CSS CDN, React CDN, 아이콘, 폰트 등이 인라인/CDN으로 포함된 단일 HTML 파일 권장)
                </p>
                <p style={{ margin: 0, color: 'var(--text-muted, #64748b)', fontSize: '0.82rem' }}>
                  🍎 <strong>Mac 텍스트 편집기(TextEdit) 주의사항:</strong> 코드를 복사해 텍스트 편집기에 붙여넣고 저장할 때 서식(RTF) 상태면 웹 태그가 글자로 깨질 수 있습니다. <code>Shift+Cmd+T</code>(일반 텍스트 만들기) 후 저장하시거나 위 <strong>'HTML 코드 직접 입력'</strong>에 바로 붙여넣으시면 가장 안전합니다.
                </p>
              </div>
            </>
          ) : (
            <>
              <label className="form-label" htmlFor="share-file">
                공유할 파일 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>(최대 5GB 지원)</span>
              </label>
              <input
                id="share-file"
                type="file"
                className="form-input"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                required
              />

              {/* 선택된 파일 상세 정보 및 용량별 자동 삭제 안내 배너 */}
              {file && (() => {
                const info = getFileCapacityRetentionInfo(file.size, isMemberPermanent);
                return (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px 14px',
                      background: info.bgColor,
                      border: `1px solid ${info.borderColor}`,
                      borderRadius: '8px',
                      fontSize: '0.88rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '600', wordBreak: 'break-all' }}>{file.name}</span>
                      <span style={{ fontWeight: '700', color: info.color, marginLeft: '8px', whiteSpace: 'nowrap' }}>
                        {formatFileSize(file.size)} ({info.badge})
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-color, #1e293b)', lineHeight: '1.45', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ flexShrink: 0 }}>⏱️</span>
                      <span><strong>보관 및 삭제 안내:</strong> {info.notice}</span>
                    </div>
                  </div>
                );
              })()}

              <p className="url-form-file-hint" style={{ marginTop: '8px', lineHeight: '1.5' }}>
                📌 <strong>최대 5GB까지 모든 파일 공유 지원</strong> (동영상, 문서, 이미지, ZIP 등. 실행 파일은 ZIP 압축 권장).
                <br />
                스토리지 자원 관리를 위해 10MB 이하는 30일, 10MB~1GB는 7일, 1GB 초과는 2일간 보관 후 자동 삭제됩니다.
                {' '}
                {isMemberPermanent ? FILE_SHARE_NOTICE_MEMBER : FILE_SHARE_NOTICE_GUEST}
              </p>
            </>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="custom-code">단축 코드</label>
          <div className="code-input-group">
            {isLoggedIn ? (
              <select
                className={`form-input url-code-select${isTemp ? ' is-temp' : ''}`}
                aria-label="주소 형태 선택 (내 코드 또는 임시 주소)"
                value={scopeSelectValue}
                onChange={(e) => setSelectedScope(parseScopeSelectValue(e.target.value))}
              >
                {userCodes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {baseUrl}{c.username}/
                  </option>
                ))}
                <option value={TEMP_SCOPE}>{baseUrl} (임시)</option>
              </select>
            ) : (
              <span className="url-prefix">{prefix}</span>
            )}
            <input
              id="custom-code"
              type="text"
              className="form-input"
              placeholder="원하는코드"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              required
              pattern={"[가-힣a-zA-Z0-9_\\-]+"}
              title="한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능"
            />
          </div>
          {isLoggedIn && (
            <p className={`url-form-scope-hint${isTemp ? ' is-temp' : ''}`}>
              {isTemp ? (
                <>
                  ⏳ <strong>임시 주소</strong> — 내 코드 없이 <code>{baseUrl}코드</code> 형태로 만들어져요. 선택한 기간이
                  지나면 자동 삭제되며, 만료 전까지 대시보드에서 수정·삭제·연장할 수 있습니다.
                </>
              ) : (
                <>
                  ✨ <strong>내 코드 주소</strong> — <code>{baseUrl}{activeUsername}/코드</code> 형태의 영구 주소예요.
                  짧은 임시 주소가 필요하면 위에서 <em>{baseUrl} (임시)</em>를 선택하세요.
                </>
              )}
            </p>
          )}
        </div>

        <div className="url-form-member-options">
          <div className="url-form-member-options-inner">
            <label className="url-form-password-toggle" htmlFor="home-link-password-enabled">
              <input
                id="home-link-password-enabled"
                type="checkbox"
                checked={passwordProtect}
                onChange={(e) => {
                  const on = e.target.checked;
                  setPasswordProtect(on);
                  if (!on) {
                    setLinkPassword('');
                    setConfirmPassword('');
                  }
                }}
              />
              <span className="url-form-password-toggle-text">
                <span className="url-form-password-toggle-title">비밀번호로 보호</span>
                <span className="url-form-password-toggle-desc">
                  단축 링크를 연 사람에게 비밀번호를 요청합니다
                </span>
              </span>
            </label>
            <div
              className={`url-form-password-reveal${passwordProtect ? ' is-open' : ''}`}
              aria-hidden={!passwordProtect}
            >
              <div className="url-form-password-fields">
                <div className="form-group url-form-password-field-group">
                  <label className="form-label" htmlFor="home-link-password">
                    링크 비밀번호
                  </label>
                  <input
                    id="home-link-password"
                    type="password"
                    className="form-input"
                    autoComplete="new-password"
                    placeholder="6자 이상"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    disabled={!passwordProtect}
                  />
                </div>
                <div className="form-group url-form-password-field-group">
                  <label className="form-label" htmlFor="home-link-password-confirm">
                    비밀번호 확인
                  </label>
                  <input
                    id="home-link-password-confirm"
                    type="password"
                    className="form-input"
                    autoComplete="new-password"
                    placeholder="한 번 더 입력하세요"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={!passwordProtect}
                  />
                </div>
              </div>
            </div>
            {!user && passwordProtect && (
              <p className="url-form-guest-password-note">
                비밀번호는 링크 생성 시에만 설정할 수 있습니다. 이후 변경이 필요하면{' '}
                <Link href="/register">회원가입</Link> 후 새 링크를 만들어주세요.
              </p>
            )}
          </div>
        </div>

        {/* 만료 기간 (또는 회원 영구 배지) */}
        {!showDurationPicker ? (
          <div className="form-group" style={{ textAlign: 'center' }}>
            <div className="member-badge">
              ✨ {memberBadgeText}
            </div>
          </div>
        ) : (
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                {isR2File ? '만료 기간 (파일 저장 기간에 맞춰 자동 지정)' : isTemp ? '임시 주소 만료 기간' : '만료 기간'}
              </label>
              {isR2File && (
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: isLargeR2 ? '#ef4444' : '#10b981',
                    fontWeight: 700,
                  }}
                >
                  {isLargeR2 ? '⚡ 1GB 초과: 딱 2일(48h)만 가능' : '⚡ 1GB 이하: 딱 7일(1week)만 가능'}
                </span>
              )}
            </div>
            <div className="duration-options">
              {durationOptions.map((opt) => (
                <div key={opt.value} className="duration-option">
                  <input
                    type="radio"
                    id={`dur-${opt.value}`}
                    name="expire_duration"
                    value={opt.value}
                    checked={expireDuration === opt.value}
                    onChange={(e) => setExpireDuration(e.target.value)}
                  />
                  <label htmlFor={`dur-${opt.value}`}>{opt.label}</label>
                </div>
              ))}
            </div>
            {isLargeR2 && (
              <p style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '6px', lineHeight: '1.4' }}>
                🔥 1GB 초과 초대용량 파일은 스토리지 보관 기간에 맞춰 링크도 <strong>2일(48시간) 후 자동 종료</strong>됩니다.
              </p>
            )}
            {isNormalR2 && (
              <p style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '6px', lineHeight: '1.4' }}>
                ⚡ 10MB 초과 ~ 1GB 대용량 파일은 스토리지 보관 기간에 맞춰 링크도 <strong>7일(1주일) 후 자동 종료</strong>됩니다.
              </p>
            )}
            {isSmallFile && (
              <p style={{ fontSize: '0.8rem', color: '#2563eb', marginTop: '6px', lineHeight: '1.4' }}>
                📄 10MB 이하 일반 파일은 기본 <strong>30일간 보관</strong>되며 원하시는 만료 기간을 선택할 수 있습니다.
              </p>
            )}
            {isTemp && !isFileMode && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                ⏳ 임시 주소는 모든 사용자가 함께 쓰는 공간이라 만료 기간이 있어요. 만료 전 대시보드에서 기간을 다시 설정하거나 내 코드 주소로 전환할 수 있습니다.
              </p>
            )}
          </div>
        )}

        {/* 업로드 진행률 바 (대용량 업로드 시 표시) */}
        {uploadProgress && (
          <div style={{ margin: '18px 0', padding: '14px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
              <span>{uploadProgress.statusText}</span>
              <span style={{ color: '#2563eb' }}>{uploadProgress.percent}%</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${uploadProgress.percent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <button
                type="button"
                onClick={handleCancelUpload}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              >
                ✕ 업로드 취소
              </button>
              {uploadProgress.detailText && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', textAlign: 'right' }}>
                  {uploadProgress.detailText}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger" style={{ textAlign: 'left', lineHeight: '1.5' }}>
            <div>⚠️ {error}</div>
            {error.includes('CORS') && (
              <div style={{ marginTop: '8px', fontSize: '0.82rem', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
                💡 <strong>Cloudflare R2 CORS 설정 팁:</strong> Cloudflare R2 버킷(<code>short-kr-files</code>) &gt; Settings &gt; CORS Policy에 AllowedOrigins: <code>[&quot;*&quot;]</code>, AllowedMethods: <code>[&quot;GET&quot;, &quot;PUT&quot;, &quot;HEAD&quot;]</code> 설정을 확인해주세요.
              </div>
            )}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-shorten" disabled={loading}>
          {loading ? (
            <><span className="spinner" /> {uploadProgress?.statusText || '처리 중...'}</>
          ) : mode === 'url' ? (
            <>🔗 {isTemp ? '임시 주소로 단축하기' : 'URL 단축하기'}</>
          ) : mode === 'text' ? (
            <>📋 {isTemp ? '임시 단축 주소 만들기' : '단축 주소 만들기'}</>
          ) : (
            <>📎 {isTemp ? '임시 파일 공유 주소 만들기' : '파일 공유 주소 만들기'}</>
          )}
        </button>
        {!user && (
          <p className="url-form-guest-note">
            좋은 단축 코드를 나눠 사용하기 위해 만료 기간이 설정됩니다. 영구 단축을 원하시면{' '}
            <Link href="/register">회원가입</Link>을 하세요. 숏.한국/닉네임/단축코드로 영구적인 단축주소를 가질 수
            있습니다. (파일 공유는 1GB 이하 7일, 1GB 초과 2일간 보관 후 자동 삭제됩니다.)
          </p>
        )}
      </form>
    </div>
  );
}
