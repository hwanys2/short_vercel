'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UrlResult from '@/components/UrlResult';
import { buildShortUrl } from '@/lib/siteUrl';
import {
  formatFileSize,
  MAX_FILE_BYTES,
  getFileCapacityRetentionInfo,
} from '@/lib/shortFilesShared';
import { uploadShortFileAuto } from '@/lib/fileUploadClient';
import { useLinkScope, parseScopeSelectValue } from '@/lib/useLinkScope';
import {
  TEMP_SCOPE,
  TEMP_LINK_DURATION_OPTIONS,
  formatTempExpiryDate,
  formatTempRemaining,
} from '@/lib/tempLinks';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [urls, setUrls] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [fileStatus, setFileStatus] = useState('all');
  const [filterCodeId, setFilterCodeId] = useState('all'); // 'all' | 'temp' | number

  // 생성 대상: 본인 코드(영구) 또는 임시 주소(숏.한국/코드)
  const {
    scope: createScope,
    isTemp: createIsTemp,
    codes: userCodes,
    activeUsername: createUsername,
    setScope: setCreateScope,
    selectValue: createScopeValue,
  } = useLinkScope(user);
  const [newExpireDuration, setNewExpireDuration] = useState('1week');

  // 새 URL 생성 폼
  const [newUrl, setNewUrl] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newMode, setNewMode] = useState('url');
  const [newText, setNewText] = useState('');
  const [newFile, setNewFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  const abortControllerRef = useRef(null);
  const createResultRef = useRef(null);

  // 업로드 도중 창 닫기/새로고침 방지
  useEffect(() => {
    if (!creating || !uploadProgress) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [creating, uploadProgress]);

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleFileChange = (file) => {
    setMessage('');
    setNewFile(file);
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const blockedExts = ['exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'dll', 'sys', 'apk', 'dmg', 'pkg', 'iso', 'sh', 'ps1', 'vbs', 'jar', 'js', 'mjs', 'cjs', 'php', 'asp', 'aspx', 'jsp', 'cgi', 'svg'];
    if (ext && blockedExts.includes(ext)) {
      setMessage('보안상 직접 실행 파일(.exe, .apk, .dmg 등) 및 스크립트는 업로드할 수 없습니다. 프로그램 공유는 ZIP 압축 파일로 묶어서 업로드해주세요.');
      setMessageType('danger');
      setNewFile(null);
      const fileInput = document.getElementById('dash-file');
      if (fileInput) fileInput.value = '';
    }
  };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://숏.한국/';

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          router.push('/login');
        } else if (data.needsOnboarding) {
          router.push('/onboarding');
        } else {
          setUser(data.user);
          // 결과 화면의 "대시보드" 링크(?scope=temp)로 들어오면 임시 주소 필터를 미리 켠다
          try {
            const scopeParam = new URLSearchParams(window.location.search).get('scope');
            if (scopeParam === TEMP_SCOPE) setFilterCodeId(TEMP_SCOPE);
          } catch {}
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    if (user) fetchUrls();
  }, [user, page, appliedQ, filterType, fileStatus, filterCodeId]);

  const hasMultipleCodes = userCodes.length > 1;
  const hasScopeFilter = filterCodeId !== 'all';
  const hasAnyFilter = Boolean(appliedQ) || filterType !== 'all' || fileStatus !== 'all' || hasScopeFilter;

  // 임시 주소 + 파일: 용량별 보관 기간이 우선 (10MB 초과는 선택 불가)
  const newFileForcedDuration =
    newMode === 'file' && newFile
      ? newFile.size > 1024 * 1024 * 1024
        ? '48h'
        : newFile.size > 10 * 1024 * 1024
          ? '1week'
          : null
      : null;
  const showCreateDuration = createIsTemp && !(newMode === 'file' && newFileForcedDuration);

  const fetchUrls = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: '10',
      });
      if (appliedQ) params.set('q', appliedQ);
      if (filterType && filterType !== 'all') params.set('type', filterType);
      if (fileStatus && fileStatus !== 'all') params.set('file_status', fileStatus);
      if (filterCodeId && filterCodeId !== 'all') params.set('code_id', String(filterCodeId));

      const res = await fetch(`/api/urls?${params}`);
      const data = await res.json();
      if (data.success) {
        setUrls(data.urls);
        setTotalPages(data.total_pages);
        setTotal(data.total);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const applySearch = (e) => {
    e?.preventDefault?.();
    setPage(1);
    setAppliedQ(searchQ.trim());
  };

  useEffect(() => {
    if (!createResult) return;
    const id = requestAnimationFrame(() => {
      createResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => cancelAnimationFrame(id);
  }, [createResult]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMessage('');
    setCreateResult(null);
    try {
      if (newMode === 'file') {
        if (!newFile) {
          setMessage('파일을 선택해주세요.');
          setMessageType('danger');
          setCreating(false);
          return;
        }
        if (newFile.size > MAX_FILE_BYTES) {
          setMessage(`파일 크기는 최대 ${formatFileSize(MAX_FILE_BYTES)}까지 가능합니다.`);
          setMessageType('danger');
          setCreating(false);
          return;
        }

        // 본인 코드: 용량별 보관 기간 / 임시 주소: 10MB 이하는 선택 기간, 초과는 용량별 강제
        const fileExpireDuration =
          newFileForcedDuration || (createIsTemp ? newExpireDuration : '1month');

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const uploaded = await uploadShortFileAuto({
          file: newFile,
          customCode: newCode.trim(),
          codeId: createScope,
          expireDuration: fileExpireDuration,
          linkPasswordEnabled: false,
          onProgress: (prog) => {
            setUploadProgress(prog);
          },
          signal: abortController.signal,
        });

        const resultData =
          uploaded?.data ||
          (uploaded?.short_url
            ? uploaded
            : {
                short_url: buildShortUrl({
                  baseUrl,
                  code: newCode.trim(),
                  username: createIsTemp ? undefined : createUsername,
                }),
                type: 'file',
                is_temp: createIsTemp,
                expiration_date: null,
              });

        setCreateResult(resultData);
        setMessage('');
        setNewCode('');
        setNewFile(null);
        if (document.getElementById('dash-file')) {
          document.getElementById('dash-file').value = '';
        }
        fetchUrls();
        return;
      }

      const body = {
        custom_code: newCode,
        type: newMode,
        code_id: createScope,
      };
      if (createIsTemp) body.expire_duration = newExpireDuration;
      if (newMode === 'url') {
        body.original_url = newUrl;
      } else {
        body.text_content = newText;
      }
      const res = await fetch('/api/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        const resultData =
          data.data ||
          {
            short_url: buildShortUrl({
              baseUrl,
              code: newCode.trim(),
              username: createIsTemp ? undefined : createUsername,
            }),
            type: newMode,
            is_temp: createIsTemp,
            expiration_date: null,
          };
        setCreateResult(resultData);
        setMessage('');
        setNewUrl('');
        setNewCode('');
        setNewText('');
        fetchUrls();
      } else {
        setMessage(data.message);
        setMessageType('danger');
      }
    } catch (err) {
      if (err?.name === 'AbortError' || err?.message?.includes('취소')) {
        setMessage('파일 업로드가 취소되었습니다.');
        setMessageType('warning');
      } else {
        setMessage(err?.message || '오류가 발생했습니다.');
        setMessageType('danger');
      }
    } finally {
      abortControllerRef.current = null;
      setCreating(false);
      setUploadProgress(null);
    }
  };

  /** 행의 스코프 파라미터: 임시 주소면 'temp', 아니면 본인 코드 id */
  const rowScopeParam = (url) => (url.is_temp ? TEMP_SCOPE : url.user_code_id ? String(url.user_code_id) : '');

  const handleDelete = async (url) => {
    const label = url.is_temp ? '임시 주소를' : 'URL을';
    if (!confirm(`정말 이 ${label} 삭제하시겠습니까?`)) return;
    try {
      const scopeParam = rowScopeParam(url);
      const qs = scopeParam ? `?code_id=${encodeURIComponent(scopeParam)}` : '';
      const res = await fetch(`/api/urls/${encodeURIComponent(url.code)}${qs}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage('URL이 삭제되었습니다.');
        setMessageType('success');
        fetchUrls();
      } else {
        setMessage(data.message);
        setMessageType('danger');
      }
    } catch {
      setMessage('삭제 중 오류가 발생했습니다.');
      setMessageType('danger');
    }
  };

  const rowShortUrl = (url) =>
    buildShortUrl({
      baseUrl,
      code: url.code,
      username: url.is_temp ? undefined : url.code_username || user.username,
    });

  const copyUrl = (url) => {
    navigator.clipboard.writeText(rowShortUrl(url)).then(() => alert('URL이 복사되었습니다!'));
  };

  if (!user) return null;

  return (
    <>
      <Header />
      <main className="dashboard-page">
        <div className="container">
          <div className="dashboard-header">
            <h1>{user.username}님의 대시보드</h1>
            <div className="user-badge">
              ✨ 내 코드 주소({baseUrl}{createUsername}/코드)는 영구 · 임시 주소({baseUrl}코드)는 만료 후 자동 삭제 · 파일은 용량별 보관
            </div>
          </div>

          {message && (
            <div className={`alert alert-${messageType}`} style={{ maxWidth: '800px', margin: '0 auto 20px', lineHeight: '1.5' }}>
              <div>{message}</div>
              {message.includes('CORS') && (
                <div style={{ marginTop: '8px', fontSize: '0.82rem', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
                  💡 <strong>Cloudflare R2 CORS 설정 팁:</strong> Cloudflare R2 버킷(<code>short-kr-files</code>) &gt; Settings &gt; CORS Policy에 AllowedOrigins: <code>[&quot;*&quot;]</code>, AllowedMethods: <code>[&quot;GET&quot;, &quot;PUT&quot;, &quot;HEAD&quot;]</code> 설정을 확인해주세요.
                </div>
              )}
            </div>
          )}

          {createResult && (
            <div
              ref={createResultRef}
              className="home-shorten-result"
              style={{ maxWidth: '800px', margin: '0 auto 24px' }}
            >
              <UrlResult data={createResult} user={user} />
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCreateResult(null)}
                >
                  결과 닫고 새로 만들기
                </button>
              </div>
            </div>
          )}

          {/* 새 URL 생성 */}
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto 24px' }}>
            <div className="card-header">➕ 새 단축 주소 생성</div>
            <div className="card-body">
              <div className="mode-tabs" role="tablist" aria-label="입력 모드 선택" style={{ marginBottom: '16px' }}>
                <button type="button" role="tab" className={`mode-tab ${newMode === 'url' ? 'is-active' : ''}`} aria-selected={newMode === 'url'} aria-label="URL 단축" onClick={() => setNewMode('url')}>
                  <span className="mode-tab-icon" aria-hidden="true">🔗</span>
                  <span className="mode-tab-text">
                    <span className="mode-tab-text-full">URL 단축</span>
                    <span className="mode-tab-text-short">URL</span>
                  </span>
                </button>
                <button type="button" role="tab" className={`mode-tab ${newMode === 'text' ? 'is-active' : ''}`} aria-selected={newMode === 'text'} aria-label="텍스트 공유" onClick={() => setNewMode('text')}>
                  <span className="mode-tab-icon" aria-hidden="true">📋</span>
                  <span className="mode-tab-text">
                    <span className="mode-tab-text-full">텍스트 공유</span>
                    <span className="mode-tab-text-short">텍스트</span>
                  </span>
                </button>
                <button type="button" role="tab" className={`mode-tab ${newMode === 'file' ? 'is-active' : ''}`} aria-selected={newMode === 'file'} aria-label="파일 공유" onClick={() => setNewMode('file')}>
                  <span className="mode-tab-icon" aria-hidden="true">📎</span>
                  <span className="mode-tab-text">
                    <span className="mode-tab-text-full">파일 공유</span>
                    <span className="mode-tab-text-short">파일</span>
                  </span>
                </button>
              </div>
              <form onSubmit={handleCreate} className="dashboard-create-form">
                {newMode === 'url' ? (
                  <div className="form-group dashboard-create-main">
                    <label className="form-label" htmlFor="dash-url">원본 URL</label>
                    <input id="dash-url" type="url" className="form-input" placeholder="https://example.com" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} required />
                  </div>
                ) : newMode === 'text' ? (
                  <div className="form-group dashboard-create-main">
                    <label className="form-label" htmlFor="dash-text">공유할 텍스트</label>
                    <textarea id="dash-text" className="form-input form-textarea" placeholder="프롬프트, 코드, 메시지 등" value={newText} onChange={(e) => setNewText(e.target.value)} required rows={3} maxLength={50000} />
                  </div>
                ) : (
                  <div className="form-group dashboard-create-main">
                    <label className="form-label" htmlFor="dash-file">
                      공유할 파일 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>(최대 5GB 지원)</span>
                    </label>
                    <input
                      id="dash-file"
                      type="file"
                      className="form-input"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      required
                    />

                    {newFile && (() => {
                      const info = getFileCapacityRetentionInfo(newFile.size, !createIsTemp);
                      const afterExpiry = createIsTemp
                        ? '임시 주소이므로 만료 시 주소도 함께 삭제됩니다'
                        : '주소는 유지되며 만료 시 수정에서 재등록 가능';
                      return (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '10px 12px',
                            background: info.bgColor,
                            border: `1px solid ${info.borderColor}`,
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '600', wordBreak: 'break-all' }}>{newFile.name}</span>
                            <span style={{ fontWeight: '700', color: info.color, marginLeft: '8px', whiteSpace: 'nowrap' }}>
                              {formatFileSize(newFile.size)} ({info.badge})
                            </span>
                          </div>
                          <div style={{ color: 'var(--text-color, #1e293b)', lineHeight: '1.4', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                            <span>⏱️</span>
                            <span><strong>보관 및 삭제 안내:</strong> {info.notice}</span>
                          </div>
                          {newFile.size > 1024 * 1024 * 1024 && (
                            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(239, 68, 68, 0.3)', color: '#ef4444', fontWeight: 600, fontSize: '0.82rem' }}>
                              🔒 다운로드 가능 기간: <strong>2일 (48시간 후 만료)</strong> — {afterExpiry}
                            </div>
                          )}
                          {newFile.size > 10 * 1024 * 1024 && newFile.size <= 1024 * 1024 * 1024 && (
                            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(16, 185, 129, 0.3)', color: '#047857', fontWeight: 600, fontSize: '0.82rem' }}>
                              🔒 다운로드 가능 기간: <strong>7일 (1주일 후 만료)</strong> — {afterExpiry}
                            </div>
                          )}
                          {newFile.size <= 10 * 1024 * 1024 && (
                            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(37, 99, 235, 0.3)', color: '#2563eb', fontWeight: 600, fontSize: '0.82rem' }}>
                              🔒 다운로드 가능 기간: <strong>{createIsTemp ? '선택한 만료 기간 (최대 30일)' : '30일 (1개월 후 만료)'}</strong> — {afterExpiry}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <p className="url-form-file-hint" style={{ marginTop: '6px' }}>
                      최대 5GB까지 모든 파일(영상, 문서, ZIP 등) 지원. 10MB 이하 30일, 10MB~1GB 7일, 1GB 초과는 2일간 보관 후 자동 삭제됩니다.
                      {createIsTemp ? ' (임시 주소는 만료 시 주소도 삭제)' : ' (단축 주소는 영구 유지)'}
                    </p>
                  </div>
                )}
                <div className="form-group dashboard-create-code">
                  <label className="form-label" htmlFor="dash-code">단축 코드</label>
                  <div className="dashboard-create-code-row">
                    <select
                      className={`form-input dashboard-create-code-select${createIsTemp ? ' is-temp' : ''}`}
                      aria-label="주소 형태 선택 (내 코드 또는 임시 주소)"
                      value={createScopeValue}
                      onChange={(e) => setCreateScope(parseScopeSelectValue(e.target.value))}
                    >
                      {userCodes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.username}/
                        </option>
                      ))}
                      <option value={TEMP_SCOPE}>임시 · 숏.한국/</option>
                    </select>
                    <input
                      id="dash-code"
                      type="text"
                      className="form-input"
                      placeholder="원하는코드"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      required
                      pattern={"[가-힣a-zA-Z0-9_\\-]+"}
                      title="한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능"
                    />
                  </div>
                </div>

                {createIsTemp && (
                  <div className="form-group dashboard-create-duration">
                    <label className="form-label">임시 주소 만료 기간</label>
                    {showCreateDuration ? (
                      <div className="duration-options" style={{ justifyContent: 'flex-start' }}>
                        {TEMP_LINK_DURATION_OPTIONS.map((opt) => (
                          <div key={opt.value} className="duration-option">
                            <input
                              type="radio"
                              id={`dash-dur-${opt.value}`}
                              name="dash_expire_duration"
                              value={opt.value}
                              checked={newExpireDuration === opt.value}
                              onChange={(e) => setNewExpireDuration(e.target.value)}
                            />
                            <label htmlFor={`dash-dur-${opt.value}`}>{opt.label}</label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="dashboard-create-duration-hint" style={{ marginTop: 0 }}>
                        🔒 {newFileForcedDuration === '48h' ? '1GB 초과 파일은 2일(48시간)' : '10MB 초과 파일은 7일(1주일)'} 후 자동 만료됩니다.
                      </p>
                    )}
                    <p className="dashboard-create-duration-hint">
                      ⏳ 임시 주소는 내 코드 없이 <strong>{baseUrl}코드</strong> 형태로 만들어지며, 만료되면 자동 삭제됩니다. 만료 전 수정에서 기간을 다시 설정하거나 내 코드 주소로 전환할 수 있어요.
                    </p>
                  </div>
                )}

                {uploadProgress && (
                  <div style={{ width: '100%', margin: '12px 0', padding: '12px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      <span>{uploadProgress.statusText}</span>
                      <span style={{ color: '#2563eb' }}>{uploadProgress.percent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${uploadProgress.percent}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                          transition: 'width 0.2s ease',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={handleCancelUpload}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.75rem',
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
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', textAlign: 'right' }}>
                          {uploadProgress.detailText}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-primary dashboard-create-submit" disabled={creating}>
                  {creating ? (uploadProgress?.statusText || '생성 중...') : '생성'}
                </button>
              </form>
            </div>
          </div>


          {/* URL 목록 */}
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto 24px' }}>
            <div className="card-header">
              🔗 내 URL 목록 <span style={{ color: 'var(--text-muted)', fontWeight: '400', marginLeft: '8px' }}>({total}개)</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="dashboard-filters">
                <form className="dashboard-search-form" onSubmit={applySearch}>
                  <input
                    type="search"
                    className="form-input"
                    placeholder="코드·파일명·URL·텍스트 검색"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    aria-label="단축 주소 검색"
                  />
                  <button type="submit" className="btn btn-secondary btn-sm">검색</button>
                  {hasAnyFilter && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSearchQ('');
                        setAppliedQ('');
                        setFilterType('all');
                        setFileStatus('all');
                        setFilterCodeId('all');
                        setPage(1);
                      }}
                    >
                      초기화
                    </button>
                  )}
                </form>
                <div className="dashboard-filter-chips" role="group" aria-label="주소 형태 필터">
                  <button
                    type="button"
                    className={`dash-chip ${filterCodeId === 'all' ? 'is-active' : ''}`}
                    onClick={() => {
                      setFilterCodeId('all');
                      setPage(1);
                    }}
                  >
                    전체
                  </button>
                  {userCodes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`dash-chip ${filterCodeId !== TEMP_SCOPE && Number(filterCodeId) === Number(c.id) ? 'is-active' : ''}`}
                      onClick={() => {
                        setFilterCodeId(c.id);
                        setPage(1);
                      }}
                      title={hasMultipleCodes ? `${c.username}/ 아래 주소만 보기` : '내 코드 주소만 보기'}
                    >
                      {c.username}/
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`dash-chip is-temp ${filterCodeId === TEMP_SCOPE ? 'is-active' : ''}`}
                    onClick={() => {
                      setFilterCodeId(TEMP_SCOPE);
                      setPage(1);
                    }}
                    title="내 코드 없이 만든 임시 주소(숏.한국/코드)만 보기"
                  >
                    ⏳ 임시 주소
                  </button>
                </div>
                <div className="dashboard-filter-chips" role="group" aria-label="타입 필터">
                  {[
                    { id: 'all', label: '전체' },
                    { id: 'url', label: 'URL' },
                    { id: 'text', label: '텍스트' },
                    { id: 'file', label: '파일' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`dash-chip ${filterType === t.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setFilterType(t.id);
                        setPage(1);
                        if (t.id !== 'file' && fileStatus !== 'all') setFileStatus('all');
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {(filterType === 'all' || filterType === 'file') && (
                  <div className="dashboard-filter-chips" role="group" aria-label="파일 만료 필터">
                    {[
                      { id: 'all', label: '파일 상태: 전체' },
                      { id: 'expiring', label: '2일 내 만료' },
                      { id: 'expired', label: '만료됨' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`dash-chip ${fileStatus === t.id ? 'is-active' : ''} ${t.id === 'expired' ? 'is-danger' : t.id === 'expiring' ? 'is-warn' : ''}`}
                        onClick={() => {
                          setFileStatus(t.id);
                          if (t.id !== 'all') setFilterType('file');
                          setPage(1);
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <span className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
                </div>
              ) : urls.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📂</div>
                  <h3>{hasAnyFilter ? '검색 결과가 없습니다' : '아직 생성된 URL이 없습니다'}</h3>
                  <p>
                    {filterCodeId === TEMP_SCOPE && !appliedQ && filterType === 'all' && fileStatus === 'all'
                      ? '아직 임시 주소가 없어요. 위 폼에서 "임시 · 숏.한국/"을 선택해 만들 수 있습니다.'
                      : hasAnyFilter
                        ? '다른 조건으로 다시 검색해 보세요.'
                        : '위 폼을 사용하여 첫 번째 영구 URL을 만들어보세요!'}
                  </p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>타입</th>
                        <th>단축 URL</th>
                        <th>내용</th>
                        <th>생성일</th>
                        <th>클릭수</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {urls.map((url) => {
                        const codeUsername = url.code_username || user.username;
                        const rowKey = url.is_temp ? `temp-${url.code}` : `${url.user_code_id || 'p'}-${url.code}`;
                        const editHref = `/dashboard/edit/${encodeURIComponent(url.code)}?code_id=${encodeURIComponent(rowScopeParam(url))}`;
                        return (
                        <tr key={rowKey}>
                          <td>{url.type === 'text' ? '📋' : url.type === 'file' ? '📎' : '🔗'}</td>
                          <td>
                            <a href={rowShortUrl(url)} target="_blank" rel="noopener noreferrer">
                              {url.is_temp ? url.code : `${codeUsername}/${url.code}`}
                            </a>
                            {url.is_temp && (
                              <>
                                <span className="dash-scope-badge" title="내 코드 없이 만든 임시 주소 (만료 후 자동 삭제)">임시</span>
                                <span
                                  className={`dash-link-expiry ${url.link_retention === 'expired' ? 'is-expired' : url.link_retention === 'expiring' ? 'is-expiring' : ''}`}
                                  title={url.expiration_date ? `만료: ${formatTempExpiryDate(url.expiration_date)}` : ''}
                                >
                                  ⏳ {formatTempRemaining(url.expiration_date) || '만료 기간 있음'}
                                </span>
                              </>
                            )}
                          </td>
                          <td className="url-cell" title={
                            url.type === 'text'
                              ? (url.text_preview || '텍스트 메모')
                              : url.type === 'file'
                                ? (url.file_name || '파일')
                                : url.original_url
                          }>
                            {url.type === 'text'
                              ? (url.text_preview ? `${url.text_preview}...` : '텍스트 메모')
                              : url.type === 'file'
                                ? (
                                    <span>
                                      {url.file_name || '파일'}
                                      {url.file_retention === 'expired' ? (
                                          <span className="dash-retention-badge is-expired">만료됨</span>
                                        ) : url.file_retention === 'expiring' ? (
                                          <span className="dash-retention-badge is-expiring">곧 만료</span>
                                        ) : url.file_retention === 'active' ? (
                                          <span className="dash-retention-badge is-active">보관 중</span>
                                        ) : null}
                                    </span>
                                  )
                                : url.original_url}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{new Date(url.created_at).toLocaleDateString('ko-KR')}</td>
                          <td>
                            <div className="dash-visits-cell">
                              <span>{url.visits}</span>
                              <MiniVisitBars series={url.visits_7d} />
                            </div>
                          </td>
                          <td>
                            <div className="url-actions">
                              <Link
                                href={editHref}
                                className="btn btn-secondary btn-icon"
                                title={url.is_temp ? '수정 · 기간 재설정 · 내 코드로 전환' : '수정'}
                                aria-label="수정"
                              >
                                ✏️
                              </Link>
                              <button className="btn btn-secondary btn-icon" onClick={() => copyUrl(url)} title="복사">
                                📋
                              </button>
                              <button className="btn btn-danger btn-icon" onClick={() => handleDelete(url)} title="삭제">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>«</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="page-btn" style={{ cursor: 'default', opacity: 0.5 }}>...</span>}
                    <button className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  </span>
                ))}
              <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>»</button>
            </div>
          )}

          {/* Actions */}
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <Link href="/profile" className="btn btn-secondary btn-sm">
              프로필 · 계정 설정
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function MiniVisitBars({ series }) {
  const byDay = new Map((series || []).map((s) => [s.day, s.count]));
  const days = [];
  const now = Date.now();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    days.push(`${y}-${m}-${day}`);
  }
  const counts = days.map((day) => byDay.get(day) || 0);
  const max = Math.max(1, ...counts);
  return (
    <div className="mini-visit-bars" title="최근 7일 클릭" aria-hidden="true">
      {counts.map((c, i) => (
        <span
          key={days[i]}
          className="mini-visit-bar"
          style={{ height: `${Math.max(2, Math.round((c / max) * 16))}px` }}
        />
      ))}
    </div>
  );
}
