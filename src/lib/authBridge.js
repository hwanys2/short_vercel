/** 단축 URL 경로와 충돌하는 예약 닉네임 */
export const RESERVED_USERNAMES = new Set([
  'login',
  'register',
  'dashboard',
  'onboarding',
  'auth',
  'api',
  'faq',
  'guide',
  'terms',
  'privacy',
  'contact',
  'blog',
  'api-docs',
  'link-gate',
  'link-preview',
  'text-view',
  'file-view',
  'missing.link',
  'favicon',
  'images',
  'robots.txt',
  'sitemap.xml',
  'ads.txt',
  '_next',
  'admin',
  'www',
  'static',
]);

export const USERNAME_REGEX = /^[가-힣a-zA-Z0-9_\-]+$/;

export function normalizeEmail(email) {
  return String(email || '')
    .toLowerCase()
    .trim();
}

export function normalizeUsernameInput(username) {
  const trimmed = String(username || '').trim();
  try {
    return trimmed.normalize('NFC');
  } catch {
    return trimmed;
  }
}

export function usernamesEqual(a, b) {
  return normalizeUsernameInput(a) === normalizeUsernameInput(b);
}

export function validateUsername(username) {
  const clean = normalizeUsernameInput(username);
  if (!clean) {
    return { ok: false, message: '닉네임을 입력해주세요.' };
  }
  if (clean.length > 50) {
    return { ok: false, message: '닉네임은 50자 이하여야 합니다.' };
  }
  if (!USERNAME_REGEX.test(clean)) {
    return {
      ok: false,
      message: '닉네임은 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있습니다.',
    };
  }
  if (RESERVED_USERNAMES.has(clean.toLowerCase())) {
    return { ok: false, message: '사용할 수 없는 닉네임입니다.' };
  }
  return { ok: true, username: clean };
}

/**
 * auth.users 에서 이메일로 사용자 조회.
 * admin.generateLink({ type: 'recovery' })는 기존 사용자만 반환(미존재 시 에러, 메일 미발송).
 */
export async function findAuthUserByEmail(admin, email) {
  const clean = normalizeEmail(email);
  if (!clean) return null;

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: clean,
  });

  if (error || !data?.user) {
    return null;
  }
  return data.user;
}

/**
 * 레거시 short_users 를 Auth 계정에 연결 (auth_user_id 가 비어 있을 때만).
 */
export async function linkShortUserToAuth(adminDb, shortUserId, authUserId) {
  const { data, error } = await adminDb
    .from('short_users')
    .update({
      auth_user_id: authUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shortUserId)
    .is('auth_user_id', null)
    .select('id, username, email, auth_user_id, token_version')
    .maybeSingle();

  if (error) throw error;
  return data;
}
