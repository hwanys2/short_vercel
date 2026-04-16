'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  THEME_PREFERENCES,
  applyResolvedTheme,
  getStoredThemePreference,
  getSystemTheme,
  resolveTheme,
  setStoredThemePreference,
} from '@/lib/theme';

export default function Header() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [themePreference, setThemePreference] = useState(() => getStoredThemePreference());
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());
  const resolvedTheme = themePreference === THEME_PREFERENCES.SYSTEM ? systemTheme : themePreference;

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? THEME_PREFERENCES.DARK : THEME_PREFERENCES.LIGHT);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  const handleThemeChange = (nextPreference) => {
    setThemePreference(nextPreference);
    setStoredThemePreference(nextPreference);
    applyResolvedTheme(resolveTheme(nextPreference));
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/';
  };

  return (
    <header className="site-header">
      <div className="container">
        <div className="header-inner">
          <Link href="/" className="logo">
            숏.한국
          </Link>
          <nav className="nav-links">
            <div className="theme-switcher" role="group" aria-label="테마 선택">
              <button
                type="button"
                className={`theme-option ${themePreference === THEME_PREFERENCES.LIGHT ? 'is-active' : ''}`}
                aria-label="라이트 모드"
                aria-pressed={themePreference === THEME_PREFERENCES.LIGHT}
                title="라이트 모드"
                onClick={() => handleThemeChange(THEME_PREFERENCES.LIGHT)}
              >
                {themePreference === THEME_PREFERENCES.LIGHT ? '☀️' : '☼'}
              </button>
              <button
                type="button"
                className={`theme-option ${themePreference === THEME_PREFERENCES.DARK ? 'is-active' : ''}`}
                aria-label="다크 모드"
                aria-pressed={themePreference === THEME_PREFERENCES.DARK}
                title="다크 모드"
                onClick={() => handleThemeChange(THEME_PREFERENCES.DARK)}
              >
                {themePreference === THEME_PREFERENCES.DARK ? '🌙' : '◐'}
              </button>
              <button
                type="button"
                className={`theme-option ${themePreference === THEME_PREFERENCES.SYSTEM ? 'is-active' : ''}`}
                aria-label={`시스템 설정 따르기 (현재: ${resolvedTheme === THEME_PREFERENCES.DARK ? '다크' : '라이트'})`}
                aria-pressed={themePreference === THEME_PREFERENCES.SYSTEM}
                title={`시스템 설정 따르기 (현재: ${resolvedTheme === THEME_PREFERENCES.DARK ? '다크' : '라이트'})`}
                onClick={() => handleThemeChange(THEME_PREFERENCES.SYSTEM)}
              >
                {themePreference === THEME_PREFERENCES.SYSTEM ? '🖥️' : '⌘'}
              </button>
            </div>
            {loading ? null : user ? (
              <>
                <Link href="/dashboard" className="btn btn-ghost">
                  대시보드
                </Link>
                <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost">
                  로그인
                </Link>
                <Link href="/register" className="btn btn-primary btn-sm">
                  회원가입
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
