'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function formatDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    }).format(d);
  } catch {
    return iso;
  }
}

// 아이콘 컴포넌트들
function IconTrendingUp({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M23 6l-9.5 9.5-5-5L1 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 6h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUsers({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M23 21v-2a4 4 0 0 0-3-3.87"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.8"
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
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconEye({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconRefresh({ size = 14, spinning = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{
        transition: 'transform 0.5s ease',
        transform: spinning ? 'rotate(360deg)' : 'none',
      }}
    >
      <path
        d="M23 4v6h-6M1 20v-6h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDownload({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState('loading'); // loading | ok | denied
  const [period, setPeriod] = useState('30d'); // 7d | 14d | 30d | 90d | 1y
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // 차트 제어 상태
  const [chartTab, setChartTab] = useState('combined'); // combined | users | urls | visits
  const [showCumulative, setShowCumulative] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);

  // 일자별 상세 테이블 펼침 상태
  const [showTable, setShowTable] = useState(false);

  // 고유 ID 생성 (SVG 그라디언트 충돌 방지)
  const usersGradientId = useId();
  const urlsGradientId = useId();
  const visitsGradientId = useId();

  // 1. 관리자 권한 확인
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((d) => {
        if (!d.success) {
          router.push('/login');
          return;
        }
        if (d.needsOnboarding) {
          router.push('/onboarding');
          return;
        }
        if (!d.user?.is_admin) {
          setAuthState('denied');
          return;
        }
        setAuthState('ok');
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // 2. 통계 데이터 페칭
  const fetchDashboardData = useCallback(
    async (targetPeriod = period, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setErrorMsg(null);

      try {
        const res = await fetch(`/api/admin/dashboard?period=${targetPeriod}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || '통계 데이터를 불러오지 못했습니다.');
        }
        setData(json);
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period]
  );

  useEffect(() => {
    if (authState === 'ok') {
      fetchDashboardData(period);
    }
  }, [authState, period, fetchDashboardData]);

  // CSV 다운로드 함수
  const handleExportCsv = () => {
    if (!data?.timeSeries) return;

    const headers = ['날짜', '신규가입자', '누적가입자', '신규URL생성', '회원URL', '비회원URL', '누적URL', '방문클릭수'];
    const rows = data.timeSeries.map((item) => [
      item.date,
      item.users,
      item.cumulativeUsers,
      item.urls,
      item.memberUrls,
      item.guestUrls,
      item.cumulativeUrls,
      item.visits,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `short_korea_stats_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 차트 데이터 계산
  const timeSeries = data?.timeSeries || [];
  const summary = data?.summary;

  const chartMetrics = useMemo(() => {
    if (!timeSeries.length) return null;

    let maxUsers = Math.max(1, ...timeSeries.map((d) => d.users));
    let maxCumulativeUsers = Math.max(1, ...timeSeries.map((d) => d.cumulativeUsers));
    let maxUrls = Math.max(1, ...timeSeries.map((d) => d.urls));
    let maxCumulativeUrls = Math.max(1, ...timeSeries.map((d) => d.cumulativeUrls));
    let maxVisits = Math.max(1, ...timeSeries.map((d) => d.visits));

    return {
      maxUsers,
      maxCumulativeUsers,
      maxUrls,
      maxCumulativeUrls,
      maxVisits,
    };
  }, [timeSeries]);

  // 접근 제한 화면
  if (authState === 'loading') {
    return (
      <>
        <Header />
        <main>
          <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-muted)' }}>관리자 권한을 확인하고 있습니다...</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (authState === 'denied') {
    return (
      <>
        <Header />
        <main>
          <div className="container" style={{ padding: '80px 20px', maxWidth: 500, textAlign: 'center' }}>
            <div
              style={{
                fontSize: '3rem',
                marginBottom: 16,
              }}
            >
              🔒
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>관리자 전용 페이지</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              이 페이지는 시스템 관리자 계정으로 로그인한 경우에만 이용하실 수 있습니다.
            </p>
            <Link href="/" className="btn btn-primary">
              홈으로 이동
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // 증감 계산 헬퍼
  const diffUsers = (summary?.today.users || 0) - (summary?.yesterday.users || 0);
  const diffUrls = (summary?.today.urls || 0) - (summary?.yesterday.urls || 0);

  return (
    <>
      <Header />
      <main>
        <div className="container" style={{ padding: '32px 20px 64px', maxWidth: 1100 }}>
          {/* 1. 상단 타이틀 및 관리자 뱃지 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                전체 서비스 추이 대시보드
              </h1>
              <span
                style={{
                  background: 'var(--gradient-glow)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '3px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                }}
              >
                관리자 전용
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>
              숏.한국 서비스의 신규 회원 가입, 단축 URL 생성, 링크 접속 트래픽의 전체적인 추이와 주요 지표를 실시간으로
              분석합니다.
            </p>
          </div>

          {/* 2. 관리자 서브 탭 바로가기 */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 24,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <Link href="/admin" className="btn btn-sm btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconTrendingUp size={14} />
              대시보드
            </Link>
            <Link href="/admin/slots" className="btn btn-sm btn-secondary">
              코드 슬롯 관리
            </Link>
            <Link href="/admin/link-account" className="btn btn-sm btn-secondary">
              구글 계정 연동
            </Link>
            <Link href="/admin/mailing" className="btn btn-sm btn-secondary">
              단체 메일 발송 →
            </Link>
          </div>

          {/* 3. 상단 컨트롤 바 (기간 선택 / 새로고침 / CSV 내보내기) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {/* 기간 필터 버튼 그룹 */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 4,
                gap: 4,
              }}
            >
              {[
                { key: '7d', label: '최근 7일' },
                { key: '14d', label: '14일' },
                { key: '30d', label: '30일 (기본)' },
                { key: '90d', label: '90일' },
                { key: '1y', label: '1년' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPeriod(item.key)}
                  style={{
                    border: 'none',
                    background: period === item.key ? 'var(--primary)' : 'transparent',
                    color: period === item.key ? '#fff' : 'var(--text-secondary)',
                    fontWeight: period === item.key ? 700 : 500,
                    fontSize: '0.85rem',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* 유틸리티 액션 버튼 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fetchDashboardData(period, true)}
                disabled={loading || refreshing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="데이터 새로고침"
              >
                <IconRefresh spinning={refreshing} />
                새로고침
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExportCsv}
                disabled={!data}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="CSV 데이터 다운로드"
              >
                <IconDownload />
                CSV 다운로드
              </button>
            </div>
          </div>

          {/* 에러 메시지 알림 */}
          {errorMsg && (
            <div className="alert alert-danger" style={{ marginBottom: 24 }}>
              {errorMsg}
            </div>
          )}

          {/* 로딩 표시 */}
          {loading ? (
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--text-muted)' }}>통계 데이터를 집계하고 분석하는 중입니다...</p>
            </div>
          ) : data ? (
            <>
              {/* 4. 핵심 지표 KPI 카드 4종 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 16,
                  marginBottom: 28,
                }}
              >
                {/* 카드 1: 총 가입자 수 */}
                <div
                  className="card"
                  style={{
                    padding: 20,
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'var(--bg-card)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      총 가입자 수
                    </span>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 8,
                        background: 'rgba(94, 105, 235, 0.1)',
                        color: 'var(--primary)',
                      }}
                    >
                      <IconUsers size={16} />
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                      {summary?.totalUsers.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>명</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        color: 'var(--primary)',
                        fontWeight: 700,
                        background: 'rgba(94, 105, 235, 0.12)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      오늘 +{summary?.today.users}명
                    </span>
                    <span style={{ color: diffUsers >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      (어제 {diffUsers >= 0 ? `+${diffUsers}` : diffUsers}명)
                    </span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    기간 내 일평균 <strong>{summary?.period.avgDailyUsers}명</strong> 신규 가입
                  </div>
                </div>

                {/* 카드 2: 단축 URL 신규 생성 */}
                <div
                  className="card"
                  style={{
                    padding: 20,
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'var(--bg-card)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      총 단축 URL
                    </span>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 8,
                        background: 'rgba(103, 212, 232, 0.12)',
                        color: '#0284c7',
                      }}
                    >
                      <IconLink size={16} />
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                      {summary?.totalUrls.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>개</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        color: '#0284c7',
                        fontWeight: 700,
                        background: 'rgba(103, 212, 232, 0.15)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      오늘 +{summary?.today.urls}개
                    </span>
                    <span style={{ color: diffUrls >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      (어제 {diffUrls >= 0 ? `+${diffUrls}` : diffUrls}개)
                    </span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    회원 생성 {summary?.memberUrlRatio}% · 게스트 {100 - (summary?.memberUrlRatio || 0)}%
                  </div>
                </div>

                {/* 카드 3: 오늘 접속/클릭 트래픽 */}
                <div
                  className="card"
                  style={{
                    padding: 20,
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'var(--bg-card)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      오늘 접속 (클릭수)
                    </span>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 8,
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--success)',
                      }}
                    >
                      <IconEye size={16} />
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--success)' }}>
                      {summary?.today.visits.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>회</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      어제 <strong>{summary?.yesterday.visits.toLocaleString()}회</strong>
                    </span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    기간 내 총 <strong>{summary?.period.totalVisits.toLocaleString()}회</strong> 클릭 집계
                  </div>
                </div>

                {/* 카드 4: 본인코드 및 활성 지표 */}
                <div
                  className="card"
                  style={{
                    padding: 20,
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'var(--bg-card)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      등록 본인코드
                    </span>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 8,
                        background: 'rgba(167, 139, 250, 0.12)',
                        color: 'var(--secondary)',
                      }}
                    >
                      <IconTrendingUp size={16} />
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                      {summary?.totalCodes.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>개</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                    <span
                      style={{
                        color: 'var(--secondary)',
                        fontWeight: 600,
                        background: 'rgba(167, 139, 250, 0.15)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      구글 연동 {summary?.googleUserRatio}%
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>({summary?.totalGoogleUsers}명)</span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    링크 {summary?.urlTypes.url.toLocaleString()} · 파일 {summary?.urlTypes.file.toLocaleString()} · 메모{' '}
                    {summary?.urlTypes.text.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 5. 메인 추이 차트 카드 */}
              <div className="card" style={{ padding: 24, marginBottom: 28 }}>
                {/* 차트 상단 탭 및 옵션 바 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 4px' }}>
                      {chartTab === 'combined' && '신규 가입자 및 단축 URL 생성 종합 추이'}
                      {chartTab === 'users' && '신규 회원 가입자 추이'}
                      {chartTab === 'urls' && '단축 URL 신규 생성 추이 (회원 vs 게스트)'}
                      {chartTab === 'visits' && '일별 링크 접속/클릭 트래픽 추이'}
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      최근 {data.daysCount}일간 KST(한국시간) 기준 일별 집계
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* 차트 모드 전환 탭 */}
                    <div
                      style={{
                        display: 'inline-flex',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: 3,
                      }}
                    >
                      {[
                        { key: 'combined', label: '종합 비교' },
                        { key: 'users', label: '가입자' },
                        { key: 'urls', label: 'URL 생성' },
                        { key: 'visits', label: '방문 트래픽' },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setChartTab(tab.key);
                            setHoverIndex(null);
                          }}
                          style={{
                            border: 'none',
                            background: chartTab === tab.key ? 'var(--bg-card)' : 'transparent',
                            color: chartTab === tab.key ? 'var(--text)' : 'var(--text-muted)',
                            fontWeight: chartTab === tab.key ? 700 : 500,
                            boxShadow: chartTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            fontSize: '0.82rem',
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* 누적 성장 곡선 토글 (가입자 및 URL 탭에서 지원) */}
                    {(chartTab === 'users' || chartTab === 'urls') && (
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          color: 'var(--text-secondary)',
                          marginLeft: 4,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={showCumulative}
                          onChange={(e) => setShowCumulative(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        누적 성장 곡선 보기
                      </label>
                    )}
                  </div>
                </div>

                {/* 범례 표시 */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: '0.82rem', flexWrap: 'wrap' }}>
                  {chartTab === 'combined' && (
                    <>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--primary)' }} />
                        신규 가입자 (명)
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 2, background: '#0284c7' }} />
                        단축 URL 생성 (개)
                      </span>
                    </>
                  )}
                  {chartTab === 'users' && (
                    <>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--primary)' }} />
                        일별 신규 가입자
                      </span>
                      {showCumulative && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--secondary)' }} />
                          누적 가입자 성장 곡선
                        </span>
                      )}
                    </>
                  )}
                  {chartTab === 'urls' && (
                    <>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--primary)' }} />
                        회원 생성 URL
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 2, background: '#67d4e8' }} />
                        비회원/게스트 생성 URL
                      </span>
                      {showCumulative && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 14, height: 3, borderRadius: 2, background: '#f59e0b' }} />
                          누적 생성 곡선
                        </span>
                      )}
                    </>
                  )}
                  {chartTab === 'visits' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--success)' }} />
                      일별 링크 접속/클릭수
                    </span>
                  )}
                </div>

                {/* 반응형 SVG 인터랙티브 차트 */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: 320,
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 8px 8px',
                    boxSizing: 'border-box',
                  }}
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  <InteractiveChart
                    tab={chartTab}
                    timeSeries={timeSeries}
                    metrics={chartMetrics}
                    showCumulative={showCumulative}
                    hoverIndex={hoverIndex}
                    setHoverIndex={setHoverIndex}
                    usersGradientId={usersGradientId}
                    urlsGradientId={urlsGradientId}
                    visitsGradientId={visitsGradientId}
                  />

                  {/* 마우스 호버 툴팁 */}
                  {hoverIndex !== null && timeSeries[hoverIndex] && (
                    <ChartTooltip item={timeSeries[hoverIndex]} tab={chartTab} />
                  )}
                </div>

                {/* 피크일 및 요약 배너 */}
                <div
                  style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: '0.85rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    {chartTab === 'users' || chartTab === 'combined' ? (
                      <span>
                        가입자 피크일:{' '}
                        <strong style={{ color: 'var(--primary)' }}>
                          {summary?.period.peakUsers.label || summary?.period.peakUsers.date} (
                          {summary?.period.peakUsers.count}명)
                        </strong>
                      </span>
                    ) : null}
                    {(chartTab === 'urls' || chartTab === 'combined') && (
                      <span style={{ marginLeft: chartTab === 'combined' ? 16 : 0 }}>
                        URL 생성 피크일:{' '}
                        <strong style={{ color: '#0284c7' }}>
                          {summary?.period.peakUrls.label || summary?.period.peakUrls.date} (
                          {summary?.period.peakUrls.count}개)
                        </strong>
                      </span>
                    )}
                    {chartTab === 'visits' && (
                      <span>
                        트래픽 피크일:{' '}
                        <strong style={{ color: 'var(--success)' }}>
                          {summary?.period.peakVisits.label || summary?.period.peakVisits.date} (
                          {summary?.period.peakVisits.count.toLocaleString()}회)
                        </strong>
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    조회 기간 총: 가입자 {summary?.period.totalUsers.toLocaleString()}명 · URL{' '}
                    {summary?.period.totalUrls.toLocaleString()}개 · 클릭{' '}
                    {summary?.period.totalVisits.toLocaleString()}회
                  </div>
                </div>
              </div>

              {/* 6. 보조 분석 위젯 (유형별 분포 / 생성 주체별) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 20,
                  marginBottom: 28,
                }}
              >
                {/* 위젯 1: URL 유형 분포 */}
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px' }}>단축 URL 콘텐츠 유형 비중</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                      {
                        label: '일반 웹 링크 (URL)',
                        count: summary?.urlTypes.url || 0,
                        color: 'var(--primary)',
                      },
                      {
                        label: '파일 공유 (File)',
                        count: summary?.urlTypes.file || 0,
                        color: 'var(--secondary)',
                      },
                      {
                        label: '텍스트 메모 (Text)',
                        count: summary?.urlTypes.text || 0,
                        color: 'var(--accent)',
                      },
                    ].map((item) => {
                      const pct = summary?.totalUrls ? Math.round((item.count / summary.totalUrls) * 100) : 0;
                      return (
                        <div key={item.label}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.85rem',
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{item.label}</span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {item.count.toLocaleString()}건 ({pct}%)
                            </span>
                          </div>
                          <div
                            style={{
                              height: 8,
                              borderRadius: 4,
                              background: 'var(--border)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: item.color,
                                borderRadius: 4,
                                transition: 'width 0.5s ease',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 위젯 2: 생성 주체 및 사용자 분포 */}
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px' }}>생성 주체 및 계정 연동 현황</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.85rem',
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>회원 생성 URL 비율</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {summary?.totalMemberUrls.toLocaleString()}건 ({summary?.memberUrlRatio}%)
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${summary?.memberUrlRatio}%`,
                            height: '100%',
                            background: 'var(--primary)',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.85rem',
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>구글 계정 연동 가입자 비율</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {summary?.totalGoogleUsers.toLocaleString()}명 ({summary?.googleUserRatio}%)
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${summary?.googleUserRatio}%`,
                            height: '100%',
                            background: 'var(--secondary)',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                      💡 전체 {summary?.totalUrls.toLocaleString()}개 단축 URL 중{' '}
                      <strong>{summary?.totalGuestUrls.toLocaleString()}개</strong>는 비회원(게스트) 또는 회원 임시
                      주소입니다.
                    </div>
                  </div>
                </div>
              </div>

              {/* 7. 최신 활동 피드 및 인기 URL 랭킹 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 20,
                  marginBottom: 28,
                }}
              >
                {/* 실시간 신규 가입자 */}
                <div className="card" style={{ padding: 20 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>최근 가입 회원</h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>실시간 최신순</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(data.recentUsers || []).slice(0, 5).map((u) => (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: 'var(--primary-light)',
                              color: '#fff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {(u.username || u.email || '?')[0].toUpperCase()}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.username || '익명'}
                            </div>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {u.email}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {formatDate(u.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 최근 생성된 단축 URL */}
                <div className="card" style={{ padding: 20 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>최근 생성 단축 URL</h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>실시간 최신순</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(data.recentUrls || []).slice(0, 5).map((l) => (
                      <div
                        key={l.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ minWidth: 0, paddingRight: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ color: 'var(--primary)' }}>/{l.code}</strong>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: l.user_id ? 'rgba(94, 105, 235, 0.12)' : 'rgba(103, 212, 232, 0.15)',
                                color: l.user_id ? 'var(--primary)' : '#0284c7',
                                fontWeight: 600,
                              }}
                            >
                              {l.user_id ? '회원' : '게스트'}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 180,
                            }}
                          >
                            {l.original_url}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {formatDate(l.created_at)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            클릭 {l.visits || 0}회
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 누적 최다 방문 TOP URL */}
                <div className="card" style={{ padding: 20 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>인기 단축 URL (최다 클릭)</h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>누적 방문 순위</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(data.topUrls || []).slice(0, 5).map((l, idx) => (
                      <div
                        key={l.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, paddingRight: 8 }}>
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--border)',
                              color: idx < 3 ? '#fff' : 'var(--text-muted)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>/{l.code}</div>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 170,
                              }}
                            >
                              {l.original_url}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: 'var(--success)',
                              background: 'rgba(16, 185, 129, 0.1)',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {(l.visits || 0).toLocaleString()}회
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 8. 일자별 상세 집계 데이터 테이블 (접기/펼치기) */}
              <div className="card" style={{ padding: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowTable((v) => !v)}
                >
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                      일자별 상세 집계 표 ({timeSeries.length}일)
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      클릭하여 일자별 신규 가입자, URL 생성, 접속 클릭 상세 수치를 확인합니다.
                    </p>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm">
                    {showTable ? '접기 ▲' : '펼치기 ▼'}
                  </button>
                </div>

                {showTable && (
                  <div style={{ marginTop: 16, overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.85rem',
                        textAlign: 'left',
                      }}
                    >
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 8px' }}>날짜</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>신규 가입자</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>누적 가입자</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>신규 URL</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>회원 생성</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>게스트 생성</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>누적 URL</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>방문(클릭)수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...timeSeries].reverse().map((row) => (
                          <tr
                            key={row.date}
                            style={{
                              borderBottom: '1px solid var(--border)',
                              transition: 'background 0.2s',
                            }}
                          >
                            <td style={{ padding: '8px' }}>
                              <strong>{row.date}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({row.label.split(' ')[1] || ''})</span>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: row.users > 0 ? 'var(--primary)' : 'inherit', fontWeight: row.users > 0 ? 600 : 400 }}>
                              {row.users}명
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                              {row.cumulativeUsers.toLocaleString()}명
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: row.urls > 0 ? '#0284c7' : 'inherit', fontWeight: row.urls > 0 ? 600 : 400 }}>
                              {row.urls}개
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                              {row.memberUrls}개
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                              {row.guestUrls}개
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                              {row.cumulativeUrls.toLocaleString()}개
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: row.visits > 0 ? 'var(--success)' : 'inherit', fontWeight: row.visits > 0 ? 600 : 400 }}>
                              {row.visits.toLocaleString()}회
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  );
}

/**
 * 인터랙티브 반응형 SVG 차트 컴포넌트
 */
function InteractiveChart({
  tab,
  timeSeries,
  metrics,
  showCumulative,
  hoverIndex,
  setHoverIndex,
  usersGradientId,
  urlsGradientId,
  visitsGradientId,
}) {
  if (!timeSeries || timeSeries.length === 0 || !metrics) return null;

  const width = 900;
  const height = 280;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const count = timeSeries.length;
  const stepX = chartW / Math.max(1, count);

  // Y축 최댓값 결정
  let maxY = 10;
  if (tab === 'users') {
    maxY = showCumulative ? metrics.maxCumulativeUsers : metrics.maxUsers;
  } else if (tab === 'urls') {
    maxY = showCumulative ? metrics.maxCumulativeUrls : metrics.maxUrls;
  } else if (tab === 'visits') {
    maxY = metrics.maxVisits;
  } else if (tab === 'combined') {
    maxY = Math.max(metrics.maxUsers, metrics.maxUrls);
  }
  // Y축 상단 여유
  maxY = Math.ceil(maxY * 1.15) || 10;

  // 보조 그리드 라인 계산
  const gridLines = [0.25, 0.5, 0.75, 1].map((p) => ({
    val: Math.round(maxY * p),
    y: padTop + chartH * (1 - p),
  }));

  // X축 레이블 샘플링
  const labelInterval = Math.max(1, Math.floor(count / 7));

  // 스무스 베지어 곡선 생성 헬퍼
  const buildSmoothPath = (points) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  // 마우스 이동 시 호버 인덱스 감지
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const relX = (x / rect.width) * width - padLeft;
    const idx = Math.max(0, Math.min(count - 1, Math.floor(relX / stepX)));
    setHoverIndex(idx);
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: '100%', overflow: 'visible', cursor: 'crosshair' }}
      onMouseMove={handleMouseMove}
    >
      <defs>
        {/* 그라디언트 정의 */}
        <linearGradient id={usersGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={urlsGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0284c7" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={visitsGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--success)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--success)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y축 그리드 라인 */}
      {gridLines.map((g) => (
        <g key={g.y}>
          <line
            x1={padLeft}
            y1={g.y}
            x2={width - padRight}
            y2={g.y}
            stroke="var(--border)"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text
            x={padLeft - 8}
            y={g.y + 4}
            textAnchor="end"
            fill="var(--text-muted)"
            fontSize="10"
            fontWeight="500"
          >
            {g.val >= 1000 ? `${(g.val / 1000).toFixed(1)}k` : g.val}
          </text>
        </g>
      ))}

      {/* 바 및 데이터 그래픽 렌더링 */}
      {timeSeries.map((item, i) => {
        const x = padLeft + i * stepX;
        const isHover = hoverIndex === i;

        if (tab === 'users' && !showCumulative) {
          const barW = Math.max(3, stepX * 0.7);
          const barH = (item.users / maxY) * chartH;
          const y = padTop + chartH - barH;
          return (
            <rect
              key={item.date}
              x={x + (stepX - barW) / 2}
              y={y}
              width={barW}
              height={Math.max(1, barH)}
              rx={barW > 6 ? 3 : 1}
              fill={isHover ? 'var(--primary-dark)' : `url(#${usersGradientId})`}
              opacity={hoverIndex !== null && !isHover ? 0.6 : 1}
              style={{ transition: 'fill 0.2s, opacity 0.2s' }}
            />
          );
        }

        if (tab === 'urls' && !showCumulative) {
          const barW = Math.max(3, stepX * 0.7);
          const memberH = (item.memberUrls / maxY) * chartH;
          const guestH = (item.guestUrls / maxY) * chartH;
          const totalH = memberH + guestH;
          const y = padTop + chartH - totalH;

          return (
            <g key={item.date} opacity={hoverIndex !== null && !isHover ? 0.6 : 1}>
              {/* 게스트 생성 (상단) */}
              <rect
                x={x + (stepX - barW) / 2}
                y={y}
                width={barW}
                height={Math.max(0, guestH)}
                rx={barW > 6 ? 2 : 1}
                fill="#67d4e8"
              />
              {/* 회원 생성 (하단) */}
              <rect
                x={x + (stepX - barW) / 2}
                y={y + guestH}
                width={barW}
                height={Math.max(0, memberH)}
                rx={barW > 6 ? 2 : 1}
                fill="var(--primary)"
              />
            </g>
          );
        }

        if (tab === 'combined') {
          const barW = Math.max(2, (stepX * 0.75) / 2);
          const uH = (item.users / maxY) * chartH;
          const urlH = (item.urls / maxY) * chartH;
          const uY = padTop + chartH - uH;
          const urlY = padTop + chartH - urlH;

          return (
            <g key={item.date} opacity={hoverIndex !== null && !isHover ? 0.5 : 1}>
              <rect
                x={x + stepX * 0.1}
                y={uY}
                width={barW}
                height={Math.max(1, uH)}
                rx={2}
                fill="var(--primary)"
              />
              <rect
                x={x + stepX * 0.1 + barW + 1}
                y={urlY}
                width={barW}
                height={Math.max(1, urlH)}
                rx={2}
                fill="#0284c7"
              />
            </g>
          );
        }

        return null;
      })}

      {/* 라인 차트 렌더링 (누적 모드 or 방문 트래픽 모드) */}
      {(tab === 'visits' || (showCumulative && (tab === 'users' || tab === 'urls'))) && (
        <LineChartPath
          tab={tab}
          timeSeries={timeSeries}
          maxY={maxY}
          padLeft={padLeft}
          padTop={padTop}
          chartW={chartW}
          chartH={chartH}
          stepX={stepX}
          buildSmoothPath={buildSmoothPath}
          visitsGradientId={visitsGradientId}
        />
      )}

      {/* X축 날짜 레이블 */}
      {timeSeries.map((item, i) => {
        if (i % labelInterval !== 0 && i !== count - 1) return null;
        const x = padLeft + i * stepX + stepX / 2;
        return (
          <text
            key={item.date}
            x={x}
            y={height - 8}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="10"
            fontWeight="500"
          >
            {item.label.split(' ')[0]}
          </text>
        );
      })}

      {/* 마우스 호버 가이드라인 */}
      {hoverIndex !== null && (
        <line
          x1={padLeft + hoverIndex * stepX + stepX / 2}
          y1={padTop}
          x2={padLeft + hoverIndex * stepX + stepX / 2}
          y2={padTop + chartH}
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

/**
 * 방문수 또는 누적치 라인/면적 차트 패스 렌더링
 */
function LineChartPath({
  tab,
  timeSeries,
  maxY,
  padLeft,
  padTop,
  chartW,
  chartH,
  stepX,
  buildSmoothPath,
  visitsGradientId,
}) {
  const points = timeSeries.map((d, i) => {
    let val = 0;
    if (tab === 'visits') val = d.visits;
    else if (tab === 'users') val = d.cumulativeUsers;
    else if (tab === 'urls') val = d.cumulativeUrls;

    const x = padLeft + i * stepX + stepX / 2;
    const y = padTop + chartH - (val / maxY) * chartH;
    return { x, y };
  });

  const linePath = buildSmoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`
      : '';

  const strokeColor = tab === 'visits' ? 'var(--success)' : tab === 'users' ? 'var(--secondary)' : '#f59e0b';

  return (
    <g>
      {tab === 'visits' && <path d={areaPath} fill={`url(#${visitsGradientId})`} pointerEvents="none" />}
      <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.5" pointerEvents="none" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          fill="var(--bg-card)"
          stroke={strokeColor}
          strokeWidth="2"
          pointerEvents="none"
        />
      ))}
    </g>
  );
}

/**
 * 마우스 호버 시 툴팁
 */
function ChartTooltip({ item, tab }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 14px',
        fontSize: '0.82rem',
        pointerEvents: 'none',
        zIndex: 10,
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
        {item.date} {item.label.split(' ')[1] || ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: 'var(--primary)' }}>신규 가입자:</span>
          <strong>{item.users}명</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#0284c7' }}>URL 생성:</span>
          <strong>{item.urls}개</strong>
        </div>
        {item.urls > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: 8 }}>
            (회원 {item.memberUrls}개 / 게스트 {item.guestUrls}개)
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: 'var(--success)' }}>링크 클릭수:</span>
          <strong>{item.visits.toLocaleString()}회</strong>
        </div>
        {(tab === 'users' || tab === 'urls') && (
          <div
            style={{
              marginTop: 4,
              paddingTop: 4,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>누적 현황:</span>
            <span>
              가입 {item.cumulativeUsers.toLocaleString()}명 · URL {item.cumulativeUrls.toLocaleString()}개
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
