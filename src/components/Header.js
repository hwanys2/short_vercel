'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Header() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
