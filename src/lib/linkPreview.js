import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeShortPathSegment } from '@/lib/pathSegments';
import { formatFileSize } from '@/lib/shortFilesShared';
import { buildShortUrl, getSiteOrigin } from '@/lib/siteUrl';

function truncate(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function daysLeftLabel(expirationDate) {
  if (!expirationDate) return '';
  const end = new Date(expirationDate).getTime();
  if (Number.isNaN(end)) return '';
  const ms = end - Date.now();
  if (ms <= 0) return '다운로드 만료';
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 1) return '오늘까지 다운로드 가능';
  return `약 ${days}일 남음`;
}

/**
 * Load short URL row for OG preview (no visit increment).
 * @returns {Promise<null | {
 *   found: boolean;
 *   passwordProtected: boolean;
 *   type: string;
 *   code: string;
 *   username: string | null;
 *   title: string;
 *   description: string;
 *   shortUrl: string;
 *   ogImagePath: string;
 * }>}
 */
export async function loadLinkPreviewData({ code, username }) {
  if (!code) return null;

  const supabase = getSupabaseAdmin();
  const normalizedCode = normalizeShortPathSegment(code);
  let unlockUsername = null;
  let urlData = null;

  if (username) {
    const normalizedUsername = normalizeShortPathSegment(username);
    const { data: user } = await supabase
      .from('short_users')
      .select('id, username')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (!user) {
      return {
        found: false,
        passwordProtected: false,
        type: 'missing',
        code: normalizedCode,
        username: normalizedUsername,
        title: '링크를 찾을 수 없습니다 | 숏.한국',
        description: '요청하신 단축 주소가 없거나 만료되었습니다.',
        shortUrl: buildShortUrl({ code: normalizedCode, username: normalizedUsername }),
        ogImagePath: `/api/og?code=${encodeURIComponent(normalizedCode)}&username=${encodeURIComponent(normalizedUsername)}&kind=missing`,
      };
    }

    const { data } = await supabase
      .from('short_urls')
      .select(
        'type, code, original_url, text_content, file_name, file_size, file_path, expiration_date, link_password_hash'
      )
      .eq('code', normalizedCode)
      .eq('user_id', user.id)
      .maybeSingle();

    urlData = data;
    unlockUsername = user.username;
  } else {
    const { data } = await supabase
      .from('short_urls')
      .select(
        'type, code, original_url, text_content, file_name, file_size, file_path, expiration_date, link_password_hash'
      )
      .eq('code', normalizedCode)
      .is('user_id', null)
      .gt('expiration_date', new Date().toISOString())
      .maybeSingle();

    urlData = data;
    unlockUsername = null;
  }

  const shortUrl = buildShortUrl({
    code: normalizedCode,
    username: unlockUsername || undefined,
  });
  const ogBase = `/api/og?code=${encodeURIComponent(normalizedCode)}${
    unlockUsername ? `&username=${encodeURIComponent(unlockUsername)}` : ''
  }`;

  if (!urlData) {
    return {
      found: false,
      passwordProtected: false,
      type: 'missing',
      code: normalizedCode,
      username: unlockUsername,
      title: '링크를 찾을 수 없습니다 | 숏.한국',
      description: '요청하신 단축 주소가 없거나 만료되었습니다.',
      shortUrl,
      ogImagePath: `${ogBase}&kind=missing`,
    };
  }

  const passwordProtected =
    urlData.link_password_hash != null && String(urlData.link_password_hash).length > 0;

  if (passwordProtected) {
    return {
      found: true,
      passwordProtected: true,
      type: urlData.type || 'url',
      code: normalizedCode,
      username: unlockUsername,
      title: '비밀번호로 보호된 링크 | 숏.한국',
      description: '비밀번호를 입력해야 열 수 있는 단축 주소입니다.',
      shortUrl,
      ogImagePath: `${ogBase}&kind=locked`,
    };
  }

  const type = urlData.type || 'url';

  if (type === 'text') {
    const preview = truncate(urlData.text_content, 160);
    return {
      found: true,
      passwordProtected: false,
      type: 'text',
      code: normalizedCode,
      username: unlockUsername,
      title: `${normalizedCode} · 텍스트 | 숏.한국`,
      description: preview || '숏.한국으로 공유된 텍스트입니다.',
      shortUrl,
      ogImagePath: `${ogBase}&kind=text`,
    };
  }

  if (type === 'file') {
    const name = urlData.file_name || '파일';
    const size = formatFileSize(urlData.file_size);
    const left = daysLeftLabel(urlData.expiration_date);
    const expired =
      !urlData.file_path ||
      (urlData.expiration_date && new Date(urlData.expiration_date) <= new Date());
    const description = expired
      ? `${name} · ${size} · 다운로드 만료`
      : [name, size, left].filter(Boolean).join(' · ');
    return {
      found: true,
      passwordProtected: false,
      type: 'file',
      code: normalizedCode,
      username: unlockUsername,
      title: `${name} | 숏.한국`,
      description: description || '숏.한국으로 공유된 파일입니다.',
      shortUrl,
      ogImagePath: `${ogBase}&kind=file`,
    };
  }

  const host = hostFromUrl(urlData.original_url);
  return {
    found: true,
    passwordProtected: false,
    type: 'url',
    code: normalizedCode,
    username: unlockUsername,
    title: `${normalizedCode} | 숏.한국`,
    description: host
      ? `${host}(으)로 이동하는 단축 주소입니다.`
      : '숏.한국 단축 주소입니다.',
    shortUrl,
    ogImagePath: `${ogBase}&kind=url`,
  };
}

export function absoluteOgImageUrl(ogImagePath) {
  const origin = getSiteOrigin();
  if (!ogImagePath) return undefined;
  if (ogImagePath.startsWith('http')) return ogImagePath;
  return `${origin}${ogImagePath.startsWith('/') ? '' : '/'}${ogImagePath}`;
}
