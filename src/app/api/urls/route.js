import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';
import { memberDuplicateCodeMessage } from '@/lib/shortCodeConflictMessage';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function fileRetentionStatus(row, now = Date.now()) {
  if (row.type !== 'file') return null;
  if (!row.expiration_date) return 'active';
  const exp = new Date(row.expiration_date).getTime();
  if (Number.isNaN(exp)) return 'active';
  if (exp <= now || !row.file_path) return 'expired';
  if (exp - now <= TWO_DAYS_MS) return 'expiring';
  return 'active';
}

function escapeIlike(q) {
  return String(q).replace(/[%_\\]/g, '\\$&');
}

// 내 URL 목록 가져오기
export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '10', 10) || 10));
    const q = (searchParams.get('q') || '').trim();
    const type = (searchParams.get('type') || 'all').trim(); // all | url | text | file
    const fileStatus = (searchParams.get('file_status') || 'all').trim(); // all | expiring | expired
    const offset = (page - 1) * perPage;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expiringUntil = new Date(now + TWO_DAYS_MS).toISOString();

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('short_urls')
      .select(
        'id, code, original_url, created_at, expiration_date, visits, last_visit, link_password_hash, type, text_content, file_name, file_size, file_path',
        { count: 'exact' }
      )
      .eq('user_id', user.id);

    if (type === 'url' || type === 'text' || type === 'file') {
      query = query.eq('type', type);
    }

    if (fileStatus === 'expired') {
      query = query.eq('type', 'file').or(`expiration_date.lte.${nowIso},file_path.is.null`);
    } else if (fileStatus === 'expiring') {
      query = query
        .eq('type', 'file')
        .not('file_path', 'is', null)
        .gt('expiration_date', nowIso)
        .lte('expiration_date', expiringUntil);
    }

    if (q) {
      const safe = escapeIlike(q).replace(/[,.()]/g, ' ').trim();
      if (safe) {
        const pattern = `%${safe}%`;
        query = query.or(
          `code.ilike.${pattern},file_name.ilike.${pattern},original_url.ilike.${pattern},text_content.ilike.${pattern}`
        );
      }
    }

    // 만료·임박 파일을 위로: expiration_date asc for files mixed is imperfect in SQL alone.
    // Fetch ordered by created_at desc; client/API will re-sort when file filters not applied.
    // When file_status is set, order by expiration_date ascending.
    if (fileStatus === 'expired' || fileStatus === 'expiring') {
      query = query.order('expiration_date', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: urls, error, count } = await query.range(offset, offset + perPage - 1);

    if (error) throw error;

    let safeUrls = (urls || []).map(({ link_password_hash, text_content, file_path, ...u }) => {
      const retention = fileRetentionStatus({ ...u, file_path }, now);
      return {
        ...u,
        password_enabled: !!link_password_hash,
        type: u.type || 'url',
        text_preview: u.type === 'text' && text_content ? text_content.slice(0, 80) : null,
        file_retention: retention,
        has_file: !!file_path,
      };
    });

    // 기본 목록: 만료·임박 파일을 페이지 내에서 위로
    if (fileStatus === 'all' && type === 'all' && !q) {
      const rank = (r) => {
        if (r.file_retention === 'expired') return 0;
        if (r.file_retention === 'expiring') return 1;
        return 2;
      };
      safeUrls = [...safeUrls].sort((a, b) => {
        const d = rank(a) - rank(b);
        if (d !== 0) return d;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }

    // 최근 7일 방문 (목록 미니 차트용)
    const ids = safeUrls.map((u) => u.id).filter(Boolean);
    let visits7ById = {};
    if (ids.length > 0) {
      const fromDay = new Date(now - 6 * 24 * 60 * 60 * 1000);
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(fromDay);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      const fromDayStr = `${y}-${m}-${d}`;

      const { data: daily } = await supabase
        .from('short_url_visits_daily')
        .select('url_id, day, count')
        .in('url_id', ids)
        .gte('day', fromDayStr);

      visits7ById = {};
      for (const row of daily || []) {
        if (!visits7ById[row.url_id]) visits7ById[row.url_id] = [];
        visits7ById[row.url_id].push({ day: row.day, count: row.count });
      }
    }

    safeUrls = safeUrls.map(({ id, ...rest }) => ({
      ...rest,
      visits_7d: visits7ById[id] || [],
    }));

    return NextResponse.json({
      success: true,
      urls: safeUrls,
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage),
      filters: { q, type, file_status: fileStatus },
    });
  } catch (error) {
    console.error('Get URLs error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}

// 대시보드에서 URL 생성
export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { original_url, custom_code, type = 'url', text_content } = body;
    const code = custom_code?.trim();

    if (!code || (type === 'url' && !original_url) || (type === 'text' && (!text_content || !text_content.trim()))) {
      return NextResponse.json({ success: false, message: '필수 항목을 입력해주세요.' }, { status: 400 });
    }

    if (!/^[가-힣a-zA-Z0-9_\-]+$/.test(code)) {
      return NextResponse.json(
        { success: false, message: '단축 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 중복 확인
    const { data: existing } = await supabase
      .from('short_urls')
      .select('id')
      .eq('code', code)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, message: memberDuplicateCodeMessage() },
        { status: 409 }
      );
    }

    // 100년 만료
    const expirationDate = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();

    const insertData = {
      original_url: type === 'url' ? original_url : '__text__',
      code,
      user_id: user.id,
      expiration_date: expirationDate,
      visits: 0,
      type,
    };
    if (type === 'text') {
      insertData.text_content = text_content;
    }

    const { error } = await supabase.from('short_urls').insert(insertData);

    if (error) {
      console.error('URL create error:', error);
      return NextResponse.json({ success: false, message: 'URL 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'URL이 성공적으로 생성되었습니다.' });
  } catch (error) {
    console.error('Create URL error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}
