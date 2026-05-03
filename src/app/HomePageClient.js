'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UrlForm from '@/components/UrlForm';
import UrlResult from '@/components/UrlResult';
import DeveloperBooksTeaser from '@/components/DeveloperBooksTeaser';

export default function HomePageClient() {
  const [user, setUser] = useState(null);
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({ total: 0, today: 0, users: 0 });
  const resultAnchorRef = useRef(null);

  useEffect(() => {
    if (!result) return;
    const id = requestAnimationFrame(() => {
      resultAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
    return () => cancelAnimationFrame(id);
  }, [result]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUser(data.user);
      })
      .catch(() => {});

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
        <section className="hero">
          <div className="container">
            <h1 className="hero-title">
              <span className="gradient-text">한글로 만드는</span>
              <br />
              짧은 URL
            </h1>
            <p className="hero-subtitle">긴 URL을 짧게, 텍스트를 간편하게 공유하세요.</p>
          </div>
        </section>

        <div className="container">
          <div className="home-shorten-stack">
            {result && (
              <div ref={resultAnchorRef} className="home-shorten-result">
                <UrlResult data={result} user={user} />
              </div>
            )}
            <UrlForm user={user} onResult={setResult} />
          </div>
        </div>

        <div className="container">
          <DeveloperBooksTeaser />
        </div>

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
