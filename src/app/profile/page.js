'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ChangeUsernameModal from '@/components/ChangeUsernameModal';
import { sanitizeAsciiPasswordInput } from '@/lib/passwordInput';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const [showUsernameModal, setShowUsernameModal] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [optionalMail, setOptionalMail] = useState(true);
  const [mailSaving, setMailSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://숏.한국/';

  const loadMe = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.success) {
      router.push('/login');
      return null;
    }
    if (data.needsOnboarding) {
      router.push('/onboarding');
      return null;
    }
    setUser(data.user);
    setOptionalMail(data.user.accepts_optional_mail !== false);
    return data.user;
  };

  useEffect(() => {
    loadMe()
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const flash = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      setPasswordError('모든 필드를 입력해주세요.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('새 비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirm: newPasswordConfirm,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setPasswordError(data.message || '비밀번호 변경에 실패했습니다.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      flash('비밀번호가 변경되었습니다.');
      await loadMe();
    } catch {
      setPasswordError('네트워크 오류가 발생했습니다.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleMailToggle = async (next) => {
    setOptionalMail(next);
    setMailSaving(true);
    try {
      const res = await fetch('/api/profile/mail-consent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepts_optional_mail: next }),
      });
      const data = await res.json();
      if (!data.success) {
        setOptionalMail(!next);
        flash(data.message || '저장에 실패했습니다.', 'danger');
        return;
      }
      setUser((u) => (u ? { ...u, accepts_optional_mail: data.accepts_optional_mail } : u));
      flash(next ? '선택 메일 수신에 동의했습니다.' : '선택 메일 수신을 거부했습니다.');
    } catch {
      setOptionalMail(!next);
      flash('네트워크 오류가 발생했습니다.', 'danger');
    } finally {
      setMailSaving(false);
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

  if (loading || !user) {
    return (
      <>
        <Header />
        <main>
          <div className="container" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)' }}>불러오는 중...</p>
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
        <div className="container-narrow" style={{ padding: '32px 24px 64px' }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>프로필</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              계정 정보, 비밀번호, 메일 수신 설정을 관리합니다.
            </p>
          </div>

          {message && (
            <div
              className={`alert ${messageType === 'danger' ? 'alert-danger' : 'alert-success'}`}
              style={{ marginBottom: 16 }}
            >
              {message}
            </div>
          )}

          <section className="card profile-section">
            <div className="card-header">계정</div>
            <div className="card-body" style={{ display: 'grid', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">이메일</label>
                <input className="form-input" value={user.email || ''} disabled readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">본인 코드</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    className="form-input"
                    value={user.username || ''}
                    disabled
                    readOnly
                    style={{ flex: 1, minWidth: 160 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowUsernameModal(true)}
                  >
                    변경
                  </button>
                </div>
                {!user.can_change_username && user.username_change_remaining_label && (
                  <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    다음 변경까지 {user.username_change_remaining_label}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="card profile-section" style={{ marginTop: 16 }}>
            <div className="card-header">보안</div>
            <div className="card-body">
              {!user.has_password && (
                <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.9rem' }}>
                  구글 로그인 계정입니다. 비밀번호를 설정하면 이메일로도 로그인할 수 있습니다. 현재
                  비밀번호가 없다면 구글 로그인 후 Auth에서 비밀번호를 먼저 연결해야 할 수 있습니다.
                </div>
              )}
              <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: 14 }}>
                {passwordError && (
                  <div className="alert alert-danger" style={{ marginBottom: 0 }}>
                    {passwordError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-current-password">
                    현재 비밀번호
                  </label>
                  <input
                    id="profile-current-password"
                    type="password"
                    className="form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(sanitizeAsciiPasswordInput(e.target.value))}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-new-password">
                    새 비밀번호
                  </label>
                  <input
                    id="profile-new-password"
                    type="password"
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(sanitizeAsciiPasswordInput(e.target.value))}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    8자 이상
                  </p>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-new-password-confirm">
                    새 비밀번호 확인
                  </label>
                  <input
                    id="profile-new-password-confirm"
                    type="password"
                    className="form-input"
                    value={newPasswordConfirm}
                    onChange={(e) =>
                      setNewPasswordConfirm(sanitizeAsciiPasswordInput(e.target.value))
                    }
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <button type="submit" className="btn btn-primary" disabled={passwordSaving}>
                    {passwordSaving ? '변경 중...' : '비밀번호 변경'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section className="card profile-section" style={{ marginTop: 16 }}>
            <div className="card-header">이메일 수신</div>
            <div className="card-body" style={{ display: 'grid', gap: 16 }}>
              <label className="mail-consent-row">
                <div>
                  <div className="mail-consent-title">필수 안내</div>
                  <p className="mail-consent-desc">
                    서비스 운영·보안·약관 변경 안내는 해제할 수 없습니다.
                  </p>
                </div>
                <input type="checkbox" checked disabled readOnly aria-label="필수 안내 (해제 불가)" />
              </label>

              <label className="mail-consent-row">
                <div>
                  <div className="mail-consent-title">메일 수신 동의</div>
                  <p className="mail-consent-desc">
                    기능 소식, 업데이트, 선택 안내 메일을 받습니다. 언제든지 끌 수 있습니다.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={optionalMail}
                  disabled={mailSaving}
                  onChange={(e) => handleMailToggle(e.target.checked)}
                  aria-label="메일 수신 동의"
                />
              </label>
            </div>
          </section>

          <section className="card profile-section" style={{ marginTop: 16 }}>
            <div className="card-header" style={{ color: 'var(--danger)' }}>
              위험 구역
            </div>
            <div className="card-body">
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                회원탈퇴 시 모든 단축 URL이 영구 삭제되며 복구할 수 없습니다.
              </p>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setShowDeleteModal(true)}
              >
                회원탈퇴
              </button>
            </div>
          </section>
        </div>
      </main>
      <Footer />

      <ChangeUsernameModal
        open={showUsernameModal}
        user={user}
        baseUrl={baseUrl}
        onClose={() => setShowUsernameModal(false)}
        onChanged={(data) => {
          const nextUsername = data?.user?.username || '';
          alert(
            `본인 코드가 ${nextUsername}(으)로 변경되었습니다.\n기존 단축 주소는 즉시 무효가 되며, 이전 코드는 다른 사람이 사용할 수 있습니다.`
          );
          window.location.assign('/profile');
        }}
      />

      {showDeleteModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteModal(false);
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger)' }}>회원탈퇴 확인</h3>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowDeleteModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div
                className="alert alert-danger"
                style={{ flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <strong>주의사항</strong>
                <ul style={{ margin: '8px 0 0 16px', fontSize: '0.85rem' }}>
                  <li>회원탈퇴 시 모든 단축 URL이 영구적으로 삭제됩니다.</li>
                  <li>삭제된 데이터는 복구할 수 없습니다.</li>
                  <li>탈퇴 후 같은 닉네임으로 재가입이 가능합니다.</li>
                </ul>
              </div>
              <p style={{ marginBottom: 12 }}>
                탈퇴를 원하시면 아래에 <strong style={{ color: 'var(--danger)' }}>DELETE</strong>를
                입력해주세요.
              </p>
              <input
                type="text"
                className="form-input"
                placeholder="DELETE"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                취소
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteAccount}>
                회원탈퇴
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
