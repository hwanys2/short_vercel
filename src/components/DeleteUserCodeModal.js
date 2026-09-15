'use client';

import { useState } from 'react';

export default function DeleteUserCodeModal({ open, code, onClose, onDeleted }) {
  const [step, setStep] = useState(1);
  const [step1Checked, setStep1Checked] = useState(false);
  const [step2Checked, setStep2Checked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open || !code) return null;

  const urlCount = code.url_count || 0;

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!step1Checked) return;
    setError('');
    setStep(2);
  };

  const handlePrevStep = () => {
    if (saving) return;
    setError('');
    setStep(1);
  };

  const handleDelete = async () => {
    if (!step1Checked || !step2Checked || saving) return;

    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/profile/codes/${code.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || '본인 코드 삭제에 실패했습니다.');
        setSaving(false);
        return;
      }
      onDeleted?.(data);
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-code-title"
      >
        <div className="modal-header">
          <h3 id="delete-user-code-title" style={{ color: 'var(--danger, #dc2626)' }}>
            {step === 1
              ? '⚠️ 본인 코드 삭제 (1단계: 삭제 내용 확인)'
              : '🚨 본인 코드 영구 삭제 (2단계: 최종 재확인)'}
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => !saving && onClose?.()}
            aria-label="닫기"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {step === 1 ? (
            <div>
              <div
                className="alert alert-danger"
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  marginBottom: '16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  borderColor: 'var(--danger, #dc2626)',
                }}
              >
                <strong style={{ fontSize: '0.98rem', marginBottom: '6px' }}>
                  주의: 본인 코드가 삭제됩니다.
                </strong>
                <ul
                  style={{
                    margin: '4px 0 0 16px',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                  }}
                >
                  <li>
                    삭제 대상 본인 코드: <strong>{code.username}</strong>
                  </li>
                  {urlCount > 0 ? (
                    <li>
                      이 본인 코드 아래에 생성된 <strong>단축 주소 {urlCount.toLocaleString()}개</strong>와{' '}
                      <strong>방문 통계 데이터</strong>가 <strong>모두 함께 영구 삭제</strong>됩니다.
                    </li>
                  ) : (
                    <li>현재 이 본인 코드에 생성된 단축 주소는 없습니다.</li>
                  )}
                  {urlCount > 0 && (
                    <li>
                      이미 공유된 단축 주소 및 QR 코드는 <strong>즉시 연결이 끊기며 작동하지 않습니다.</strong>
                    </li>
                  )}
                  <li>
                    삭제 즉시 본인 코드 <strong>{code.username}</strong>은(는) 해제되어 다른 사람이 등록할 수 있게 됩니다.
                  </li>
                </ul>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-card-hover, rgba(0, 0, 0, 0.03))',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  marginTop: '12px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    lineHeight: 1.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={step1Checked}
                    onChange={(e) => setStep1Checked(e.target.checked)}
                    style={{
                      marginTop: '3px',
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--danger, #dc2626)',
                      flexShrink: 0,
                    }}
                  />
                  <span>
                    [1차 확인]{' '}
                    {urlCount > 0
                      ? `본인 코드 "${code.username}" 및 연결된 단축 주소 ${urlCount}개가 모두 영구히 삭제됨을 확인했습니다.`
                      : `본인 코드 "${code.username}"이(가) 영구 삭제됨을 확인했습니다.`}
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div>
              <div
                className="alert alert-danger"
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  marginBottom: '16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  borderColor: 'var(--danger, #dc2626)',
                  borderWidth: '2px',
                }}
              >
                <strong style={{ fontSize: '1.02rem', color: 'var(--danger, #dc2626)', marginBottom: '8px' }}>
                  🚨 정말로 영구 삭제하시겠습니까? (되돌릴 수 없음)
                </strong>
                <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.6 }}>
                  본인 코드 <strong>{code.username}</strong>
                  {urlCount > 0 && (
                    <>
                      {' '}및 해당 코드의 모든 단축 주소 <strong>{urlCount.toLocaleString()}개</strong>
                    </>
                  )}
                  가 데이터베이스 및 저장소에서 완전히 삭제됩니다.
                  <br />
                  <span style={{ color: 'var(--danger, #dc2626)', fontWeight: 700 }}>
                    삭제가 완료되면 어떠한 방법으로도 데이터를 복구할 수 없습니다.
                  </span>
                </p>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-card-hover, rgba(0, 0, 0, 0.03))',
                  borderRadius: '8px',
                  border: '1px solid var(--danger, #dc2626)',
                  marginTop: '12px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    color: 'var(--danger, #dc2626)',
                    lineHeight: 1.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={step2Checked}
                    onChange={(e) => setStep2Checked(e.target.checked)}
                    disabled={saving}
                    style={{
                      marginTop: '3px',
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--danger, #dc2626)',
                      flexShrink: 0,
                    }}
                  />
                  <span>
                    [2차 재확인] 데이터 복구가 절대 불가능함을 명확히 이해했으며, 영구 삭제를 진행하는 것에 동의합니다.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {step === 1 ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onClose?.()}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!step1Checked}
                onClick={handleNextStep}
              >
                다음: 재차 확인 (1/2) →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrevStep}
                disabled={saving}
              >
                ← 이전 단계
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!step2Checked || saving}
                onClick={handleDelete}
              >
                {saving ? '영구 삭제 중...' : '영구 삭제 실행'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
