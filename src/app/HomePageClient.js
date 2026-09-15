'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UrlForm from '@/components/UrlForm';
import UrlResult from '@/components/UrlResult';
import DeveloperBooksTeaser from '@/components/DeveloperBooksTeaser';
import AdSenseSlot from '@/components/AdSenseSlot';
import { useMediaQuery } from '@/lib/useMediaQuery';

const HOME_RAIL_AD_SLOT = '3012878973';

export default function HomePageClient() {
  const [user, setUser] = useState(null);
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    users: 0,
    byType: { url: 0, text: 0, file: 0, html: 0 },
  });
  const [statsReady, setStatsReady] = useState(false);
  const resultAnchorRef = useRef(null);
  const isWide = useMediaQuery('(min-width: 1280px)');

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
        if (data.success && !data.needsOnboarding) setUser(data.user);
        else if (data.success && data.needsOnboarding) {
          setUser({ email: data.user?.email, needsOnboarding: true });
        }
      })
      .catch(() => {});

    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') {
          setStats(data.data);
          setStatsReady(true);
        }
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
            <p className="hero-subtitle">긴 URL·텍스트·파일·웹페이지를 한글로 짧게 공유하세요.</p>
          </div>
        </section>

        <div className="home-wide-layout">
          {isWide && (
            <aside className="home-layout-ad">
              <AdSenseSlot slot={HOME_RAIL_AD_SLOT} variant="rail" />
            </aside>
          )}

          <div className="home-layout-main">
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
          </div>

          {!isWide && (
            <div className="home-layout-mid-ad">
              <div className="container">
                <AdSenseSlot variant="inline" />
              </div>
            </div>
          )}

          <aside className={`home-layout-books${isWide ? ' is-rail' : ' is-inline'}`}>
            <div className={isWide ? undefined : 'container'}>
              <DeveloperBooksTeaser layout={isWide ? 'rail' : 'inline'} />
            </div>
          </aside>

          <div className="home-layout-stats">
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

              {statsReady && (
                <div className="stats-breakdown-wrapper">
                  <div className="stats-breakdown-header">
                    <span className="stats-breakdown-badge">유형별 현황</span>
                  </div>
                  <ul className="stats-breakdown-grid" aria-label="활성 URL 유형별 개수">
                    <li className="stats-breakdown-card is-url">
                      <div className="stats-breakdown-icon-wrap" aria-hidden="true">
                        <span className="stats-breakdown-icon">🔗</span>
                      </div>
                      <div className="stats-breakdown-info">
                        <span className="stats-breakdown-label">URL 단축</span>
                        <span className="stats-breakdown-count">
                          <AnimatedNumber value={stats.byType?.url ?? 0} />
                        </span>
                      </div>
                    </li>
                    <li className="stats-breakdown-card is-text">
                      <div className="stats-breakdown-icon-wrap" aria-hidden="true">
                        <span className="stats-breakdown-icon">📋</span>
                      </div>
                      <div className="stats-breakdown-info">
                        <span className="stats-breakdown-label">텍스트 공유</span>
                        <span className="stats-breakdown-count">
                          <AnimatedNumber value={stats.byType?.text ?? 0} />
                        </span>
                      </div>
                    </li>
                    <li className="stats-breakdown-card is-file">
                      <div className="stats-breakdown-icon-wrap" aria-hidden="true">
                        <span className="stats-breakdown-icon">📎</span>
                      </div>
                      <div className="stats-breakdown-info">
                        <span className="stats-breakdown-label">파일 공유</span>
                        <span className="stats-breakdown-count">
                          <AnimatedNumber value={stats.byType?.file ?? 0} />
                        </span>
                      </div>
                    </li>
                    <li className="stats-breakdown-card is-html">
                      <div className="stats-breakdown-icon-wrap" aria-hidden="true">
                        <span className="stats-breakdown-icon">🌐</span>
                      </div>
                      <div className="stats-breakdown-info">
                        <span className="stats-breakdown-label">웹페이지 (HTML)</span>
                        <span className="stats-breakdown-count">
                          <AnimatedNumber value={stats.byType?.html ?? 0} />
                        </span>
                      </div>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer suppressAdSense={true} />
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
