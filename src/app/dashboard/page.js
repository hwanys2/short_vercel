'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UrlForm from '@/components/UrlForm';
import UrlResult from '@/components/UrlResult';
import { buildShortUrl } from '@/lib/siteUrl';
import { useLinkScope } from '@/lib/useLinkScope';
import {
  TEMP_SCOPE,
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
  const [createResult, setCreateResult] = useState(null);
  const createResultRef = useRef(null);

  const { codes: userCodes, activeUsername: createUsername } = useLinkScope(user);

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

  const handleCreateResult = (data) => {
    setCreateResult(data);
    fetchUrls();
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

          <UrlForm user={user} onResult={handleCreateResult} />


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
                    { id: 'html', label: '웹페이지' },
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
                          <td>{url.type === 'text' ? '📋' : url.type === 'file' ? '📎' : url.type === 'html' ? '🌐' : '🔗'}</td>
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
                              : (url.type === 'file' || url.type === 'html')
                                ? (url.file_name || (url.type === 'html' ? '웹페이지' : '파일'))
                                : url.original_url
                          }>
                            {url.type === 'text'
                              ? (url.text_preview ? `${url.text_preview}...` : '텍스트 메모')
                              : url.type === 'html'
                                ? (
                                    <span>
                                      {url.file_name || 'index.html'}
                                      <span className="dash-retention-badge is-active" style={{ marginLeft: '6px' }}>웹페이지</span>
                                    </span>
                                  )
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
