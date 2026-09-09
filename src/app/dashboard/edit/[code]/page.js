'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { formatFileSize, MAX_FILE_BYTES, getFileCapacityRetentionInfo } from '@/lib/shortFilesShared';
import { uploadFileToR2Only } from '@/lib/fileUploadClient';

export default function EditUrlPage() {
  const router = useRouter();
  const params = useParams();
  const routeCode = typeof params?.code === 'string' ? params.code : params?.code?.[0] ?? '';

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [saving, setSaving] = useState(false);
  const [urlType, setUrlType] = useState('url'); // 'url' | 'text' | 'file'
  const [originalUrl, setOriginalUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(null);
  const [expirationDate, setExpirationDate] = useState(null);
  const [replacementFile, setReplacementFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [customCode, setCustomCode] = useState('');
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [hadPasswordProtection, setHadPasswordProtection] = useState(false);
  const [linkPassword, setLinkPassword] = useState('');
  const [confirmLinkPassword, setConfirmLinkPassword] = useState('');
  const [error, setError] = useState('');
  const abortControllerRef = useRef(null);
  const [visitDays, setVisitDays] = useState(30);
  const [visitSeries, setVisitSeries] = useState([]);
  const [visitTotal, setVisitTotal] = useState(0);
  const [visitsLoading, setVisitsLoading] = useState(false);

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
      setFileName(data.url.file_name || '');
      setFileSize(data.url.file_size ?? null);
      setExpirationDate(data.url.expiration_date || null);
      setReplacementFile(null);
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

  useEffect(() => {
    if (!user || !routeCode) return;
    let ignore = false;
    setVisitsLoading(true);
    fetch(`/api/urls/${encodeURIComponent(routeCode)}/visits?days=${visitDays}`)
      .then((res) => res.json())
      .then((data) => {
        if (ignore) return;
        if (data.success) {
          setVisitSeries(data.series || []);
          setVisitTotal(data.visits_total || 0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setVisitsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [user, routeCode, visitDays]);

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
      } else if (urlType === 'file') {
        if (replacementFile) {
          if (replacementFile.size > MAX_FILE_BYTES) {
            setError(`파일 크기는 최대 ${formatFileSize(MAX_FILE_BYTES)}까지 가능합니다.`);
            setSaving(false);
            return;
          }
          const abortController = new AbortController();
          abortControllerRef.current = abortController;
          const uploaded = await uploadFileToR2Only({
            file: replacementFile,
            customCode: customCode.trim(),
            onProgress: (prog) => setUploadProgress(prog),
            signal: abortController.signal,
            isEdit: true,
          });

          payload.new_file_key = uploaded.key;
          payload.new_file_name = uploaded.fileName;
          payload.new_file_size = uploaded.fileSize;
          payload.new_file_mime = uploaded.fileMime;
          payload.new_public_url = uploaded.publicUrl;
        }
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
    } catch (err) {
      console.error('Save error:', err);
      setError(err?.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
      setUploadProgress(null);
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
  const isFile = urlType === 'file';
  const pageTitle = isText ? '텍스트 수정' : isFile ? '파일 공유 수정' : 'URL 수정';
  const cardTitle = isText ? '📋 텍스트 편집' : isFile ? '📎 파일 공유 편집' : '✏️ 단축 URL 편집';

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
                  {!isText && !isFile && (
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

                  {/* 파일 타입: 현재 파일 상태 및 새 파일 교체 UI */}
                  {isFile && (() => {
                    const isExpired = expirationDate && new Date(expirationDate) <= new Date();
                    return (
                      <div className="form-group" style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <label className="form-label" style={{ fontWeight: 600, fontSize: '0.95rem' }}>공유 파일 정보</label>

                        {/* 현재 등록된 파일 상태 카드 */}
                        <div style={{ padding: '12px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontWeight: 600, wordBreak: 'break-all' }}>📁 {fileName || '파일'}</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              {fileSize != null ? formatFileSize(fileSize) : ''}
                            </span>
                          </div>
                          {expirationDate && (
                            <div style={{ marginTop: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: isExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                color: isExpired ? '#ef4444' : '#10b981',
                              }}>
                                {isExpired ? '🚫 다운로드 기간 만료됨' : '🟢 다운로드 가능'}
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>
                                보관 만료: {new Date(expirationDate).toLocaleString('ko-KR')}
                              </span>
                            </div>
                          )}
                          {isExpired && (
                            <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#ef4444', lineHeight: '1.4' }}>
                              💡 보관 기간이 만료되어 다운로드가 종료되었습니다. 아래에서 새 파일을 등록하여 저장하시면 다운로드 기간이 다시 늘어납니다!
                            </p>
                          )}
                        </div>

                        {/* 새 파일 등록 / 재등록 인풋 */}
                        <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '14px' }}>
                          <label className="form-label" htmlFor="edit-replace-file" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            🔄 새 파일로 교체 / 재등록 {isExpired ? '(필수)' : '(선택)'}
                          </label>
                          <input
                            id="edit-replace-file"
                            type="file"
                            className="form-input"
                            onChange={(e) => setReplacementFile(e.target.files?.[0] || null)}
                          />
                          <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                            기존 파일을 유지하려면 비워 두세요. 새 파일을 선택하고 저장하면 기존 파일은 자동 삭제되며, 새 파일 용량(10MB 이하 30일, 10MB~1GB 7일, 1GB 초과 2일)에 맞춰 다운로드 기간이 자동으로 연장됩니다.
                          </p>

                          {/* 새로 선택한 파일 정보 및 기간 안내 */}
                          {replacementFile && (() => {
                            const info = getFileCapacityRetentionInfo(replacementFile.size, true);
                            return (
                              <div
                                style={{
                                  marginTop: '12px',
                                  padding: '12px',
                                  background: info.bgColor,
                                  border: `1px solid ${info.borderColor}`,
                                  borderRadius: '8px',
                                  fontSize: '0.85rem',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: '600' }}>선택된 새 파일: {replacementFile.name}</span>
                                  <span style={{ fontWeight: '700', color: info.color }}>{formatFileSize(replacementFile.size)} ({info.badge})</span>
                                </div>
                                <div style={{ color: 'var(--text-color, #1e293b)', lineHeight: '1.4' }}>
                                  ⏱️ <strong>새 다운로드 기간:</strong> {info.notice} (저장 시 현재 시점부터 연장)
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}

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
                        pattern={"[가-힣a-zA-Z0-9_\\-]+"}
                        title="한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능"
                      />
                    </div>
                  </div>

                  {/* 파일 업로드 진행률 바 */}
                  {uploadProgress && (
                    <div style={{ margin: '16px 0', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
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
                      {uploadProgress.detailText && (
                        <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {uploadProgress.detailText}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? (uploadProgress ? '파일 업로드 및 저장 중...' : '저장 중...') : '저장'}
                    </button>
                    <Link href="/dashboard" className="btn btn-secondary">
                      취소
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="card" style={{ maxWidth: '800px', margin: '0 auto 24px' }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span>클릭 통계 (총 {visitTotal.toLocaleString()}회)</span>
              <div className="dashboard-filter-chips" role="group" aria-label="기간">
                <button
                  type="button"
                  className={`dash-chip ${visitDays === 7 ? 'is-active' : ''}`}
                  onClick={() => setVisitDays(7)}
                >
                  7일
                </button>
                <button
                  type="button"
                  className={`dash-chip ${visitDays === 30 ? 'is-active' : ''}`}
                  onClick={() => setVisitDays(30)}
                >
                  30일
                </button>
              </div>
            </div>
            <div className="card-body">
              {visitsLoading ? (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                  <span className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
                </div>
              ) : (
                <>
                  <VisitBarChart series={visitSeries} />
                  <p className="visit-chart-note">
                    일별 클릭은 기능 배포 이후부터 집계됩니다. 이전 누적 클릭은 총합에만 포함됩니다.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function VisitBarChart({ series }) {
  const counts = (series || []).map((s) => s.count || 0);
  const max = Math.max(1, ...counts);
  if (!series?.length) {
    return <p style={{ color: 'var(--text-muted)', margin: 0 }}>표시할 데이터가 없습니다.</p>;
  }
  return (
    <div className="visit-bar-chart" role="img" aria-label="일별 클릭 막대 그래프">
      {series.map((s) => (
        <div key={s.day} className="visit-bar-col" title={`${s.day}: ${s.count}회`}>
          <div
            className="visit-bar"
            style={{ height: `${Math.max(s.count > 0 ? 8 : 2, Math.round((s.count / max) * 120))}px` }}
          />
          <span className="visit-bar-label">{s.day.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}
