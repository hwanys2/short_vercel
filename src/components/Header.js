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

function IconSun({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMoon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.2 14.1A8.2 8.2 0 0 1 9.9 3.8 8.3 8.3 0 1 0 20.2 14.1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMonitor({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 20.5h8M12 16.5v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconLayout({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.5 9.5h17M10 9.5v10.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconTrendingUp({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M23 6l-9.5 9.5-5-5L1 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 6h6v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUser({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19.5c1.6-3 4-4.5 6.5-4.5s4.9 1.5 6.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMail({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="m4.5 7.5 7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGift({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12" stroke="currentColor" strokeWidth="1.75" />
      <rect x="2" y="7" width="20" height="5" stroke="currentColor" strokeWidth="1.75" />
      <line x1="12" y1="22" x2="12" y2="7" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconKey({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="14" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M10.5 11.5 18 4l2 2-2.5 2.5L19 10l-2 2-1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLink({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLogout({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 5.5H7.5A2.5 2.5 0 0 0 5 8v8a2.5 2.5 0 0 0 2.5 2.5H10M14.5 15.5 18 12l-3.5-3.5M18 12H9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevron({ size = 14, open = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`account-chip-chevron${open ? ' is-open' : ''}`}
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuItemIcon({ children }) {
  return <span className="account-dropdown-icon">{children}</span>;
}

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
          setUser({ ...data.user, needsOnboarding: true });
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

  const accountLabel = user
    ? user.needsOnboarding
      ? user.email || '계정'
      : user.username || '계정'
    : '';
  const accountInitial = (accountLabel || '?').trim().charAt(0).toUpperCase();

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
            <div className="theme-switcher" role="group" aria-label="테마 선택">
              <button
                type="button"
                className={`theme-option ${themePreference === THEME_PREFERENCES.LIGHT ? 'is-active' : ''}`}
                aria-label="라이트 모드"
                aria-pressed={themePreference === THEME_PREFERENCES.LIGHT}
                title="라이트 모드"
                onClick={() => handleThemeChange(THEME_PREFERENCES.LIGHT)}
              >
                <IconSun />
              </button>
              <button
                type="button"
                className={`theme-option ${themePreference === THEME_PREFERENCES.DARK ? 'is-active' : ''}`}
                aria-label="다크 모드"
                aria-pressed={themePreference === THEME_PREFERENCES.DARK}
                title="다크 모드"
                onClick={() => handleThemeChange(THEME_PREFERENCES.DARK)}
              >
                <IconMoon />
              </button>
              <button
                type="button"
                className={`theme-option ${themePreference === THEME_PREFERENCES.SYSTEM ? 'is-active' : ''}`}
                aria-label={`시스템 설정 따르기 (현재: ${resolvedTheme === THEME_PREFERENCES.DARK ? '다크' : '라이트'})`}
                aria-pressed={themePreference === THEME_PREFERENCES.SYSTEM}
                title={`시스템 설정 따르기 (현재: ${resolvedTheme === THEME_PREFERENCES.DARK ? '다크' : '라이트'})`}
                onClick={() => handleThemeChange(THEME_PREFERENCES.SYSTEM)}
              >
                <IconMonitor />
              </button>
            </div>
            {loading ? null : user ? (
              <>
                <Link
                  href={user.needsOnboarding ? '/onboarding' : '/dashboard'}
                  className="nav-text-link nav-desktop-only"
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
                    <span className="account-avatar" aria-hidden="true">
                      {accountInitial}
                    </span>
                    <span className="account-chip-label">{accountLabel}</span>
                    <IconChevron open={menuOpen} />
                  </button>
                  {menuOpen && (
                    <div className="account-dropdown" role="menu">
                      {user.needsOnboarding ? (
                        <>
                          <Link
                            href="/onboarding"
                            className="account-dropdown-item"
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                          >
                            <MenuItemIcon>
                              <IconKey />
                            </MenuItemIcon>
                            본인코드 설정
                          </Link>
                          {user.is_admin && (
                            <>
                              <Link
                                href="/admin"
                                className="account-dropdown-item"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                              >
                                <MenuItemIcon>
                                  <IconTrendingUp />
                                </MenuItemIcon>
                                관리자 대시보드
                              </Link>
                              <Link
                                href="/admin/slot-requests"
                                className="account-dropdown-item"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                              >
                                <MenuItemIcon>
                                  <IconGift />
                                </MenuItemIcon>
                                슬롯 신청 관리
                              </Link>
                              <Link
                                href="/admin/slots"
                                className="account-dropdown-item"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                              >
                                <MenuItemIcon>
                                  <IconKey />
                                </MenuItemIcon>
                                코드 슬롯 관리
                              </Link>
                              <Link
                                href="/admin/link-account"
                                className="account-dropdown-item"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                              >
                                <MenuItemIcon>
                                  <IconLink />
                                </MenuItemIcon>
                                구글 계정 연동
                              </Link>
                              <Link
                                href="/admin/mailing"
                                className="account-dropdown-item"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                              >
                                <MenuItemIcon>
                                  <IconMail />
                                </MenuItemIcon>
                                메일 발송
                              </Link>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <Link
                            href="/dashboard"
                            className="account-dropdown-item account-dropdown-mobile-only"
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                          >
                            <MenuItemIcon>
                              <IconLayout />
                            </MenuItemIcon>
                            대시보드
                          </Link>
                          <Link
                            href="/profile"
                            className="account-dropdown-item"
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                          >
                            <MenuItemIcon>
                              <IconUser />
                            </MenuItemIcon>
                            프로필
                          </Link>
                          {user.is_admin && (
                            <>
                              <Link
                                href="/admin"
                                className="account-dropdown-item"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                              >
                                <MenuItemIcon>
                                  <IconTrendingUp />
                                </MenuItemIcon>
                                관리자 대시보드
                              </Link>
                              <Link
                                href="/admin/slot-requests"
                                className="account-dropdown-item"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                              >
                                <MenuItemIcon>
                                  <IconGift />
                                </MenuItemIcon>
                                슬롯 신청 관리
                              </Link>
                              <Link
                                href="/admin/slots"
                                className="account-dropdown-item"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                              >
                                <MenuItemIcon>
                                  <IconKey />
                                </MenuItemIcon>
                                코드 슬롯 관리
                              </Link>
                              <Link
                                href="/admin/link-account"
                                className="account-dropdown-item"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                              >
                                <MenuItemIcon>
                                  <IconLink />
                                </MenuItemIcon>
                                구글 계정 연동
                              </Link>
                              <Link
                                href="/admin/mailing"
                                className="account-dropdown-item"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                              >
                                <MenuItemIcon>
                                  <IconMail />
                                </MenuItemIcon>
                                메일 발송
                              </Link>
                            </>
                          )}
                        </>
                      )}
                      <div className="account-dropdown-divider" role="separator" />
                      <button
                        type="button"
                        className="account-dropdown-item account-dropdown-danger"
                        role="menuitem"
                        onClick={handleLogout}
                      >
                        <MenuItemIcon>
                          <IconLogout />
                        </MenuItemIcon>
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-text-link">
                  로그인
                </Link>
                <Link href="/register" className="btn btn-primary btn-sm nav-cta">
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
