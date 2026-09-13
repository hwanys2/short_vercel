'use client';

import { useEffect, useState } from 'react';
import { USERNAME_REGEX } from '@/lib/authBridge';
import { USERNAME_CHANGE_CONFIRM_PHRASE } from '@/lib/usernameChange';

function formatNextChangeAt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  } catch {
    return iso;
  }
}

/**
 * @param {{ open: boolean, user: object, code?: {id:number,username:string,is_primary?:boolean}|null, baseUrl: string, onClose: Function, onChanged: Function }} props
 */
export default function ChangeUsernameModal({ open, user, code = null, baseUrl, onClose, onChanged }) {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [status, setStatus] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [newUsernameConfirm, setNewUsernameConfirm] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [ackUrls, setAckUrls] = useState(false);
  const [ackRelease, setAckRelease] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const targetCode = code || {
    id: user?.primary_code_id || null,
    username: user?.username || '',
    is_primary: true,
  };
  const current = targetCode?.username || user?.username || '';
  const isPrimary = targetCode?.is_primary !== false;
  const canChange = status?.can_change !== false;

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoadingStatus(true);
    setError('');
    setNewUsername('');
    setNewUsernameConfirm('');
    setCurrentUsername('');
    setConfirmPhrase('');
    setAckUrls(false);
    setAckRelease(false);
    setAvailability(null);

    const qs = targetCode?.id ? `?code_id=${encodeURIComponent(targetCode.id)}` : '';
    fetch(`/api/auth/change-username${qs}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.success) {
          setError(data.message || '본인 코드 변경 정보를 불러오지 못했습니다.');
          setStatus(null);
          return;
        }
        setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setError('네트워크 오류가 발생했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, targetCode?.id]);

  useEffect(() => {
    if (!open || !canChange) return undefined;
    const trimmed = newUsername.trim();
    if (!trimmed) {
      setAvailability(null);
      return undefined;
    }

    const timer = setTimeout(() => {
      const qs = new URLSearchParams({ username: trimmed });
      if (targetCode?.id) qs.set('code_id', String(targetCode.id));
      fetch(`/api/auth/check-username?${qs}`)
        .then((res) => res.json())
        .then((data) => setAvailability(data))
        .catch(() => setAvailability(null));
    }, 400);

    return () => clearTimeout(timer);
  }, [open, canChange, newUsername, targetCode?.id]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!canChange) {
      setError(
        `본인 코드는 30일에 한 번만 변경할 수 있습니다. 약 ${status?.remaining_label || '잠시'} 후에 다시 시도해주세요.`
      );
      return;
    }
    if (!USERNAME_REGEX.test(newUsername.trim())) {
      setError('본인 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.');
      return;
    }
    if (newUsername.trim() !== newUsernameConfirm.trim()) {
      setError('새 본인 코드 확인이 일치하지 않습니다.');
      return;
    }
    if (currentUsername.trim() !== current) {
      setError('현재 본인 코드를 정확히 입력해주세요.');
      return;
    }
    if (!ackUrls || !ackRelease) {
      setError('주의사항을 모두 확인해야 본인 코드를 변경할 수 있습니다.');
      return;
    }
    if (confirmPhrase.trim() !== USERNAME_CHANGE_CONFIRM_PHRASE) {
      setError(`확인 문구를 정확히 입력해주세요. (${USERNAME_CHANGE_CONFIRM_PHRASE})`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code_id: targetCode?.id,
          new_username: newUsername,
          new_username_confirm: newUsernameConfirm,
          current_username: currentUsername,
          confirm_phrase: confirmPhrase,
          acknowledge_urls_change: ackUrls,
          acknowledge_old_released: ackRelease,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || '본인 코드 변경에 실패했습니다.');
        if (data.remaining_label) {
          setStatus((prev) => ({
            ...(prev || {}),
            can_change: false,
            remaining_label: data.remaining_label,
            next_change_at: data.next_change_at || prev?.next_change_at,
          }));
        }
        return;
      }
      onChanged?.(data);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const previewNew = newUsername.trim() || '새코드';
  const urlCount = status?.url_count ?? 0;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="change-username-title">
        <div className="modal-header">
          <h3 id="change-username-title" style={{ color: 'var(--danger)' }}>
            ⚠️ 본인 코드 변경
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => !saving && onClose?.()}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {loadingStatus ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <span className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
              </div>
            ) : (
              <>
                {error && (
                  <div className="alert alert-danger" style={{ marginBottom: '12px' }}>
                    {error}
                  </div>
                )}

                <div
                  className="alert alert-danger"
                  style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '16px' }}
                >
                  <strong>이 변경은 되돌릴 수 없습니다.</strong>
                  <ul style={{ margin: '8px 0 0 16px', fontSize: '0.85rem', lineHeight: 1.55 }}>
                    <li>
                      이 본인 코드의 단축 주소 <strong>{urlCount.toLocaleString()}개</strong>가 모두 새 주소로 바뀝니다.
                    </li>
                    <li>
                      이미 공유한 링크, QR, 인쇄물은 <strong>즉시 열리지 않습니다.</strong>
                    </li>
                    <li>
                      이전 본인 코드 <strong>{current}</strong>는 바로 해제되어, 다른 사람이 가져갈 수 있습니다.
                    </li>
                    {isPrimary && (
                      <li>이메일·비밀번호 로그인 시 예전 본인 코드로는 로그인되지 않습니다.</li>
                    )}
                    <li>본인 코드는 <strong>30일에 한 번</strong>만 바꿀 수 있습니다.</li>
                  </ul>
                </div>

                <p style={{ fontSize: '0.9rem', marginBottom: '12px', lineHeight: 1.5 }}>
                  {baseUrl}
                  <strong>{current}</strong>/코드 → {baseUrl}
                  <strong>{previewNew}</strong>/코드
                </p>

                {!canChange ? (
                  <div className="alert alert-danger" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <strong>지금은 변경할 수 없습니다.</strong>
                    <span style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                      마지막 변경 후 30일이 지나야 합니다. 약 {status?.remaining_label} 후
                      {status?.next_change_at ? ` (${formatNextChangeAt(status.next_change_at)})` : ''}에 다시 시도해주세요.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label" htmlFor="change-username-new">
                        새 본인 코드
                      </label>
                      <input
                        id="change-username-new"
                        type="text"
                        className="form-input"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        required
                        maxLength={50}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {availability?.message && (
                        <p
                          style={{
                            margin: '6px 0 0',
                            fontSize: '0.8rem',
                            color: availability.available ? '#047857' : 'var(--danger)',
                          }}
                        >
                          {availability.available ? '사용 가능한 본인 코드입니다.' : availability.message}
                        </p>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="change-username-new-confirm">
                        새 본인 코드 확인
                      </label>
                      <input
                        id="change-username-new-confirm"
                        type="text"
                        className="form-input"
                        value={newUsernameConfirm}
                        onChange={(e) => setNewUsernameConfirm(e.target.value)}
                        required
                        maxLength={50}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="change-username-current">
                        현재 본인 코드 입력 ({current})
                      </label>
                      <input
                        id="change-username-current"
                        type="text"
                        className="form-input"
                        value={currentUsername}
                        onChange={(e) => setCurrentUsername(e.target.value)}
                        required
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={ackUrls}
                          onChange={(e) => setAckUrls(e.target.checked)}
                          required
                          style={{ marginTop: '3px' }}
                        />
                        <span>
                          이 본인 코드의 단축 주소가 모두 바뀌고, 기존 주소는 바로 작동하지 않음을 이해합니다.
                        </span>
                      </label>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={ackRelease}
                          onChange={(e) => setAckRelease(e.target.checked)}
                          required
                          style={{ marginTop: '3px' }}
                        />
                        <span>
                          이전 본인 코드가 즉시 해제되어 다른 사람이 사용할 수 있음을 이해합니다.
                        </span>
                      </label>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="change-username-phrase">
                        확인을 위해 <strong style={{ color: 'var(--danger)' }}>{USERNAME_CHANGE_CONFIRM_PHRASE}</strong>를
                        입력하세요
                      </label>
                      <input
                        id="change-username-phrase"
                        type="text"
                        className="form-input"
                        placeholder={USERNAME_CHANGE_CONFIRM_PHRASE}
                        value={confirmPhrase}
                        onChange={(e) => setConfirmPhrase(e.target.value)}
                        required
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              취소
            </button>
            <button type="submit" className="btn btn-danger" disabled={saving || loadingStatus || !canChange}>
              {saving ? '변경 중...' : '그래도 변경하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
