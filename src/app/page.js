'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UrlForm from '@/components/UrlForm';
import UrlResult from '@/components/UrlResult';
import DeveloperBooksTeaser from '@/components/DeveloperBooksTeaser';

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
            <p className="hero-subtitle">긴 URL을 한글로 된 짧은 주소로 변환해보세요.</p>
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

        <div className="container">
          <DeveloperBooksTeaser />
        </div>

        {/* Stats */}
        <div className="container">
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-number">
                <AnimatedNumber value={stats.total} />
              </div>
              <div className="stat-label">현재 활성 URL</div>
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
