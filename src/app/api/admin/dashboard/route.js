import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1000;

/**
 * 테이블에서 조건에 맞는 데이터를 1,000행씩 병렬 페칭
 */
async function fetchAllInParallel(admin, table, selectCols, gteCol, gteVal) {
  let countQuery = admin.from(table).select('*', { count: 'exact', head: true });
  if (gteCol && gteVal) {
    countQuery = countQuery.gte(gteCol, gteVal);
  }
  const { count, error: countErr } = await countQuery;
  if (countErr) throw countErr;

  const total = count || 0;
  const numPages = Math.ceil(total / PAGE_SIZE);
  if (numPages === 0) return { total: 0, rows: [] };

  const promises = [];
  for (let p = 0; p < numPages; p++) {
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = admin.from(table).select(selectCols).range(from, to);
    if (gteCol && gteVal) {
      q = q.gte(gteCol, gteVal);
    }
    promises.push(q);
  }

  const results = await Promise.all(promises);
  const rows = [];
  for (const r of results) {
    if (r.error) throw r.error;
    if (r.data) rows.push(...r.data);
  }
  return { total, rows };
}

/**
 * ISO 타임스탬프를 한국 시간(KST, Asia/Seoul) YYYY-MM-DD 문자열로 변환
 */
function toKSTDateString(isoOrDate) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
}

/**
 * YYYY-MM-DD 날짜를 한국어 요일 레이블로 포맷 (예: "09/14 (월)")
 */
function formatKSTDayLabel(dateStr) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(date);
    return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')} (${weekday})`;
  } catch {
    return dateStr;
  }
}

export async function GET(request) {
  const gate = await requireAdmin(request);
  if (gate.response) return gate.response;

  const { admin } = gate;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30d';

  try {
    // 1. KST 기준 오늘 & 어제 및 조회 기간 계산
    const now = new Date();
    const todayStr = toKSTDateString(now);
    const todayStart = new Date(`${todayStr}T00:00:00+09:00`);
    const todayStartIso = todayStart.toISOString();

    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = toKSTDateString(yesterdayStart);
    const yesterdayStartIso = yesterdayStart.toISOString();

    let daysCount = 30;
    if (period === '7d') daysCount = 7;
    else if (period === '14d') daysCount = 14;
    else if (period === '90d') daysCount = 90;
    else if (period === '1y') daysCount = 365;

    const periodStart = new Date(todayStart.getTime() - (daysCount - 1) * 24 * 60 * 60 * 1000);
    const periodStartIso = periodStart.toISOString();
    const periodStartStr = toKSTDateString(periodStart);

    // 2. 전체 요약 지표 및 실시간 데이터 병렬 조회
    const [
      totalUsersCountResult,
      totalUrlsCountResult,
      totalCodesCountResult,
      totalGoogleUsersResult,
      totalMemberUrlsResult,
      typeUrlCountResult,
      typeFileCountResult,
      typeTextCountResult,
      todayUsersCountResult,
      todayUrlsCountResult,
      yesterdayUsersCountResult,
      yesterdayUrlsCountResult,
      periodUsersResult,
      periodUrlsResult,
      periodVisitsResult,
      recentUsersResult,
      recentUrlsResult,
      topUrlsResult,
    ] = await Promise.all([
      // 전체 누적 수치
      admin.from('short_users').select('*', { count: 'exact', head: true }),
      admin.from('short_urls').select('*', { count: 'exact', head: true }),
      admin.from('short_user_codes').select('*', { count: 'exact', head: true }),
      admin.from('short_users').select('*', { count: 'exact', head: true }).not('auth_user_id', 'is', null),
      admin.from('short_urls').select('*', { count: 'exact', head: true }).not('user_id', 'is', null),
      admin.from('short_urls').select('*', { count: 'exact', head: true }).eq('type', 'url'),
      admin.from('short_urls').select('*', { count: 'exact', head: true }).eq('type', 'file'),
      admin.from('short_urls').select('*', { count: 'exact', head: true }).eq('type', 'text'),

      // 오늘 신규 수치 (KST 00:00:00 이후)
      admin.from('short_users').select('*', { count: 'exact', head: true }).gte('created_at', todayStartIso),
      admin.from('short_urls').select('*', { count: 'exact', head: true }).gte('created_at', todayStartIso),

      // 어제 신규 수치 (KST 어제 00:00:00 ~ 오늘 00:00:00)
      admin
        .from('short_users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterdayStartIso)
        .lt('created_at', todayStartIso),
      admin
        .from('short_urls')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterdayStartIso)
        .lt('created_at', todayStartIso),

      // 기간 내 일별 추이 집계용 데이터 (병렬 청크 페칭)
      fetchAllInParallel(admin, 'short_users', 'created_at, auth_user_id', 'created_at', periodStartIso),
      fetchAllInParallel(admin, 'short_urls', 'created_at, type, user_id', 'created_at', periodStartIso),
      fetchAllInParallel(admin, 'short_url_visits_daily', 'day, count', 'day', periodStartStr),

      // 최근 가입 사용자 6명
      admin
        .from('short_users')
        .select('id, username, email, created_at, auth_user_id, max_codes')
        .order('created_at', { ascending: false })
        .limit(6),

      // 최근 생성 단축 URL 6건
      admin
        .from('short_urls')
        .select('id, code, original_url, type, visits, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(6),

      // 누적 최다 방문 TOP 6 URL
      admin
        .from('short_urls')
        .select('id, code, original_url, type, visits, created_at, user_id')
        .order('visits', { ascending: false })
        .limit(6),
    ]);

    // 3. 일별 시계열 데이터 매핑 (빠진 날짜 없이 0으로 채움)
    const dateMap = new Map();
    for (let i = 0; i < daysCount; i++) {
      const curDate = new Date(periodStart.getTime() + i * 24 * 60 * 60 * 1000);
      const curStr = toKSTDateString(curDate);
      dateMap.set(curStr, {
        date: curStr,
        label: formatKSTDayLabel(curStr),
        users: 0,
        googleUsers: 0,
        urls: 0,
        memberUrls: 0,
        guestUrls: 0,
        urlTypes: { url: 0, file: 0, text: 0 },
        visits: 0,
      });
    }

    // 신규 가입자 일별 집계
    for (const u of periodUsersResult.rows || []) {
      const day = toKSTDateString(u.created_at);
      const item = dateMap.get(day);
      if (item) {
        item.users += 1;
        if (u.auth_user_id) item.googleUsers += 1;
      }
    }

    // 신규 URL 생성 일별 집계
    for (const link of periodUrlsResult.rows || []) {
      const day = toKSTDateString(link.created_at);
      const item = dateMap.get(day);
      if (item) {
        item.urls += 1;
        if (link.user_id) item.memberUrls += 1;
        else item.guestUrls += 1;

        const t = link.type || 'url';
        if (item.urlTypes[t] !== undefined) {
          item.urlTypes[t] += 1;
        } else {
          item.urlTypes.url += 1;
        }
      }
    }

    // 일별 방문 트래픽 집계
    let periodTotalVisits = 0;
    for (const v of periodVisitsResult.rows || []) {
      const day = v.day;
      const count = Number(v.count) || 0;
      periodTotalVisits += count;
      const item = dateMap.get(day);
      if (item) {
        item.visits += count;
      }
    }

    // 오늘 및 어제 방문수 계산
    const todayItem = dateMap.get(todayStr);
    const yesterdayItem = dateMap.get(yesterdayStr);
    const todayVisits = todayItem ? todayItem.visits : 0;
    const yesterdayVisits = yesterdayItem ? yesterdayItem.visits : 0;

    // 누적치 및 피크일 계산
    let cumulativeUsers = 0;
    let cumulativeUrls = 0;
    let peakUsers = { date: '', count: 0 };
    let peakUrls = { date: '', count: 0 };
    let peakVisits = { date: '', count: 0 };

    const timeSeries = [];
    for (const item of dateMap.values()) {
      cumulativeUsers += item.users;
      cumulativeUrls += item.urls;
      item.cumulativeUsers = cumulativeUsers;
      item.cumulativeUrls = cumulativeUrls;

      if (item.users > peakUsers.count) {
        peakUsers = { date: item.date, label: item.label, count: item.users };
      }
      if (item.urls > peakUrls.count) {
        peakUrls = { date: item.date, label: item.label, count: item.urls };
      }
      if (item.visits > peakVisits.count) {
        peakVisits = { date: item.date, label: item.label, count: item.visits };
      }

      timeSeries.push(item);
    }

    const totalUsers = totalUsersCountResult.count || 0;
    const totalUrls = totalUrlsCountResult.count || 0;
    const totalCodes = totalCodesCountResult.count || 0;
    const totalGoogleUsers = totalGoogleUsersResult.count || 0;
    const totalMemberUrls = totalMemberUrlsResult.count || 0;
    const totalGuestUrls = Math.max(0, totalUrls - totalMemberUrls);

    const periodTotalUsers = periodUsersResult.rows?.length || 0;
    const periodTotalUrls = periodUrlsResult.rows?.length || 0;

    const todayUsers = todayUsersCountResult.count || 0;
    const todayUrls = todayUrlsCountResult.count || 0;
    const yesterdayUsers = yesterdayUsersCountResult.count || 0;
    const yesterdayUrls = yesterdayUrlsCountResult.count || 0;

    return NextResponse.json({
      success: true,
      period,
      daysCount,
      summary: {
        totalUsers,
        totalUrls,
        totalCodes,
        totalGoogleUsers,
        googleUserRatio: totalUsers > 0 ? Math.round((totalGoogleUsers / totalUsers) * 100) : 0,
        totalMemberUrls,
        totalGuestUrls,
        memberUrlRatio: totalUrls > 0 ? Math.round((totalMemberUrls / totalUrls) * 100) : 0,
        urlTypes: {
          url: typeUrlCountResult.count || 0,
          file: typeFileCountResult.count || 0,
          text: typeTextCountResult.count || 0,
        },
        today: {
          date: todayStr,
          users: todayUsers,
          urls: todayUrls,
          visits: todayVisits,
        },
        yesterday: {
          date: yesterdayStr,
          users: yesterdayUsers,
          urls: yesterdayUrls,
          visits: yesterdayVisits,
        },
        period: {
          totalUsers: periodTotalUsers,
          totalUrls: periodTotalUrls,
          totalVisits: periodTotalVisits,
          avgDailyUsers: Number((periodTotalUsers / daysCount).toFixed(1)),
          avgDailyUrls: Number((periodTotalUrls / daysCount).toFixed(1)),
          avgDailyVisits: Number((periodTotalVisits / daysCount).toFixed(1)),
          peakUsers,
          peakUrls,
          peakVisits,
        },
      },
      timeSeries,
      recentUsers: recentUsersResult.data || [],
      recentUrls: recentUrlsResult.data || [],
      topUrls: topUrlsResult.data || [],
    });
  } catch (err) {
    console.error('admin/dashboard error:', err);
    return NextResponse.json(
      { success: false, error: err.message || '대시보드 통계를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
