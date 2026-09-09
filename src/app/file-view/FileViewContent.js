'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { buildShortUrl } from '@/lib/siteUrl';

function getFileIcon(fileName, mime) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  if (mime?.startsWith('video/') || ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv'].includes(ext)) return '🎬';
  if (mime?.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'].includes(ext)) return '🎵';
  if (mime?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return '🖼️';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
  if (['pdf'].includes(ext)) return '📕';
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['ppt', 'pptx'].includes(ext)) return '📈';
  return '📎';
}

function formatKoreanDeadline(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[d.getDay()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일 (${dayName}) ${hours}:${minutes}`;
}

export default function FileViewContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const username = searchParams.get('username');

  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(code));
  const [error, setError] = useState(() => !code);
  const [expiredInfo, setExpiredInfo] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [serverSkew, setServerSkew] = useState(0);

  useEffect(() => {
    if (!code) return;

    let ignore = false;
    const params = new URLSearchParams({ code });
    if (username) params.set('username', username);

    fetch(`/api/file-meta?${params}`)
      .then(async (res) => {
        if (ignore) return;
        const data = await res.json();
        if (res.ok && data.success) {
          setMeta(data);
          if (data.server_time) {
            setServerSkew(new Date(data.server_time).getTime() - Date.now());
          }
        } else if (data?.expired) {
          setExpiredInfo({
            fileName: data.file_name || '',
            expirationDate: data.expiration_date || null,
          });
          setError(true);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!ignore) setError(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [code, username]);

  // 만료 시간 카운트다운을 위한 1초 인터벌 타이머
  useEffect(() => {
    if (!meta?.expiration_date) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [meta?.expiration_date]);

  const shortUrl = buildShortUrl({ code, username: username || undefined });

  const downloadHref = (() => {
    const params = new URLSearchParams({ code: code || '' });
    if (username) params.set('username', username);
    return `/api/file-download?${params}`;
  })();

  const previewHref = (() => {
    const params = new URLSearchParams({ code: code || '', inline: '1' });
    if (username) params.set('username', username);
    return `/api/file-download?${params}`;
  })();

  const isImagePreview =
    meta?.previewable && meta?.file_mime?.startsWith('image/') && !meta.file_mime.includes('svg');
  const isPdfPreview = meta?.previewable && meta?.file_mime === 'application/pdf';

  const expirationInfo = useMemo(() => {
    if (!meta) return null;
    const expDateStr = meta.expiration_date;
    if (!expDateStr) {
      return { isIndefinite: true, urgency: 'indefinite' };
    }

    const expTime = new Date(expDateStr).getTime();
    if (isNaN(expTime)) {
      return { isIndefinite: true, urgency: 'indefinite' };
    }

    // 10년 이상 미래 만료일은 무제한(상시 보관)으로 간주
    const yearsDiff = (expTime - now) / (365.25 * 24 * 3600 * 1000);
    if (yearsDiff > 10) {
      return { isIndefinite: true, urgency: 'indefinite' };
    }

    const adjustedNow = now + serverSkew;
    const timeLeftMs = Math.max(0, expTime - adjustedNow);
    const isExpired = timeLeftMs <= 0;

    const totalSeconds = Math.floor(timeLeftMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let urgency = 'normal';
    if (isExpired) {
      urgency = 'expired';
    } else if (timeLeftMs < 60 * 60 * 1000) {
      urgency = 'critical';
    } else if (timeLeftMs < 24 * 60 * 60 * 1000) {
      urgency = 'warning';
    }

    let countdownText = '';
    if (isExpired) {
      countdownText = '다운로드 기간 만료';
    } else if (days > 0) {
      countdownText = `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
    } else if (hours > 0) {
      countdownText = `${hours}시간 ${minutes}분 ${seconds}초`;
    } else if (minutes > 0) {
      countdownText = `${minutes}분 ${seconds}초`;
    } else {
      countdownText = `${seconds}초`;
    }

    let badgeText = '';
    if (isExpired) {
      badgeText = '만료됨';
    } else if (days > 0) {
      badgeText = `D-${days} (${hours}시간 남음)`;
    } else if (hours > 0) {
      badgeText = `${hours}시간 ${minutes}분 남음`;
    } else {
      badgeText = `${minutes}분 ${seconds}초 남음`;
    }

    let percentRemaining = null;
    if (meta.created_at) {
      const createdTime = new Date(meta.created_at).getTime();
      const totalSpan = expTime - createdTime;
      if (totalSpan > 0) {
        percentRemaining = Math.max(0, Math.min(100, (timeLeftMs / totalSpan) * 100));
      }
    }

    return {
      isIndefinite: false,
      isExpired,
      timeLeftMs,
      urgency,
      countdownText,
      badgeText,
      deadlineFormatted: formatKoreanDeadline(expDateStr),
      percentRemaining,
    };
  }, [meta, now, serverSkew]);

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
                <div className="text-viewer-error-icon">
                  {expiredInfo ? '⏳' : '😢'}
                </div>
                <h2>
                  {expiredInfo ? '다운로드 기간이 만료되었습니다' : '파일을 찾을 수 없습니다'}
                </h2>
                {expiredInfo ? (
                  <>
                    {expiredInfo.fileName && (
                      <p style={{ fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>
                        {expiredInfo.fileName}
                      </p>
                    )}
                    <p>
                      다운로드 가능 기간
                      {expiredInfo.expirationDate ? `(${formatKoreanDeadline(expiredInfo.expirationDate)})` : ''}
                      이 종료되어 파일 다운로드가 마감되었습니다.
                    </p>
                    {username && (
                      <p style={{ marginTop: '8px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        💡 게시자가 대시보드 [수정]에서 새 파일을 등록하면 다운로드 기간이 다시 연장됩니다.
                      </p>
                    )}
                  </>
                ) : (
                  <p>요청하신 단축 주소가 없거나 만료·삭제되었습니다.</p>
                )}
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

  const isExpired = Boolean(expirationInfo?.isExpired);
  const urgency = expirationInfo?.urgency || 'normal';
  const fileIcon = getFileIcon(meta.file_name, meta.file_mime);

  return (
    <>
      <Header />
      <main>
        <div className="text-viewer-page">
          <div className="text-viewer-card">
            <div className="text-viewer-header">
              <div className="text-viewer-header-left">
                <div className="text-viewer-icon">{fileIcon}</div>
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
                    {expirationInfo && !expirationInfo.isIndefinite && (
                      <>
                        <span className="text-viewer-meta-dot">·</span>
                        <span className={`file-view-header-chip is-${urgency}`}>
                          ⏱️ {expirationInfo.badgeText}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isExpired ? (
                <button
                  type="button"
                  className="btn btn-secondary text-viewer-copy-btn btn-disabled"
                  disabled
                  title="다운로드 기간이 만료되었습니다"
                >
                  🚫 다운로드 만료됨
                </button>
              ) : (
                <a className="btn btn-primary text-viewer-copy-btn" href={downloadHref}>
                  ⬇ 다운로드
                </a>
              )}
            </div>

            <div className="text-viewer-body" style={{ padding: '28px 24px' }}>
              {/* 파일명 정보 */}
              <div className="file-view-file-info">
                <div className="file-view-type-icon">{fileIcon}</div>
                <div className="file-view-file-details">
                  <h3 className="file-view-filename">{meta.file_name}</h3>
                  <div className="file-view-filesize-badge">
                    {meta.file_size_label}
                    {meta.file_mime ? ` · ${meta.file_mime}` : ''}
                  </div>
                </div>
              </div>

              {!isExpired && (isImagePreview || isPdfPreview) && (
                <div className="file-view-preview">
                  {isImagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewHref}
                      alt={meta.file_name || '미리보기'}
                      className="file-view-preview-image"
                    />
                  ) : (
                    <iframe
                      title={meta.file_name || 'PDF 미리보기'}
                      src={previewHref}
                      className="file-view-preview-pdf"
                    />
                  )}
                </div>
              )}

              {/* 다운로드 가능 시간 및 만료 안내 카드 */}
              {expirationInfo?.isIndefinite ? (
                <div className="file-view-expiry-card is-indefinite">
                  <div className="file-view-expiry-top">
                    <div className="file-view-expiry-title">
                      <span>⏱️</span>
                      <span>다운로드 가능 시간</span>
                    </div>
                    <span className="file-view-expiry-badge badge-indefinite">
                      ♾️ 상시 보관
                    </span>
                  </div>
                  <div className="file-view-countdown-container">
                    <span className="file-view-countdown-value time-indefinite">
                      상시 다운로드 가능
                    </span>
                  </div>
                  <div className="file-view-expiry-notice">
                    이 파일은 별도의 만료 기한 없이 보관됩니다.
                    <span className="file-view-expiry-sub">
                      ※ 숏.한국 회원 공유 정책에 따라 최근 3개월간 접속이 없을 경우에만 자동 정리될 수 있습니다.
                    </span>
                  </div>
                </div>
              ) : (
                <div className={`file-view-expiry-card is-${urgency}`}>
                  <div className="file-view-expiry-top">
                    <div className="file-view-expiry-title">
                      <span>
                        {isExpired ? '⏳' : urgency === 'critical' ? '🚨' : urgency === 'warning' ? '⚠️' : '⏱️'}
                      </span>
                      <span>다운로드 가능 시간</span>
                    </div>
                    <span className={`file-view-expiry-badge badge-${urgency}`}>
                      {isExpired
                        ? '🚫 만료됨'
                        : urgency === 'critical'
                          ? '🚨 곧 마감 (1시간 이내)'
                          : urgency === 'warning'
                            ? '⚠️ 24시간 이내 마감'
                            : '🟢 다운로드 가능'}
                    </span>
                  </div>

                  <div className="file-view-countdown-container">
                    <span className={`file-view-countdown-value time-${urgency}`}>
                      {expirationInfo?.countdownText}
                    </span>
                    {!isExpired && (
                      <span className="file-view-countdown-label">남음</span>
                    )}
                  </div>

                  {/* 만료 진행 바 */}
                  {!isExpired && expirationInfo?.percentRemaining !== null && (
                    <div
                      className="file-view-progress-wrap"
                      title={`보관 기간 중 약 ${Math.round(expirationInfo.percentRemaining)}% 남음`}
                    >
                      <div
                        className={`file-view-progress-bar bar-${urgency}`}
                        style={{ width: `${expirationInfo.percentRemaining}%` }}
                      />
                    </div>
                  )}

                  <div className="file-view-expiry-notice">
                    {isExpired ? (
                      <>
                        <strong>{expirationInfo?.deadlineFormatted}</strong>에 다운로드가 종료되었습니다.
                        <span className="file-view-expiry-sub">
                          저장본이 삭제되어 더 이상 다운로드할 수 없습니다. 게시자가 같은 단축 주소에 새 파일을 등록하면 다시 받을 수 있습니다.
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>{expirationInfo?.deadlineFormatted}</strong>까지 다운로드할 수 있습니다.
                        <span className="file-view-expiry-sub">
                          💡 만료되면 다운로드가 차단되고 저장본이 삭제됩니다. 단축 주소는 유지되며 게시자가 수정에서 재등록할 수 있습니다.
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-viewer-footer">
              <div className="text-viewer-source">
                <span className="text-viewer-source-label">단축 주소</span>
                <code className="text-viewer-source-url">{shortUrl}</code>
              </div>
              <div className="text-viewer-footer-actions">
                {isExpired ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-disabled"
                    disabled
                  >
                    🚫 다운로드 만료됨
                  </button>
                ) : (
                  <a className="btn btn-primary btn-sm" href={downloadHref}>
                    ⬇ 다운로드
                  </a>
                )}
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
