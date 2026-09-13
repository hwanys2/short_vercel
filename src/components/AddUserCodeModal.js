'use client';

import { useEffect, useState } from 'react';
import { USERNAME_REGEX } from '@/lib/authBridge';

export default function AddUserCodeModal({ open, baseUrl, maxCodes, currentCount, onClose, onAdded }) {
  const [username, setUsername] = useState('');
  const [usernameConfirm, setUsernameConfirm] = useState('');
  const [availability, setAvailability] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setUsername('');
    setUsernameConfirm('');
    setAvailability(null);
    setError('');
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const trimmed = username.trim();
    if (!trimmed) {
      setAvailability(null);
      return undefined;
    }

    const timer = setTimeout(() => {
      fetch(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data) => setAvailability(data))
        .catch(() => setAvailability(null));
    }, 400);

    return () => clearTimeout(timer);
  }, [open, username]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!USERNAME_REGEX.test(username.trim())) {
      setError('본인 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.');
      return;
    }
    if (username.trim() !== usernameConfirm.trim()) {
      setError('본인 코드 확인이 일치하지 않습니다.');
      return;
    }
    if (availability && availability.available === false) {
      setError(availability.message || '사용할 수 없는 본인 코드입니다.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          username_confirm: usernameConfirm,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || '본인 코드 추가에 실패했습니다.');
        return;
      }
      onAdded?.(data);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const preview = username.trim() || '새코드';

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-user-code-title">
        <div className="modal-header">
          <h3 id="add-user-code-title">본인 코드 추가</h3>
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
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '12px' }}>
                {error}
              </div>
            )}
            <p style={{ fontSize: '0.9rem', marginBottom: '12px', lineHeight: 1.5 }}>
              추가로 사용할 본인 코드를 만듭니다. ({currentCount}/{maxCodes})
              <br />
              주소 예: {baseUrl}
              <strong>{preview}</strong>/코드
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="add-code-username">
                새 본인 코드
              </label>
              <input
                id="add-code-username"
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
              <label className="form-label" htmlFor="add-code-username-confirm">
                새 본인 코드 확인
              </label>
              <input
                id="add-code-username-confirm"
                type="text"
                className="form-input"
                value={usernameConfirm}
                onChange={(e) => setUsernameConfirm(e.target.value)}
                required
                maxLength={50}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              취소
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '추가 중...' : '추가하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
