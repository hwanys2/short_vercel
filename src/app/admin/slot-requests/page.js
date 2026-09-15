'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function formatDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    }).format(d);
  } catch {
    return iso;
  }
}

export default function AdminSlotRequestsPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState('loading'); // loading | ok | denied
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'all' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMsg, setStatusMsg] = useState(null); // { type: 'success'|'danger', text: string }

  // 승인/반려 진행 중 ID
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // 반려 모달 상태
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

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

  // 신청 목록 조회
  const fetchRequests = useCallback(async (status = statusFilter, q = searchQuery) => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      if (q.trim()) params.set('q', q.trim());

      const res = await fetch(`/api/admin/slot-requests?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '목록을 불러오지 못했습니다.');
      }

      setRequests(data.requests || []);
      if (data.counts) setCounts(data.counts);
    } catch (err) {
      setStatusMsg({ type: 'danger', text: err.message });
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // 인증 완료 후 초기 데이터 로드
  useEffect(() => {
    if (authState === 'ok') {
      fetchRequests();
    }
  }, [authState, fetchRequests]);

  // 필터 탭 클릭
  const handleFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    fetchRequests(newStatus, searchQuery);
  };

  // 검색 제출
  const handleSearch = (e) => {
    e.preventDefault();
    fetchRequests(statusFilter, searchQuery);
  };

  // 검색 초기화
  const handleResetSearch = () => {
    setSearchQuery('');
    fetchRequests(statusFilter, '');
  };

  // 승인 처리
  const handleApprove = async (item) => {
    const currentSlots = item.max_codes;
    const nextSlots = currentSlots + (item.granted_slots || 1);
    const confirmMsg = `${item.user_email} 님의 신청을 승인하시겠습니까?\n\n본인코드 슬롯이 ${currentSlots}개에서 ${nextSlots}개로 상향됩니다.`;
    if (!confirm(confirmMsg)) return;

    setActionLoadingId(item.id);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/admin/slot-requests/${item.id}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '승인 처리에 실패했습니다.');
      }

      setStatusMsg({ type: 'success', text: data.message || '성공적으로 승인되었습니다.' });
      // 목록 새로고침
      await fetchRequests();
    } catch (err) {
      setStatusMsg({ type: 'danger', text: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 반려 모달 열기
  const handleOpenReject = (item) => {
    setRejectingItem(item);
    setRejectReason('게시물 내용 확인 불가 또는 홍보 가이드라인 미부합');
  };

  // 반려 처리 제출
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingItem) return;

    const trimmedReason = rejectReason.trim();
    if (!trimmedReason) {
      alert('반려 사유를 입력해주세요.');
      return;
    }

    setActionLoadingId(rejectingItem.id);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/admin/slot-requests/${rejectingItem.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmedReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '반려 처리에 실패했습니다.');
      }

      setStatusMsg({ type: 'success', text: '신청이 반려 처리되었습니다.' });
      setRejectingItem(null);
      setRejectReason('');
      // 목록 새로고침
      await fetchRequests();
    } catch (err) {
      setStatusMsg({ type: 'danger', text: err.message });
    } finally {
      setActionLoadingId(null);
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
        <div className="container" style={{ padding: '32px 20px 64px', maxWidth: 1040 }}>
          {/* 상단 헤더 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
                SNS 홍보 슬롯 신청 관리
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
              {counts.pending > 0 && (
                <span
                  style={{
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid rgba(234, 179, 8, 0.35)',
                    color: '#b45309',
                    borderRadius: 20,
                    padding: '2px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  검토 대기 {counts.pending}건
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0, lineHeight: 1.5 }}>
              사용자들이 숏.한국, foreducator.com, pimath.kr 서비스 홍보글을 SNS에 게시하고 제출한 신청 건을 검토합니다.
              승인 시 해당 사용자의 본인코드 최대 슬롯 한도가 1개 늘어납니다.
            </p>
          </div>

          {/* 관리자 서브 탭 바로가기 */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 24,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Link href="/admin" className="btn btn-sm btn-secondary">
              대시보드
            </Link>
            <Link href="/admin/slot-requests" className="btn btn-sm btn-primary">
              슬롯 신청 관리 {counts.pending > 0 ? `(${counts.pending})` : ''}
            </Link>
            <Link href="/admin/slots" className="btn btn-sm btn-secondary">
              코드 슬롯 직접 관리
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

          {/* 검색 및 필터 바 */}
          <div className="card" style={{ marginBottom: 24, padding: 20 }}>
            {/* 상태 필터 탭 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleFilterChange('pending')}
                style={{ fontWeight: statusFilter === 'pending' ? 700 : 500 }}
              >
                검토 대기 ({counts.pending})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleFilterChange('approved')}
                style={{ fontWeight: statusFilter === 'approved' ? 700 : 500 }}
              >
                승인 완료 ({counts.approved})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleFilterChange('rejected')}
                style={{ fontWeight: statusFilter === 'rejected' ? 700 : 500 }}
              >
                반려 ({counts.rejected})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleFilterChange('all')}
                style={{ fontWeight: statusFilter === 'all' ? 700 : 500 }}
              >
                전체 보기 ({counts.all})
              </button>
            </div>

            {/* 검색어 입력 폼 */}
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="사용자 이메일, 닉네임, SNS 링크 URL 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: '1 1 300px' }}
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '검색 중...' : '검색'}
              </button>
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetSearch}
                  disabled={loading}
                >
                  초기화
                </button>
              )}
            </form>
          </div>

          {/* 신청 목록 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                {statusFilter === 'pending'
                  ? '검토 대기 신청'
                  : statusFilter === 'approved'
                  ? '승인 완료 내역'
                  : statusFilter === 'rejected'
                  ? '반려 내역'
                  : '전체 신청 내역'}
              </h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                조회된 건수: {requests.length}건
              </span>
            </div>

            {loading ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                신청 내역을 불러오는 중입니다...
              </div>
            ) : requests.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                해당 조건의 신청 내역이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {requests.map((item) => {
                  const isPending = item.status === 'pending';
                  const isApproved = item.status === 'approved';
                  const isRejected = item.status === 'rejected';
                  const isActionLoading = actionLoadingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="card"
                      style={{
                        padding: 20,
                        borderLeft: isPending
                          ? '4px solid #eab308'
                          : isApproved
                          ? '4px solid #10b981'
                          : '4px solid #ef4444',
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
                        {/* 왼쪽: 신청 내용 및 사용자 정보 */}
                        <div style={{ flex: '1 1 360px' }}>
                          {/* 사용자 이메일 및 슬롯 정보 헤더 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                            <strong style={{ fontSize: '1.05rem' }}>{item.user_email}</strong>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              ({item.user_username || '닉네임 없음'})
                            </span>
                            <span
                              style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: '0.78rem',
                                fontWeight: 600,
                              }}
                            >
                              현재 슬롯: {item.max_codes}개 (사용 중: {item.code_count}개)
                            </span>

                            {/* 상태 뱃지 */}
                            {isPending && (
                              <span
                                style={{
                                  background: 'rgba(234, 179, 8, 0.15)',
                                  color: '#b45309',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                }}
                              >
                                검토 대기
                              </span>
                            )}
                            {isApproved && (
                              <span
                                style={{
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#059669',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                }}
                              >
                                승인 완료 (+{item.granted_slots}개 지급됨)
                              </span>
                            )}
                            {isRejected && (
                              <span
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#ef4444',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                }}
                              >
                                반려됨
                              </span>
                            )}
                          </div>

                          {/* 신청 일시 */}
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                            신청일시: {formatDate(item.created_at)}
                            {item.reviewed_at && ` · 처리일시: ${formatDate(item.reviewed_at)}`}
                          </div>

                          {/* SNS 링크 박스 */}
                          <div
                            style={{
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              padding: '12px 14px',
                              marginBottom: 8,
                            }}
                          >
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
                              제출된 SNS 게시물 링크:
                            </div>
                            <div style={{ wordBreak: 'break-all', fontSize: '0.92rem' }}>
                              <a
                                href={item.sns_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: 'var(--primary, #3b82f6)',
                                  textDecoration: 'underline',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontWeight: 600,
                                }}
                              >
                                <span>{item.sns_url}</span>
                                <span style={{ fontSize: '0.8rem', textDecoration: 'none' }}>↗ 새 탭으로 열기</span>
                              </a>
                            </div>
                            {item.memo && (
                              <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>메모: </span>
                                {item.memo}
                              </div>
                            )}
                          </div>

                          {/* 반려 사유 표시 */}
                          {isRejected && item.rejection_reason && (
                            <div
                              style={{
                                padding: '8px 12px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                borderRadius: 6,
                                fontSize: '0.82rem',
                                color: 'var(--danger, #ef4444)',
                              }}
                            >
                              <strong>반려 사유:</strong> {item.rejection_reason}
                            </div>
                          )}
                        </div>

                        {/* 오른쪽: 관리자 승인/반려 액션 버튼 */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            minWidth: 160,
                            alignItems: 'stretch',
                          }}
                        >
                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{
                                  padding: '8px 16px',
                                  fontWeight: 700,
                                  background: '#10b981',
                                  borderColor: '#10b981',
                                }}
                                disabled={isActionLoading}
                                onClick={() => handleApprove(item)}
                              >
                                {isActionLoading ? '처리 중...' : '✓ 승인 (+1 슬롯)'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '8px 16px', color: 'var(--danger)' }}
                                disabled={isActionLoading}
                                onClick={() => handleOpenReject(item)}
                              >
                                ✕ 반려
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <div
                              style={{
                                textAlign: 'center',
                                padding: '8px 12px',
                                background: 'rgba(16, 185, 129, 0.08)',
                                borderRadius: 6,
                                fontSize: '0.82rem',
                                color: '#059669',
                                fontWeight: 600,
                              }}
                            >
                              ✓ 승인 완료됨
                            </div>
                          )}

                          {isRejected && (
                            <div
                              style={{
                                textAlign: 'center',
                                padding: '8px 12px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                borderRadius: 6,
                                fontSize: '0.82rem',
                                color: '#ef4444',
                                fontWeight: 600,
                              }}
                            >
                              ✕ 반려 완료됨
                            </div>
                          )}
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

      {/* 반려 사유 입력 모달 */}
      {rejectingItem && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoadingId) setRejectingItem(null);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)' }}>
                신청 반려 사유 입력
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => !actionLoadingId && setRejectingItem(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRejectSubmit}>
              <div className="modal-body" style={{ padding: 20 }}>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                  <strong>{rejectingItem.user_email}</strong> 님의 신청을 반려합니다.
                  <br />
                  반려 사유는 사용자의 프로필 신청 내역에 안내됩니다.
                </p>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" htmlFor="reject-reason-input" style={{ fontWeight: 600 }}>
                    반려 사유
                  </label>
                  <textarea
                    id="reject-reason-input"
                    className="form-input"
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    required
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* 빠른 사유 선택 */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                    onClick={() => setRejectReason('SNS 게시물이 비공개 상태이거나 링크에 접근할 수 없습니다.')}
                  >
                    접근 불가/비공개
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                    onClick={() => setRejectReason('서비스 홍보 또는 사용사례 내용이 충분하지 않습니다.')}
                  >
                    내용 불충분
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                    onClick={() => setRejectReason('이미 승인받은 동일한 게시물 링크입니다.')}
                  >
                    중복 링크
                  </button>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '12px 20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRejectingItem(null)}
                  disabled={Boolean(actionLoadingId)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={Boolean(actionLoadingId) || !rejectReason.trim()}
                >
                  {actionLoadingId ? '반려 처리 중...' : '반려 확정'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
