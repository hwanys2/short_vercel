'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UrlForm from '@/components/UrlForm';
import UrlResult from '@/components/UrlResult';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({ total: 0, today: 0, users: 0 });

  useEffect(() => {
    // 사용자 정보 가져오기
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUser(data.user);
      })
      .catch(() => {});

    // 통계 가져오기
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') setStats(data.data);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <Header />
      <main>
        {/* Hero Section */}
        <section className="hero">
          <div className="container">
            <h1 className="hero-title">
              <span className="gradient-text">한글로 만드는</span>
              <br />
              짧은 URL
            </h1>
            <p className="hero-subtitle">
              긴 URL을 한글로 된 짧은 주소로 변환해보세요.
              <br />
              원하는 단어로 직접 커스터마이징할 수 있습니다.
            </p>
          </div>
        </section>

        {/* URL Form */}
        <div className="container">
          <UrlForm user={user} onResult={setResult} />
        </div>

        {/* Result */}
        {result && (
          <div className="container">
            <UrlResult data={result} user={user} />
          </div>
        )}

        {/* Stats */}
        <div className="container">
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-number">
                <AnimatedNumber value={stats.total} />
              </div>
              <div className="stat-label">전체 URL</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                <AnimatedNumber value={stats.today} />
              </div>
              <div className="stat-label">오늘 생성</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                <AnimatedNumber value={stats.users} />
              </div>
              <div className="stat-label">회원 수</div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="container" style={{ marginBottom: '60px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>
              <span className="gradient-text">왜 숏.한국인가요?</span>
            </h2>
          </div>
          <div className="stats-row">
            <div className="stat-card" style={{ textAlign: 'left', padding: '28px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🇰🇷</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px' }}>한글 URL 지원</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                숏.한국/수학, 숏.한국/영어 등 한글로 된 기억하기 쉬운 단축 URL을 만들 수 있습니다.
              </p>
            </div>
            <div className="stat-card" style={{ textAlign: 'left', padding: '28px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>♾️</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px' }}>회원 영구 URL</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                회원가입하면 영구적으로 유지되는 개인 단축 URL을 무제한으로 만들 수 있습니다.
              </p>
            </div>
            <div className="stat-card" style={{ textAlign: 'left', padding: '28px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📊</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px' }}>클릭 통계</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                대시보드에서 각 URL의 방문 횟수와 통계를 실시간으로 확인할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 1500;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}
