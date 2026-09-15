'use client';

import { useEffect, useState } from 'react';

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

export default function SlotRequestModal({ open, onClose, currentCount, maxCodes, onRequested }) {
  const [snsUrl, setSnsUrl] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/profile/slot-requests');
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSnsUrl('');
    setMemo('');
    setError('');
    setSuccessMsg('');
    fetchRequests();
  }, [open]);

  if (!open) return null;

  const hasPending = requests.some((r) => r.status === 'pending');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedUrl = snsUrl.trim();
    if (!trimmedUrl) {
      setError('SNS 게시물 링크를 입력해주세요.');
      return;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setError('웹 주소는 http:// 또는 https:// 로 시작해야 합니다.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/profile/slot-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sns_url: trimmedUrl,
          memo: memo.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || '신청 접수에 실패했습니다.');
        return;
      }

      setSuccessMsg(data.message || '슬롯 추가 신청이 접수되었습니다.');
      setSnsUrl('');
      setMemo('');
      await fetchRequests();
      onRequested?.();
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose?.();
      }}
    >
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-request-title"
        style={{ maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.25rem' }}>🎁</span>
            <h3 id="slot-request-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              본인 코드 슬롯 추가 신청
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => !submitting && onClose?.()}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {/* 홍보 안내 배너 */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(99, 102, 241, 0.12))',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 12,
              padding: '16px 18px',
              marginBottom: 20,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text)', marginBottom: 6 }}>
              SNS 홍보하고 추가 슬롯(+1개)을 받아보세요!
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              아래 3개 서비스 중 하나의 홍보글이나 활용 사례를 SNS(블로그, 인스타그램, 페이스북, X, 유튜브, 쓰레드 등)에 올리고 링크를 등록해 주시면, 관리자 확인 후 슬롯을 추가해 드립니다.
            </p>

            {/* 대상 서비스 3개 소개 카드 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 8,
                marginTop: 12,
              }}
            >
              <a
                href="https://숏.한국"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'var(--bg-card, #fff)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  transition: 'border-color 0.15s, transform 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--primary, #3b82f6)' }}>숏.한국</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>↗</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                  무료 한글 단축 URL & 파일/HTML 공유
                </span>
              </a>

              <a
                href="https://foreducator.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'var(--bg-card, #fff)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  transition: 'border-color 0.15s, transform 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--primary, #3b82f6)' }}>foreducator.com</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>↗</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                  교사 및 교육자를 위한 AI 교육 솔루션
                </span>
              </a>

              <a
                href="https://pimath.kr"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'var(--bg-card, #fff)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  transition: 'border-color 0.15s, transform 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--primary, #3b82f6)' }}>pimath.kr</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>↗</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                  생각하는 힘을 기르는 수학 교육 플랫폼
                </span>
              </a>
            </div>
          </div>

          {/* 알림 메시지 */}
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}
          {successMsg && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              {successMsg}
            </div>
          )}

          {/* 슬롯 현황 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginBottom: 12,
              padding: '6px 12px',
              background: 'var(--surface)',
              borderRadius: 8,
            }}
          >
            <span>현재 슬롯 보유 현황</span>
            <span>
              <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{currentCount}</strong> / {maxCodes}개 사용 중
            </span>
          </div>

          {/* 신청 폼 */}
          {hasPending ? (
            <div
              style={{
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 24,
                fontSize: '0.88rem',
                color: 'var(--text)',
                lineHeight: 1.5,
              }}
            >
              ⏳ <strong>현재 검토 대기 중인 신청 건이 있습니다.</strong>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                관리자가 링크 확인 후 슬롯을 추가해 드립니다. 처리가 완료되면 추가 신청이 가능합니다.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" htmlFor="sns-url-input" style={{ fontWeight: 600 }}>
                  홍보 게시물 링크 (URL) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="sns-url-input"
                  type="url"
                  className="form-input"
                  placeholder="https://blog.naver.com/... 또는 https://instagram.com/p/..."
                  value={snsUrl}
                  onChange={(e) => setSnsUrl(e.target.value)}
                  required
                  disabled={submitting}
                  autoComplete="off"
                />
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  * 게시물이 전체 공개 상태여야 관리자가 내용을 확인할 수 있습니다.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" htmlFor="memo-input" style={{ fontWeight: 600 }}>
                  홍보 내용 / 메모 <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(선택)</span>
                </label>
                <input
                  id="memo-input"
                  type="text"
                  className="form-input"
                  placeholder="예: 네이버 블로그에 단축주소 활용 후기를 작성했습니다."
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  maxLength={100}
                  disabled={submitting}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px 16px', fontWeight: 700 }}
                disabled={submitting || !snsUrl.trim()}
              >
                {submitting ? '신청 접수 중...' : '슬롯 추가 신청하기'}
              </button>
            </form>
          )}

          {/* 하단: 신청 내역 및 진행 상황 */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                내 신청 내역 및 진행 상황
              </h4>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                총 {requests.length}건
              </span>
            </div>

            {loadingRequests ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                신청 내역을 불러오는 중...
              </div>
            ) : requests.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px 16px',
                  background: 'var(--surface)',
                  borderRadius: 8,
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                }}
              >
                아직 제출된 신청 내역이 없습니다.
                <br />
                SNS에 홍보글을 올리고 링크를 등록해보세요!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {requests.map((req) => {
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved';
                  const isRejected = req.status === 'rejected';

                  let badgeBg = 'rgba(107, 114, 128, 0.1)';
                  let badgeColor = 'var(--text-muted)';
                  let badgeLabel = '검토 대기';

                  if (isPending) {
                    badgeBg = 'rgba(234, 179, 8, 0.15)';
                    badgeColor = '#b45309';
                    badgeLabel = '검토 대기 중';
                  } else if (isApproved) {
                    badgeBg = 'rgba(16, 185, 129, 0.15)';
                    badgeColor = '#059669';
                    badgeLabel = '승인 완료 (+1 슬롯 지급)';
                  } else if (isRejected) {
                    badgeBg = 'rgba(239, 68, 68, 0.15)';
                    badgeColor = 'var(--danger, #ef4444)';
                    badgeLabel = '반려됨';
                  }

                  return (
                    <div
                      key={req.id}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            background: badgeBg,
                            color: badgeColor,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          {badgeLabel}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {formatDate(req.created_at)}
                        </span>
                      </div>

                      {/* 링크 */}
                      <div style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                        <a
                          href={req.sns_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--primary, #3b82f6)',
                            textDecoration: 'underline',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>{req.sns_url}</span>
                          <span style={{ fontSize: '0.75rem', textDecoration: 'none' }}>↗</span>
                        </a>
                      </div>

                      {/* 메모 */}
                      {req.memo && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          메모: {req.memo}
                        </div>
                      )}

                      {/* 반려 사유 */}
                      {isRejected && req.rejection_reason && (
                        <div
                          style={{
                            marginTop: 4,
                            padding: '6px 10px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            borderRadius: 6,
                            fontSize: '0.8rem',
                            color: 'var(--danger, #ef4444)',
                          }}
                        >
                          <strong>반려 사유:</strong> {req.rejection_reason}
                        </div>
                      )}

                      {/* 승인 일시 */}
                      {isApproved && req.reviewed_at && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          승인 일시: {formatDate(req.reviewed_at)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
