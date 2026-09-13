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

export default function AdminSlotsPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState('loading'); // loading | ok | denied
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // { type: 'success'|'danger', text: string }
  const [updatingId, setUpdatingId] = useState(null);
  const [inputSlots, setInputSlots] = useState({}); // { [userId]: number }
  const [viewMode, setViewMode] = useState('search'); // 'search' | 'boosted'

  // 관리자 인증 체크
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

  // 사용자 목록 조회
  const fetchUsers = useCallback(async (q = '', mode = '') => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (mode) params.set('mode', mode);

      const res = await fetch(`/api/admin/slots?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '사용자 목록 조회에 실패했습니다.');
      }

      setUsers(data.users || []);
      // 각 사용자 슬롯 입력 초기화
      const nextInputs = {};
      (data.users || []).forEach((u) => {
        nextInputs[u.id] = u.max_codes;
      });
      setInputSlots((prev) => ({ ...prev, ...nextInputs }));
    } catch (err) {
      setStatusMsg({ type: 'danger', text: err.message });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드: 최근 가입 사용자 로드
  useEffect(() => {
    if (authState === 'ok') {
      fetchUsers();
    }
  }, [authState, fetchUsers]);

  // 검색 제출
  const handleSearch = (e) => {
    e.preventDefault();
    setViewMode('search');
    fetchUsers(searchQuery.trim());
  };

  // 상향된 사용자만 보기
  const handleShowBoosted = () => {
    setViewMode('boosted');
    setSearchQuery('');
    fetchUsers('', 'boosted');
  };

  // 슬롯 인풋 변경
  const handleSlotInputChange = (userId, value) => {
    setInputSlots((prev) => ({
      ...prev,
      [userId]: value,
    }));
  };

  // 슬롯 증액 (+1, +3, +5 등)
  const handleAddSlots = (userId, currentVal, amount) => {
    const cur = parseInt(inputSlots[userId] ?? currentVal, 10) || currentVal;
    const nextVal = Math.min(100, Math.max(1, cur + amount));
    setInputSlots((prev) => ({
      ...prev,
      [userId]: nextVal,
    }));
  };

  // 슬롯 저장
  const handleSaveSlot = async (user) => {
    const nextMax = parseInt(inputSlots[user.id], 10);
    if (isNaN(nextMax) || nextMax < 1 || nextMax > 100) {
      setStatusMsg({ type: 'danger', text: '코드 슬롯은 1개 이상 100개 이하의 숫자여야 합니다.' });
      return;
    }

    if (nextMax < user.code_count) {
      setStatusMsg({
        type: 'danger',
        text: `현재 사용 중인 본인 코드 수(${user.code_count}개)보다 적게 줄일 수 없습니다.`,
      });
      return;
    }

    setUpdatingId(user.id);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/admin/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          maxCodes: nextMax,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '슬롯 변경에 실패했습니다.');
      }

      setStatusMsg({ type: 'success', text: data.message || '슬롯 개수가 성공적으로 변경되었습니다.' });

      // 목록 상태 갱신
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, max_codes: nextMax } : u))
      );
    } catch (err) {
      setStatusMsg({ type: 'danger', text: err.message });
    } finally {
      setUpdatingId(null);
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
        <div className="container" style={{ padding: '32px 20px 64px', maxWidth: 960 }}>
          {/* 상단 헤더 및 네비게이션 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
                본인코드 슬롯 관리
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
              특정 구글 계정(이메일)의 본인코드 최대 보유 슬롯(기본 2개)을 조회하고 늘려줄 수 있습니다.
              슬롯을 늘려주면 해당 사용자가 프로필에서 본인코드를 추가 등록할 수 있습니다.
            </p>
          </div>

          {/* 관리자 서브 탭 바로가기 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap' }}>
            <Link href="/admin/slots" className="btn btn-sm btn-primary">
              코드 슬롯 관리
            </Link>
            <Link href="/admin/link-account" className="btn btn-sm btn-secondary">
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
              style={{ marginBottom: 20 }}
            >
              {statusMsg.text}
            </div>
          )}

          {/* 검색 바 */}
          <div className="card" style={{ marginBottom: 24, padding: 20 }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="구글 이메일(예: user@gmail.com) 또는 닉네임 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: '1 1 280px' }}
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '검색 중...' : '사용자 조회'}
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${viewMode === 'boosted' ? 'is-active' : ''}`}
                onClick={handleShowBoosted}
                disabled={loading}
              >
                슬롯 상향된 사용자 보기 (3개 이상)
              </button>
            </form>
          </div>

          {/* 검색 결과 목록 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                {viewMode === 'boosted'
                  ? '슬롯 상향 사용자 목록'
                  : searchQuery
                  ? `'${searchQuery}' 검색 결과`
                  : '최근 등록 사용자'}
              </h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                총 {users.length}명
              </span>
            </div>

            {loading ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                사용자 정보를 불러오는 중입니다...
              </div>
            ) : users.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                조회된 사용자가 없습니다. 이메일 주소를 다시 확인해주세요.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {users.map((user) => {
                  const currentInput = inputSlots[user.id] ?? user.max_codes;
                  const isBoosted = user.max_codes > 2;
                  const isUpdating = updatingId === user.id;

                  return (
                    <div
                      key={user.id}
                      className="card"
                      style={{
                        padding: 20,
                        borderLeft: isBoosted ? '4px solid var(--primary, #3b82f6)' : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 16,
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* 왼쪽: 사용자 기본 정보 */}
                        <div style={{ flex: '1 1 300px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <strong style={{ fontSize: '1.05rem' }}>{user.email}</strong>
                            {isBoosted && (
                              <span
                                style={{
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  color: 'var(--primary, #3b82f6)',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                }}
                              >
                                {user.max_codes}개 슬롯
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                            닉네임: <strong>{user.username || '-'}</strong> · 가입일: {formatDate(user.created_at)}
                          </div>

                          {/* 보유 본인코드 뱃지 목록 */}
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                              보유 본인 코드 ({user.code_count} / {user.max_codes}개 사용 중):
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {user.codes && user.codes.length > 0 ? (
                                user.codes.map((c) => (
                                  <span
                                    key={c.id}
                                    style={{
                                      background: c.is_primary ? 'var(--primary, #3b82f6)' : 'var(--surface)',
                                      color: c.is_primary ? '#fff' : 'var(--text)',
                                      border: c.is_primary ? 'none' : '1px solid var(--border)',
                                      padding: '3px 8px',
                                      borderRadius: 6,
                                      fontSize: '0.8rem',
                                      fontWeight: 600,
                                    }}
                                    title={c.is_primary ? '대표 코드' : '추가 코드'}
                                  >
                                    {c.is_primary ? '★ ' : ''}{c.username}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  등록된 본인 코드 없음
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 오른쪽: 슬롯 개수 변경 컨트롤 */}
                        <div
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            padding: '12px 16px',
                            borderRadius: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            minWidth: 260,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>슬롯 한도 설정:</span>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                              현재: <strong style={{ color: 'var(--text)' }}>{user.max_codes}개</strong>
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="number"
                              min={user.code_count || 1}
                              max={100}
                              className="form-input"
                              value={currentInput}
                              onChange={(e) => handleSlotInputChange(user.id, e.target.value)}
                              style={{ width: 80, padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}
                              disabled={isUpdating}
                            />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>개</span>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleSaveSlot(user)}
                              disabled={isUpdating || parseInt(currentInput, 10) === user.max_codes}
                              style={{ marginLeft: 'auto' }}
                            >
                              {isUpdating ? '저장 중...' : '저장'}
                            </button>
                          </div>

                          {/* 빠른 증액 버튼 */}
                          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                              onClick={() => handleAddSlots(user.id, user.max_codes, 1)}
                              disabled={isUpdating}
                            >
                              +1개
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                              onClick={() => handleAddSlots(user.id, user.max_codes, 3)}
                              disabled={isUpdating}
                            >
                              +3개
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                              onClick={() => handleAddSlots(user.id, user.max_codes, 5)}
                              disabled={isUpdating}
                            >
                              +5개
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '2px 6px', color: 'var(--text-muted)' }}
                              onClick={() => handleSlotInputChange(user.id, 2)}
                              disabled={isUpdating || user.code_count > 2}
                              title="기본 2개로 초기화"
                            >
                              기본(2)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
