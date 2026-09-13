import { normalizeShortPathSegment } from '@/lib/pathSegments';
import { normalizeUsernameInput } from '@/lib/authBridge';

/** 표시용 기본 한도. 실제 한도는 short_users.max_codes */
export const MAX_CODES_DEFAULT = 2;

/**
 * @typedef {{ id: number, username: string, is_primary: boolean, username_changed_at?: string|null, created_at?: string|null }} UserCode
 */

/**
 * short_user_codes 행들을 primary 우선으로 정렬.
 * @param {UserCode[]|null|undefined} rows
 * @returns {UserCode[]}
 */
export function sortUserCodes(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return Number(a.id) - Number(b.id);
  });
  return list.map((c) => ({
    id: Number(c.id),
    username: c.username,
    is_primary: Boolean(c.is_primary),
    username_changed_at: c.username_changed_at ?? null,
    created_at: c.created_at ?? null,
  }));
}

/**
 * @param {UserCode[]} codes
 * @returns {UserCode|null}
 */
export function getPrimaryCode(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return null;
  return codes.find((c) => c.is_primary) || codes[0] || null;
}

/**
 * 요청의 code_id가 내 코드인지 검증. 없으면 primary 반환.
 * @param {{ codes?: UserCode[], id?: number }} user
 * @param {string|number|null|undefined} codeIdParam
 * @returns {{ ok: true, code: UserCode } | { ok: false, message: string, status: number }}
 */
export function pickUserCode(user, codeIdParam) {
  const codes = sortUserCodes(user?.codes);
  if (codes.length === 0) {
    return { ok: false, message: '본인 코드를 찾을 수 없습니다.', status: 400 };
  }

  if (codeIdParam === undefined || codeIdParam === null || codeIdParam === '' || codeIdParam === 'all') {
    const primary = getPrimaryCode(codes);
    if (!primary) {
      return { ok: false, message: '본인 코드를 찾을 수 없습니다.', status: 400 };
    }
    return { ok: true, code: primary };
  }

  const id = Number(codeIdParam);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, message: '유효하지 않은 본인 코드입니다.', status: 400 };
  }

  const found = codes.find((c) => Number(c.id) === id);
  if (!found) {
    return { ok: false, message: '본인 코드를 찾을 수 없습니다.', status: 400 };
  }
  return { ok: true, code: found };
}

/**
 * URL path username → owner code 조회.
 * @returns {Promise<null | { userId: number, codeId: number, username: string, isPrimary: boolean }>}
 */
export async function resolveOwnerCode(admin, username) {
  if (!username) return null;
  const normalized = normalizeShortPathSegment(username);
  if (!normalized) return null;

  const { data, error } = await admin
    .from('short_user_codes')
    .select('id, user_id, username, is_primary')
    .eq('username', normalized)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    userId: Number(data.user_id),
    codeId: Number(data.id),
    username: data.username,
    isPrimary: Boolean(data.is_primary),
  };
}

/**
 * 회원 단축 URL 조회: username + slug → row.
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{ username: string, code: string, select?: string }} opts
 */
export async function findMemberUrl(admin, { username, code, select }) {
  const owner = await resolveOwnerCode(admin, username);
  if (!owner) return { owner: null, urlData: null };

  const normalizedCode = normalizeShortPathSegment(code);
  const cols =
    select ||
    'id, original_url, code, type, text_content, file_name, file_size, file_mime, file_path, link_password_hash, link_password_unlock_version, expiration_date, created_at, user_id, user_code_id';

  const { data, error } = await admin
    .from('short_urls')
    .select(cols)
    .eq('code', normalizedCode)
    .eq('user_code_id', owner.codeId)
    .maybeSingle();

  if (error) throw error;
  return { owner, urlData: data };
}

/**
 * short_user_codes에서 username 사용 여부 (전역).
 * @param {number|null} [excludeUserId] 같은 계정의 현재 코드는 제외할 때
 * @param {number|null} [excludeCodeId]
 */
export async function isUsernameTaken(admin, username, { excludeUserId = null, excludeCodeId = null } = {}) {
  const clean = normalizeUsernameInput(username);
  let query = admin.from('short_user_codes').select('id, user_id').eq('username', clean);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return false;
  if (excludeCodeId != null && Number(data.id) === Number(excludeCodeId)) return false;
  if (excludeUserId != null && Number(data.user_id) === Number(excludeUserId) && excludeCodeId == null) {
    // 같은 유저의 다른 코드가 이미 쓰는 경우도 taken
    return Number(data.id) !== Number(excludeCodeId);
  }
  return true;
}

/**
 * 사용자 코드 목록 로드.
 * @returns {Promise<UserCode[]>}
 */
export async function loadUserCodes(admin, userId) {
  const { data, error } = await admin
    .from('short_user_codes')
    .select('id, username, is_primary, username_changed_at, created_at')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('id', { ascending: true });

  if (error) throw error;
  return sortUserCodes(data);
}

/**
 * code_id 쿼리 파라미터 파싱 (목록 필터용). 'all' | number | null(기본=all)
 */
export function parseCodeIdFilter(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === 'all') return 'all';
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}
