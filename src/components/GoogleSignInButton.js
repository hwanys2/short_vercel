'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * 구글 OAuth 버튼
 * @param {'login'|'signup'} intent
 *   - login: 기존 이메일 계정이 있으면 연동 후 대시보드
 *   - signup: 신규만 허용. 이미 이메일이 있으면 로그인으로 안내
 */
export default function GoogleSignInButton({
  label = 'Google로 계속하기',
  disabled = false,
  intent = 'login',
  style = {},
  className = '',
}) {
  const handleClick = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?intent=${encodeURIComponent(intent)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) {
        console.error('Google OAuth error:', error);
        alert(error.message || '구글 로그인에 실패했습니다.');
      }
    } catch (err) {
      console.error('Google OAuth error:', err);
      alert('구글 로그인에 실패했습니다. 환경 설정을 확인해주세요.');
    }
  };

  return (
    <button
      type="button"
      className={`btn btn-google ${className}`.trim()}
      onClick={handleClick}
      disabled={disabled}
      style={{
        width: '100%',
        marginTop: intent === 'signup' ? '0' : '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        fontWeight: 600,
        ...style,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.1 4 9.2 8.5 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.1 39.4 16 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 36.3 44 31.5 44 24c0-1.2-.1-2.3-.4-3.5z"
        />
      </svg>
      {label}
    </button>
  );
}
