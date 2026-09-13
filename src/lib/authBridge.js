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
  'profile',
  'unsubscribe',
  'www',
  'static',
]);

export const USERNAME_REGEX = /^[가-힣a-zA-Z0-9_\-]+$/;

export function normalizeEmail(email) {
  return String(email || '')
    .toLowerCase()
    .trim();
}

/**
 * 이메일 주소의 유효성을 엄격하게 검증합니다.
 * - 형식에 맞지 않는 이메일(도메인에 점 누락, 허용되지 않는 문자, TLD 누락/숫자 TLD 등)을 배제합니다.
 * - 예: qwertyuiop111@1111, nakivabg@jhxjkdwjkdwed, sh.lee557@genedu, dfa@1, b@01086821625, 5406@5406, nnnn@jj 등 무효 처리
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254 || trimmed.length < 5) return false;
  if (/\s/.test(trimmed)) return false;

  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return false;

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (local.includes('@')) return false;
  if (local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~가-힣-]+$/.test(local)) return false;

  if (!domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;

  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;

  for (const part of domainParts) {
    if (!part || part.length > 63) return false;
    if (part.startsWith('-') || part.endsWith('-')) return false;
    if (!/^[a-zA-Z0-9가-힣-]+$/.test(part)) return false;
  }

  const tld = domainParts[domainParts.length - 1];
  if (!/^(xn--[a-zA-Z0-9]+|[a-zA-Z]{2,}|[가-힣]{1,})$/.test(tld)) {
    return false;
  }

  return true;
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
