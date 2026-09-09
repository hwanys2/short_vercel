import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

function decodeCodeParam(code) {
  try {
    return decodeURIComponent(code);
  } catch {
    return code;
  }
}

function kstDateString(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

function addDaysKst(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const dt = new Date(utc);
  // format as KST calendar via fixed +9 offset from that UTC midnight of the calendar day
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dt);
  const yy = parts.find((p) => p.type === 'year')?.value;
  const mm = parts.find((p) => p.type === 'month')?.value;
  const dd = parts.find((p) => p.type === 'day')?.value;
  return `${yy}-${mm}-${dd}`;
}

export async function GET(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { code: rawCode } = await params;
    const code = decodeCodeParam(rawCode);
    const { searchParams } = new URL(request.url);
    const daysRaw = parseInt(searchParams.get('days') || '30', 10);
    const days = [7, 30].includes(daysRaw) ? daysRaw : 30;

    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from('short_urls')
      .select('id, code, visits')
      .eq('code', code)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return NextResponse.json({ success: false, message: 'URL을 찾을 수 없습니다.' }, { status: 404 });
    }

    const today = kstDateString();
    const fromDay = addDaysKst(today, -(days - 1));

    const { data: dailyRows, error: dailyErr } = await supabase
      .from('short_url_visits_daily')
      .select('day, count')
      .eq('url_id', row.id)
      .gte('day', fromDay)
      .lte('day', today)
      .order('day', { ascending: true });

    if (dailyErr) throw dailyErr;

    const byDay = new Map((dailyRows || []).map((r) => [r.day, r.count]));
    const series = [];
    for (let i = 0; i < days; i++) {
      const day = addDaysKst(fromDay, i);
      series.push({ day, count: byDay.get(day) || 0 });
    }

    return NextResponse.json({
      success: true,
      code: row.code,
      visits_total: row.visits || 0,
      days,
      series,
    });
  } catch (error) {
    console.error('Get visit series error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}
