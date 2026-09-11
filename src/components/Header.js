'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [themePreference, setThemePreference] = useState(THEME_PREFERENCES.SYSTEM);
  const [systemTheme, setSystemTheme] = useState(THEME_PREFERENCES.LIGHT);
  const resolvedTheme = themePreference === THEME_PREFERENCES.SYSTEM ? systemTheme : themePreference;

  useEffect(() => {
    setMounted(true);
    setThemePreference(getStoredThemePreference());
    setSystemTheme(getSystemTheme());
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && !data.needsOnboarding) setUser(data.user);
        else if (data.success && data.needsOnboarding) {
          setUser({ email: data.user?.email, needsOnboarding: true });
        }
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
    if (!mounted) return;
    applyResolvedTheme(resolvedTheme);
  }, [mounted, resolvedTheme]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleThemeChange = (nextPreference) => {
    setThemePreference(nextPreference);
    setStoredThemePreference(nextPreference);
    applyResolvedTheme(resolveTheme(nextPreference));
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/';
  };

  return (
    <header className="site-header">
      <div className="container">
        <div className="header-inner">
          <a
            href="/"
            className="logo"
            onClick={(e) => {
              e.preventDefault();
              window.location.assign('/');
            }}
          >
            숏.한국
          </a>
          <nav className="nav-links">
            <Link href="/guide" className="nav-text-link nav-desktop-only">
              가이드
            </Link>
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
                <Link
                  href={user.needsOnboarding ? '/onboarding' : '/dashboard'}
                  className="btn btn-ghost nav-desktop-only"
                >
                  {user.needsOnboarding ? '본인코드 설정' : '대시보드'}
                </Link>
                <div className="account-menu" ref={menuRef}>
                  <button
                    type="button"
                    className="account-chip"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <span className="account-chip-label">
                      {user.needsOnboarding ? user.email || '계정' : user.username || '계정'}
                    </span>
                    <span className="account-chip-caret" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                  {menuOpen && (
                    <div className="account-dropdown" role="menu">
                      {user.needsOnboarding ? (
                        <Link
                          href="/onboarding"
                          className="account-dropdown-item"
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                        >
                          본인코드 설정
                        </Link>
                      ) : (
                        <>
                          <Link
                            href="/dashboard"
                            className="account-dropdown-item account-dropdown-mobile-only"
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                          >
                            대시보드
                          </Link>
                          <Link
                            href="/profile"
                            className="account-dropdown-item"
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                          >
                            프로필
                          </Link>
                          {user.is_admin && (
                            <Link
                              href="/admin/mailing"
                              className="account-dropdown-item"
                              role="menuitem"
                              onClick={() => setMenuOpen(false)}
                            >
                              메일 발송
                            </Link>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        className="account-dropdown-item account-dropdown-danger"
                        role="menuitem"
                        onClick={handleLogout}
                      >
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
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
