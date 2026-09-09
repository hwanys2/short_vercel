'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { buildShortUrl } from '@/lib/siteUrl';
import {
  formatFileSize,
  MAX_FILE_BYTES,
  getFileCapacityRetentionInfo,
} from '@/lib/shortFilesShared';
import { uploadShortFileAuto } from '@/lib/fileUploadClient';
import { sanitizeAsciiPasswordInput } from '@/lib/passwordInput';

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

  // 새 URL 생성 폼
  const [newUrl, setNewUrl] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newMode, setNewMode] = useState('url');
  const [newText, setNewText] = useState('');
  const [newFile, setNewFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const abortControllerRef = useRef(null);

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

  // 회원탈퇴 모달
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // 비밀번호 변경 모달
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://숏.한국/';

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          router.push('/login');
        } else {
          setUser(data.user);
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    if (user) fetchUrls();
  }, [user, page, appliedQ, filterType, fileStatus]);

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

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMessage('');
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

        const fileExpireDuration =
          newFile.size > 1024 * 1024 * 1024
            ? '48h'
            : (newFile.size > 10 * 1024 * 1024 ? '1week' : '1month');

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        await uploadShortFileAuto({
          file: newFile,
          customCode: newCode.trim(),
          expireDuration: fileExpireDuration,
          linkPasswordEnabled: false,
          onProgress: (prog) => {
            setUploadProgress(prog);
          },
          signal: abortController.signal,
        });

        setMessage('파일 공유 주소가 성공적으로 생성되었습니다.');
        setMessageType('success');
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
      };
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
        setMessage(newMode === 'text' ? '텍스트 공유 주소가 성공적으로 생성되었습니다.' : 'URL이 성공적으로 생성되었습니다.');
        setMessageType('success');
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

  const handleDelete = async (code) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/urls/${encodeURIComponent(code)}`, { method: 'DELETE' });
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

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      alert('확인 문구를 정확히 입력해주세요. (DELETE)');
      return;
    }
    if (!confirm('정말로 회원탈퇴를 진행하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) return;

    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      const data = await res.json();
      if (data.success) {
        alert('회원탈퇴가 완료되었습니다.');
        router.push('/');
      } else {
        alert(data.message);
      }
    } catch {
      alert('회원탈퇴 중 오류가 발생했습니다.');
    }
  };

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      setPasswordError('모든 필드를 입력해주세요.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('새 비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirm: newPasswordConfirm,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setPasswordError(data.message || '비밀번호 변경에 실패했습니다.');
        return;
      }
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setMessage('비밀번호가 변경되었습니다.');
      setMessageType('success');
    } catch {
      setPasswordError('네트워크 오류가 발생했습니다.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const copyUrl = (code) => {
    const url = buildShortUrl({ baseUrl, code, username: user.username });
    navigator.clipboard.writeText(url).then(() => alert('URL이 복사되었습니다!'));
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
              ✨ URL·텍스트는 영구 · 파일은 10MB 이하 30일/대용량 7일(만료 시 수정에서 재등록 가능) · {baseUrl}{user.username}/코드
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
                      const info = getFileCapacityRetentionInfo(newFile.size, true);
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
                              🔒 다운로드 가능 기간: <strong>2일 (48시간 후 만료)</strong> — 주소는 유지되며 만료 시 수정에서 재등록 가능
                            </div>
                          )}
                          {newFile.size > 10 * 1024 * 1024 && newFile.size <= 1024 * 1024 * 1024 && (
                            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(16, 185, 129, 0.3)', color: '#047857', fontWeight: 600, fontSize: '0.82rem' }}>
                              🔒 다운로드 가능 기간: <strong>7일 (1주일 후 만료)</strong> — 주소는 유지되며 만료 시 수정에서 재등록 가능
                            </div>
                          )}
                          {newFile.size <= 10 * 1024 * 1024 && (
                            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(37, 99, 235, 0.3)', color: '#2563eb', fontWeight: 600, fontSize: '0.82rem' }}>
                              🔒 다운로드 가능 기간: <strong>30일 (1개월 후 만료)</strong> — 주소는 유지되며 만료 시 수정에서 재등록 가능
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <p className="url-form-file-hint" style={{ marginTop: '6px' }}>
                      최대 5GB까지 모든 파일(영상, 문서, ZIP 등) 지원. 10MB 이하 30일, 10MB~1GB 7일, 1GB 초과는 2일간 보관 후 자동 삭제됩니다. (단축 주소는 영구 유지)
                    </p>
                  </div>
                )}
                <div className="form-group dashboard-create-code">
                  <label className="form-label" htmlFor="dash-code">단축 코드</label>
                  <div className="dashboard-create-code-row">
                    <span className="dashboard-create-code-prefix">{user.username}/</span>
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
                  {(appliedQ || filterType !== 'all' || fileStatus !== 'all') && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSearchQ('');
                        setAppliedQ('');
                        setFilterType('all');
                        setFileStatus('all');
                        setPage(1);
                      }}
                    >
                      초기화
                    </button>
                  )}
                </form>
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
                  <h3>{appliedQ || filterType !== 'all' || fileStatus !== 'all' ? '검색 결과가 없습니다' : '아직 생성된 URL이 없습니다'}</h3>
                  <p>{appliedQ || filterType !== 'all' || fileStatus !== 'all' ? '다른 조건으로 다시 검색해 보세요.' : '위 폼을 사용하여 첫 번째 영구 URL을 만들어보세요!'}</p>
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
                      {urls.map((url) => (
                        <tr key={url.code}>
                          <td>{url.type === 'text' ? '📋' : url.type === 'file' ? '📎' : '🔗'}</td>
                          <td>
                            <a href={buildShortUrl({ baseUrl, code: url.code, username: user.username })} target="_blank" rel="noopener noreferrer">
                              {user.username}/{url.code}
                            </a>
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
                                href={`/dashboard/edit/${encodeURIComponent(url.code)}`}
                                className="btn btn-secondary btn-icon"
                                title="수정"
                                aria-label="수정"
                              >
                                ✏️
                              </Link>
                              <button className="btn btn-secondary btn-icon" onClick={() => copyUrl(url.code)} title="복사">
                                📋
                              </button>
                              <button className="btn btn-danger btn-icon" onClick={() => handleDelete(url.code)} title="삭제">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
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
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={openPasswordModal}>
                비밀번호 변경
              </button>
              <button
                type="button"
                onClick={() => {
                  fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/'));
                }}
                className="btn btn-danger btn-sm"
              >
                로그아웃
              </button>
            </div>
            <div style={{ marginTop: '16px' }}>
              <button onClick={() => setShowDeleteModal(true)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', cursor: 'pointer', opacity: 0.6 }}>
                회원탈퇴
              </button>
            </div>
          </div>

          {/* 비밀번호 변경 모달 */}
          {showPasswordModal && (
            <div
              className="modal-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget && !passwordSaving) setShowPasswordModal(false);
              }}
            >
              <div className="modal">
                <div className="modal-header">
                  <h3>비밀번호 변경</h3>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => !passwordSaving && setShowPasswordModal(false)}
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleChangePassword}>
                  <div className="modal-body">
                    {passwordError && (
                      <div className="alert alert-danger" style={{ marginBottom: '12px' }}>
                        {passwordError}
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label" htmlFor="dash-current-password">
                        현재 비밀번호
                      </label>
                      <input
                        id="dash-current-password"
                        type="password"
                        className="form-input"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(sanitizeAsciiPasswordInput(e.target.value))}
                        autoComplete="current-password"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="dash-new-password">
                        새 비밀번호
                      </label>
                      <input
                        id="dash-new-password"
                        type="password"
                        className="form-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(sanitizeAsciiPasswordInput(e.target.value))}
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                      <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        8자 이상
                      </p>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="dash-new-password-confirm">
                        새 비밀번호 확인
                      </label>
                      <input
                        id="dash-new-password-confirm"
                        type="password"
                        className="form-input"
                        value={newPasswordConfirm}
                        onChange={(e) => setNewPasswordConfirm(sanitizeAsciiPasswordInput(e.target.value))}
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowPasswordModal(false)}
                      disabled={passwordSaving}
                    >
                      취소
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={passwordSaving}>
                      {passwordSaving ? '변경 중...' : '변경하기'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 회원탈퇴 모달 */}
          {showDeleteModal && (
            <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}>
              <div className="modal">
                <div className="modal-header">
                  <h3 style={{ color: 'var(--danger)' }}>⚠️ 회원탈퇴 확인</h3>
                  <button className="btn btn-ghost btn-icon" onClick={() => setShowDeleteModal(false)}>✕</button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-danger" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <strong>⚠️ 주의사항</strong>
                    <ul style={{ margin: '8px 0 0 16px', fontSize: '0.85rem' }}>
                      <li>회원탈퇴 시 모든 단축 URL이 영구적으로 삭제됩니다.</li>
                      <li>삭제된 데이터는 복구할 수 없습니다.</li>
                      <li>탈퇴 후 같은 닉네임으로 재가입이 가능합니다.</li>
                    </ul>
                  </div>
                  <p style={{ marginBottom: '12px' }}>
                    탈퇴를 원하시면 아래에 <strong style={{ color: 'var(--danger)' }}>DELETE</strong>를 입력해주세요.
                  </p>
                  <input type="text" className="form-input" placeholder="DELETE" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} autoComplete="off" />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>취소</button>
                  <button className="btn btn-danger" onClick={handleDeleteAccount}>회원탈퇴</button>
                </div>
              </div>
            </div>
          )}
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
