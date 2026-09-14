'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function AdminLinkAccountPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState('loading'); // loading | ok | denied

  // 1단계: 구글 계정 검색 및 선택
  const [googleQuery, setGoogleQuery] = useState('');
  const [googleUsers, setGoogleUsers] = useState([]);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [selectedGoogle, setSelectedGoogle] = useState(null);

  // 2단계: 기존 계정/코드 검색 및 선택
  const [legacyQuery, setLegacyQuery] = useState('');
  const [legacyAccounts, setLegacyAccounts] = useState([]);
  const [loadingLegacy, setLoadingLegacy] = useState(false);
  const [selectedLegacy, setSelectedLegacy] = useState(null);

  // 3단계: 연동 실행 상태
  const [actionType, setActionType] = useState('auto'); // auto | direct_link | merge_codes | replace_profile
  const [linking, setLinking] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // { type: 'success'|'danger', text: string }

  // 관리자 권한 확인
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          router.push('/login');
          return;
        }
        if (data.needsOnboarding) {
          router.push('/onboarding');
          return;
        }
        if (!data.user?.is_admin) {
          setAuthState('denied');
          return;
        }
        setAuthState('ok');
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // 구글 계정 검색
  const fetchGoogleUsers = useCallback(async (q = '') => {
    setLoadingGoogle(true);
    setStatusMsg(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/link-account/search-google?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '구글 계정 목록 조회 실패');
      }
      setGoogleUsers(data.users || []);
    } catch (err) {
      setStatusMsg({ type: 'danger', text: err.message });
      setGoogleUsers([]);
    } finally {
      setLoadingGoogle(false);
    }
  }, []);

  // 기존 계정 검색
  const fetchLegacyAccounts = useCallback(async (q = '') => {
    if (!q.trim()) {
      setLegacyAccounts([]);
      return;
    }
    setLoadingLegacy(true);
    setStatusMsg(null);
    try {
      const params = new URLSearchParams();
      params.set('q', q.trim());
      const res = await fetch(`/api/admin/link-account/search-legacy?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '기존 계정 조회 실패');
      }
      setLegacyAccounts(data.accounts || []);
    } catch (err) {
      setStatusMsg({ type: 'danger', text: err.message });
      setLegacyAccounts([]);
    } finally {
      setLoadingLegacy(false);
    }
  }, []);

  // 초기 진입 시 최근 구글 가입자 목록 자동 로드
  useEffect(() => {
    if (authState === 'ok') {
      fetchGoogleUsers();
    }
  }, [authState, fetchGoogleUsers]);

  const handleSearchGoogle = (e) => {
    e.preventDefault();
    fetchGoogleUsers(googleQuery.trim());
  };

  const handleSearchLegacy = (e) => {
    e.preventDefault();
    fetchLegacyAccounts(legacyQuery.trim());
  };

  // 연동 실행
  const handleExecuteLink = async () => {
    if (!selectedGoogle || !selectedLegacy) {
      setStatusMsg({ type: 'danger', text: '구글 계정과 기존 코드를 모두 선택해주세요.' });
      return;
    }

    const confirmText =
      selectedGoogle.status === 'onboarding_pending'
        ? `구글 계정 [${selectedGoogle.email}]에 기존 계정 '${selectedLegacy.username}'(링크 ${selectedLegacy.urlCount}개)을 연동하시겠습니까?`
        : `구글 계정 [${selectedGoogle.email}]에 기존 코드 '${selectedLegacy.username}'(링크 ${selectedLegacy.urlCount}개)을 병합(Merge)하시겠습니까?`;

    if (!window.confirm(confirmText)) {
      return;
    }

    setLinking(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/admin/link-account/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authUserId: selectedGoogle.authUserId,
          googleEmail: selectedGoogle.email,
          legacyUserId: selectedLegacy.id,
          actionType,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '계정 연동 처리에 실패했습니다.');
      }

      setStatusMsg({
        type: 'success',
        text: data.message || '계정 연동이 성공적으로 완료되었습니다.',
      });

      // 선택 상태 초기화 및 목록 새로고침
      setSelectedGoogle(null);
      setSelectedLegacy(null);
      fetchGoogleUsers(googleQuery.trim());
      if (legacyQuery.trim()) {
        fetchLegacyAccounts(legacyQuery.trim());
      }
    } catch (err) {
      setStatusMsg({ type: 'danger', text: err.message });
    } finally {
      setLinking(false);
    }
  };

  if (authState === 'loading') {
    return (
      <>
        <Header />
        <main className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>관리자 권한 확인 중...</p>
        </main>
        <Footer />
      </>
    );
  }

  if (authState === 'denied') {
    return (
      <>
        <Header />
        <main className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div className="card" style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 8, color: 'var(--danger)' }}>
              접근 권한이 없습니다
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
              이 페이지는 관리자 계정만 이용할 수 있습니다.
            </p>
            <Link href="/" className="btn btn-primary btn-sm">
              홈으로 이동
            </Link>
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
        <div className="container" style={{ padding: '32px 20px 64px', maxWidth: 1080 }}>
          {/* 상단 헤더 및 안내 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
                구글 계정 연동 관리
              </h1>
              <span
                style={{
                  background: 'var(--bg-card, #fff)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '2px 10px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--primary, #3b82f6)',
                }}
              >
                관리자 전용
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0, lineHeight: 1.5 }}>
              새로 구글 계정으로 로그인한 사용자가 기존에 사용하던 본인코드(아이디)와 단축 링크들을 그대로 이어 쓸 수 있도록 간편하게 연결해주는 도구입니다.
            </p>
          </div>

          {/* 관리자 서브 탭 바로가기 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap' }}>
            <Link href="/admin" className="btn btn-sm btn-secondary">
              대시보드
            </Link>
            <Link href="/admin/slots" className="btn btn-sm btn-secondary">
              코드 슬롯 관리
            </Link>
            <Link href="/admin/link-account" className="btn btn-sm btn-primary">
              구글 계정 연동
            </Link>
            <Link href="/admin/mailing" className="btn btn-sm btn-secondary">
              단체 메일 발송 →
            </Link>
          </div>

          {/* 알림 메시지 */}
          {statusMsg && (
            <div
              className={`alert ${statusMsg.type === 'success' ? 'alert-success' : 'alert-danger'}`}
              style={{ marginBottom: 24 }}
            >
              {statusMsg.text}
            </div>
          )}

          {/* 좌우 2-Column: 1단계 구글 계정 검색 & 2단계 기존 코드 검색 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 28 }}>
            {/* 좌측: 1단계 구글 계정 검색 */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span
                  style={{
                    background: '#e0f2fe',
                    color: '#0284c7',
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                  }}
                >
                  1
                </span>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                  연동 대상 구글 계정
                </h2>
              </div>

              <form onSubmit={handleSearchGoogle} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="구글 이메일 (예: abcd@gmail.com)"
                  value={googleQuery}
                  onChange={(e) => setGoogleQuery(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={loadingGoogle}>
                  {loadingGoogle ? '검색 중' : '검색'}
                </button>
              </form>

              {/* 선택된 구글 계정 고정 카드 */}
              {selectedGoogle && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '2px solid #22c55e',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>
                      ✓ 선택된 구글 계정
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedGoogle(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      취소
                    </button>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 4 }}>
                    {selectedGoogle.email}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    상태:{' '}
                    {selectedGoogle.status === 'onboarding_pending' ? (
                      <span style={{ color: '#d97706', fontWeight: 600 }}>온보딩 대기 중 (신규)</span>
                    ) : (
                      <span style={{ color: '#0284c7', fontWeight: 600 }}>
                        프로필 있음 (코드: {selectedGoogle.shortUser?.username})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 구글 계정 목록 */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loadingGoogle ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    조회 중...
                  </div>
                ) : googleUsers.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    일치하는 구글 계정이 없습니다.
                  </div>
                ) : (
                  googleUsers.map((u) => {
                    const isSelected = selectedGoogle?.authUserId === u.authUserId;
                    return (
                      <div
                        key={u.authUserId}
                        style={{
                          border: isSelected ? '2px solid var(--primary, #3b82f6)' : '1px solid var(--border)',
                          borderRadius: 8,
                          padding: 12,
                          background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface, #fafafa)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', wordBreak: 'break-all' }}>
                            {u.email}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
                            가입일: {formatDate(u.createdAt)}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            {u.status === 'onboarding_pending' ? (
                              <span
                                style={{
                                  background: '#fef3c7',
                                  color: '#b45309',
                                  fontSize: '0.72rem',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontWeight: 600,
                                }}
                              >
                                온보딩 대기 중 (신규)
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  fontSize: '0.72rem',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontWeight: 600,
                                }}
                              >
                                프로필 등록됨 ({u.shortUser?.username})
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.8rem', padding: '5px 10px', flexShrink: 0 }}
                          onClick={() => setSelectedGoogle(u)}
                        >
                          {isSelected ? '선택됨' : '선택'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 우측: 2단계 기존 계정/코드 검색 */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#b45309',
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                  }}
                >
                  2
                </span>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                  연동할 기존 코드/계정
                </h2>
              </div>

              <form onSubmit={handleSearchLegacy} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="기존 본인코드(닉네임) 또는 이전 이메일 검색"
                  value={legacyQuery}
                  onChange={(e) => setLegacyQuery(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={loadingLegacy}>
                  {loadingLegacy ? '검색 중' : '검색'}
                </button>
              </form>

              {/* 선택된 기존 계정 고정 카드 */}
              {selectedLegacy && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '2px solid #22c55e',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>
                      ✓ 선택된 기존 계정
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedLegacy(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      취소
                    </button>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 4 }}>
                    코드: {selectedLegacy.username}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    이전 이메일: {selectedLegacy.email} · 단축 링크: <strong>{selectedLegacy.urlCount}개</strong>
                  </div>
                </div>
              )}

              {/* 기존 계정 목록 */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loadingLegacy ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    조회 중...
                  </div>
                ) : legacyAccounts.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {legacyQuery ? '일치하는 기존 코드가 없습니다.' : '기존 본인코드(닉네임) 또는 이메일을 검색해주세요.'}
                  </div>
                ) : (
                  legacyAccounts.map((acc) => {
                    const isSelected = selectedLegacy?.id === acc.id;
                    return (
                      <div
                        key={acc.id}
                        style={{
                          border: isSelected ? '2px solid var(--primary, #3b82f6)' : '1px solid var(--border)',
                          borderRadius: 8,
                          padding: 12,
                          background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface, #fafafa)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.95rem' }}>{acc.username}</strong>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                background: 'var(--surface-secondary, #eee)',
                                padding: '1px 6px',
                                borderRadius: 4,
                              }}
                            >
                              링크 {acc.urlCount}개
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
                            {acc.email}
                          </div>

                          {/* 보유 코드 목록 */}
                          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                            {acc.codes?.map((c) => (
                              <span
                                key={c.id}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: c.is_primary ? 'var(--primary, #3b82f6)' : 'var(--border)',
                                  color: c.is_primary ? '#fff' : 'var(--text)',
                                }}
                              >
                                {c.is_primary ? '★ ' : ''}{c.username}
                              </span>
                            ))}
                          </div>

                          {/* 연동 상태 */}
                          <div style={{ marginTop: 4 }}>
                            {acc.isLinked ? (
                              <span style={{ fontSize: '0.72rem', color: '#0284c7' }}>
                                ℹ️ 현재 Auth 연동됨 ({acc.linkedEmail || '다른 계정'})
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                🔓 미연동 레거시 계정
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.8rem', padding: '5px 10px', flexShrink: 0 }}
                          onClick={() => setSelectedLegacy(acc)}
                        >
                          {isSelected ? '선택됨' : '선택'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 3단계: 연동 실행 및 확인 패널 (두 계정이 모두 선택되었을 때 활성화) */}
          <div
            className="card"
            style={{
              padding: 24,
              border: selectedGoogle && selectedLegacy ? '2px solid var(--primary, #3b82f6)' : '1px dashed var(--border)',
              background: selectedGoogle && selectedLegacy ? 'var(--bg-card, #fff)' : 'var(--surface, #fafafa)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span
                style={{
                  background: selectedGoogle && selectedLegacy ? 'var(--primary, #3b82f6)' : 'var(--border)',
                  color: '#fff',
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
              >
                3
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                연동 확인 및 실행
              </h2>
            </div>

            {!selectedGoogle || !selectedLegacy ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
                1단계에서 <strong>연동할 구글 계정</strong>을 선택하고, 2단계에서 <strong>기존 코드</strong>를 선택하면 연동 버튼이 활성화됩니다.
              </p>
            ) : (
              <div>
                {/* 연동 요약 플로우 다이어그램 */}
                <div
                  style={{
                    background: 'var(--surface, #f8fafc)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>구글 로그인 계정</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
                      {selectedGoogle.email}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary, #3b82f6)' }}>
                      {selectedGoogle.status === 'onboarding_pending'
                        ? '온보딩 대기 중 (새 사용자)'
                        : `기존 프로필 있음 (${selectedGoogle.shortUser?.username})`}
                    </div>
                  </div>

                  <div style={{ fontSize: '1.5rem', color: 'var(--primary, #3b82f6)', fontWeight: 800 }}>
                    ⟵
                  </div>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>가져올 기존 데이터</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
                      코드: {selectedLegacy.username}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      단축 링크 <strong>{selectedLegacy.urlCount}개</strong> · 코드 {selectedLegacy.codeCount}개
                    </div>
                  </div>
                </div>

                {/* 상황별 안내 문구 및 옵션 */}
                <div style={{ marginBottom: 20, fontSize: '0.9rem', lineHeight: 1.6 }}>
                  {selectedGoogle.status === 'onboarding_pending' ? (
                    <div className="alert alert-success" style={{ margin: 0 }}>
                      ℹ️ <strong>직접 연동 모드:</strong> 구글 계정에 아직 프로필이 생성되지 않았습니다. 기존 계정(
                      <code>{selectedLegacy.username}</code>)과 단축 링크 {selectedLegacy.urlCount}개가 구글 계정에
                      직접 연결되며, 다음 번 구글 로그인 시 즉시 대시보드로 이동합니다.
                    </div>
                  ) : (
                    <div className="alert alert-warning" style={{ margin: 0 }}>
                      ⚠️ <strong>코드 병합(Merge) 모드:</strong> 구글 계정에 이미 프로필(
                      <code>{selectedGoogle.shortUser?.username}</code>)이 있습니다. 기존 코드(
                      <code>{selectedLegacy.username}</code>)와 모든 단축 링크가 구글 계정에 추가 등록됩니다. (슬롯
                      자동 상향)
                      <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="actionType"
                            value="merge_codes"
                            checked={actionType === 'auto' || actionType === 'merge_codes'}
                            onChange={() => setActionType('merge_codes')}
                          />
                          코드 및 링크 병합 (권장)
                        </label>
                        {selectedGoogle.shortUser?.codes?.length <= 1 && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="actionType"
                              value="replace_profile"
                              checked={actionType === 'replace_profile'}
                              onChange={() => setActionType('replace_profile')}
                            />
                            임시 프로필 삭제 후 대체
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 실행 버튼 */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 700 }}
                    onClick={handleExecuteLink}
                    disabled={linking}
                  >
                    {linking ? '연동 처리 중...' : '🔗 계정 연동 실행하기'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedGoogle(null);
                      setSelectedLegacy(null);
                    }}
                    disabled={linking}
                  >
                    선택 초기화
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
