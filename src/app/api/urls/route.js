import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAppUser } from '@/lib/session';
import { guestDuplicateCodeMessage, memberDuplicateCodeMessage } from '@/lib/shortCodeConflictMessage';
import { buildShortUrl } from '@/lib/siteUrl';
import { deleteShortUrlWithFile } from '@/lib/shortFiles';
import { resolveLinkScope, parseCodeIdFilter, TEMP_SCOPE } from '@/lib/userCodes';
import { tempLinkExpirationIso, tempLinkRetentionStatus } from '@/lib/tempLinks';

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

function codeUsernameMap(user) {
  const map = new Map();
  for (const c of user.codes || []) {
    map.set(Number(c.id), c.username);
  }
  return map;
}

// 내 URL 목록 가져오기
export async function GET(request) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '10', 10) || 10));
    const q = (searchParams.get('q') || '').trim();
    const type = (searchParams.get('type') || 'all').trim(); // all | url | text | file
    const fileStatus = (searchParams.get('file_status') || 'all').trim(); // all | expiring | expired
    const codeFilter = parseCodeIdFilter(searchParams.get('code_id'));
    if (codeFilter === null) {
      return NextResponse.json({ success: false, message: '유효하지 않은 본인 코드 필터입니다.' }, { status: 400 });
    }
    const offset = (page - 1) * perPage;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expiringUntil = new Date(now + TWO_DAYS_MS).toISOString();
    const usernameByCodeId = codeUsernameMap(user);

    const supabase = getSupabaseAdmin();

    // created_by_user_id: 본인 코드 링크(user_id=나) + 임시 주소(user_id NULL, 내가 생성) 모두 포함
    let query = supabase
      .from('short_urls')
      .select(
        'id, code, original_url, created_at, expiration_date, visits, last_visit, link_password_hash, type, text_content, file_name, file_size, file_path, user_id, user_code_id',
        { count: 'exact' }
      )
      .eq('created_by_user_id', user.id);

    if (codeFilter === TEMP_SCOPE) {
      query = query.is('user_code_id', null);
    } else if (codeFilter !== 'all') {
      const owned = (user.codes || []).some((c) => Number(c.id) === codeFilter);
      if (!owned) {
        return NextResponse.json({ success: false, message: '본인 코드를 찾을 수 없습니다.' }, { status: 400 });
      }
      query = query.eq('user_code_id', codeFilter);
    }

    if (type === 'url' || type === 'text' || type === 'file' || type === 'html') {
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

    if (fileStatus === 'expired' || fileStatus === 'expiring') {
      query = query.order('expiration_date', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: urls, error, count } = await query.range(offset, offset + perPage - 1);

    if (error) throw error;

    let safeUrls = (urls || []).map(({ link_password_hash, text_content, file_path, user_id, ...u }) => {
      const retention = fileRetentionStatus({ ...u, file_path }, now);
      const codeId = u.user_code_id != null ? Number(u.user_code_id) : null;
      const isTemp = user_id == null;
      return {
        ...u,
        user_code_id: codeId,
        is_temp: isTemp,
        code_username: isTemp
          ? null
          : codeId != null
            ? usernameByCodeId.get(codeId) || user.username
            : user.username,
        password_enabled: !!link_password_hash,
        type: u.type || 'url',
        text_preview: u.type === 'text' && text_content ? text_content.slice(0, 80) : null,
        file_retention: retention,
        // 임시 주소는 링크 자체가 만료됨 (만료 후 자동 삭제)
        link_retention: isTemp ? tempLinkRetentionStatus(u.expiration_date, now) : null,
        has_file: !!file_path,
      };
    });

    if (fileStatus === 'all' && type === 'all' && !q) {
      const rank = (r) => {
        if (r.file_retention === 'expired' || r.link_retention === 'expired') return 0;
        if (r.file_retention === 'expiring' || r.link_retention === 'expiring') return 1;
        return 2;
      };
      safeUrls = [...safeUrls].sort((a, b) => {
        const d = rank(a) - rank(b);
        if (d !== 0) return d;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }

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
      filters: { q, type, file_status: fileStatus, code_id: codeFilter === 'all' ? 'all' : codeFilter },
    });
  } catch (error) {
    console.error('Get URLs error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}

// 대시보드에서 URL 생성
export async function POST(request) {
  try {
    const user = await requireAppUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { original_url, custom_code, type = 'url', text_content, code_id, expire_duration } = body;
    const code = custom_code?.trim();

    if (type !== 'url' && type !== 'text') {
      return NextResponse.json({ success: false, message: '유효하지 않은 타입입니다.' }, { status: 400 });
    }

    if (!code || (type === 'url' && !original_url) || (type === 'text' && (!text_content || !text_content.trim()))) {
      return NextResponse.json({ success: false, message: '필수 항목을 입력해주세요.' }, { status: 400 });
    }

    if (!/^[가-힣a-zA-Z0-9_\-]+$/.test(code)) {
      return NextResponse.json(
        { success: false, message: '단축 코드는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.' },
        { status: 400 }
      );
    }

    const scope = resolveLinkScope(user, code_id);
    if (!scope.ok) {
      return NextResponse.json({ success: false, message: scope.message }, { status: scope.status });
    }
    const isTemp = scope.temp;
    const ownerCode = scope.code;

    const supabase = getSupabaseAdmin();

    let dupQuery = supabase
      .from('short_urls')
      .select('id, expiration_date, user_id, type, file_path')
      .eq('code', code);
    dupQuery = isTemp ? dupQuery.is('user_id', null) : dupQuery.eq('user_code_id', ownerCode.id);
    const { data: existing } = await dupQuery.maybeSingle();

    if (existing) {
      const isExpired = existing.expiration_date && new Date(existing.expiration_date) < new Date();
      if (!isTemp || !isExpired) {
        return NextResponse.json(
          {
            success: false,
            message: isTemp ? guestDuplicateCodeMessage(existing.expiration_date) : memberDuplicateCodeMessage(),
            expiration_date: existing.expiration_date ?? null,
          },
          { status: 409 }
        );
      }
      // 만료된 임시/비회원 코드는 정리 후 재사용
      await deleteShortUrlWithFile(existing);
    }

    const expirationDate = isTemp
      ? tempLinkExpirationIso(expire_duration, '1week')
      : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();

    const insertData = {
      original_url: type === 'url' ? original_url : '__text__',
      code,
      created_by_user_id: user.id,
      expiration_date: expirationDate,
      visits: 0,
      type,
    };
    if (!isTemp) {
      insertData.user_id = user.id;
      insertData.user_code_id = ownerCode.id;
    }
    if (type === 'text') {
      insertData.text_content = text_content;
    }

    const { error } = await supabase.from('short_urls').insert(insertData);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, message: isTemp ? guestDuplicateCodeMessage(null) : memberDuplicateCodeMessage() },
          { status: 409 }
        );
      }
      console.error('URL create error:', error);
      return NextResponse.json({ success: false, message: 'URL 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const shortUrl = buildShortUrl({ code, username: isTemp ? undefined : ownerCode.username });

    return NextResponse.json({
      success: true,
      message: isTemp ? '임시 단축 주소가 생성되었습니다.' : 'URL이 성공적으로 생성되었습니다.',
      data: {
        short_url: shortUrl,
        code,
        type,
        expiration_date: expirationDate,
        username: isTemp ? null : ownerCode.username,
        user_code_id: isTemp ? null : ownerCode.id,
        is_temp: isTemp,
        managed: true,
      },
    });
  } catch (error) {
    console.error('Create URL error:', error);
    return NextResponse.json({ success: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}
