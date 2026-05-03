'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

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

  // 새 URL 생성 폼
  const [newUrl, setNewUrl] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newMode, setNewMode] = useState('url');
  const [newText, setNewText] = useState('');
  const [creating, setCreating] = useState(false);

  // 회원탈퇴 모달
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

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
  }, [user, page]);

  const fetchUrls = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/urls?page=${page}&per_page=10`);
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

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMessage('');
    try {
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
    } catch {
      setMessage('오류가 발생했습니다.');
      setMessageType('danger');
    } finally {
      setCreating(false);
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

  const copyUrl = (code) => {
    const url = `${baseUrl}${user.username}/${code}`;
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
              ✨ 영구 URL · 기본 URL: {baseUrl}{user.username}/코드
            </div>
          </div>

          {message && (
            <div className={`alert alert-${messageType}`} style={{ maxWidth: '800px', margin: '0 auto 20px' }}>
              {message}
            </div>
          )}

          {/* 새 URL 생성 */}
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto 24px' }}>
            <div className="card-header">➕ 새 단축 주소 생성</div>
            <div className="card-body">
              <div className="mode-tabs" role="tablist" style={{ marginBottom: '16px' }}>
                <button type="button" role="tab" className={`mode-tab ${newMode === 'url' ? 'is-active' : ''}`} onClick={() => setNewMode('url')}>
                  <span className="mode-tab-icon">🔗</span> URL 단축
                </button>
                <button type="button" role="tab" className={`mode-tab ${newMode === 'text' ? 'is-active' : ''}`} onClick={() => setNewMode('text')}>
                  <span className="mode-tab-icon">📋</span> 텍스트 공유
                </button>
              </div>
              <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {newMode === 'url' ? (
                  <div className="form-group" style={{ flex: '2', minWidth: '200px', marginBottom: 0 }}>
                    <label className="form-label" htmlFor="dash-url">원본 URL</label>
                    <input id="dash-url" type="url" className="form-input" placeholder="https://example.com" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} required />
                  </div>
                ) : (
                  <div className="form-group" style={{ flex: '2', minWidth: '200px', marginBottom: 0 }}>
                    <label className="form-label" htmlFor="dash-text">공유할 텍스트</label>
                    <textarea id="dash-text" className="form-input form-textarea" placeholder="프롬프트, 코드, 메시지 등" value={newText} onChange={(e) => setNewText(e.target.value)} required rows={3} maxLength={50000} />
                  </div>
                )}
                <div className="form-group" style={{ flex: '1.5', minWidth: '180px', marginBottom: 0 }}>
                  <label className="form-label" htmlFor="dash-code">단축 코드</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{user.username}/</span>
                    <input id="dash-code" type="text" className="form-input" placeholder="원하는코드" value={newCode} onChange={(e) => setNewCode(e.target.value)} required />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={creating} style={{ height: '48px', marginBottom: 0 }}>
                  {creating ? '생성 중...' : '생성'}
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
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <span className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
                </div>
              ) : urls.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📂</div>
                  <h3>아직 생성된 URL이 없습니다</h3>
                  <p>위 폼을 사용하여 첫 번째 영구 URL을 만들어보세요!</p>
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
                          <td>{url.type === 'text' ? '📋' : '🔗'}</td>
                          <td>
                            <a href={`${baseUrl}${user.username}/${url.code}`} target="_blank" rel="noopener noreferrer">
                              {user.username}/{url.code}
                            </a>
                          </td>
                          <td className="url-cell" title={url.type === 'text' ? (url.text_preview || '텍스트 메모') : url.original_url}>
                            {url.type === 'text' ? (url.text_preview ? `${url.text_preview}...` : '텍스트 메모') : url.original_url}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{new Date(url.created_at).toLocaleDateString('ko-KR')}</td>
                          <td>{url.visits}</td>
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
            <button onClick={() => { fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/')); }} className="btn btn-danger btn-sm">
              로그아웃
            </button>
            <div style={{ marginTop: '16px' }}>
              <button onClick={() => setShowDeleteModal(true)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', cursor: 'pointer', opacity: 0.6 }}>
                회원탈퇴
              </button>
            </div>
          </div>

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
