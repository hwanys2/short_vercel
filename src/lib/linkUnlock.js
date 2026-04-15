import jwt from 'jsonwebtoken';

export const LINK_UNLOCK_COOKIE = 'short_link_unlock';

const UNLOCK_TYP = 'link_unlock';

function getUnlockSecret() {
  return process.env.LINK_UNLOCK_SECRET || process.env.JWT_SECRET || 'dev-secret-change-this';
}

/** @param {{ username: string, code: string, version: number }} payload */
export function signLinkUnlockToken({ username, code, version }) {
  return jwt.sign(
    { typ: UNLOCK_TYP, u: username, c: code, v: version },
    getUnlockSecret(),
    { expiresIn: '7d' }
  );
}

/**
 * @param {string | undefined} token
 * @returns {{ username: string, code: string, version: number } | null}
 */
export function decodeLinkUnlockToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, getUnlockSecret());
    if (decoded?.typ !== UNLOCK_TYP) return null;
    const u = typeof decoded.u === 'string' ? decoded.u : '';
    const c = typeof decoded.c === 'string' ? decoded.c : '';
    const v = Number(decoded.v);
    if (!u || !c || !Number.isFinite(v)) return null;
    return { username: u, code: c, version: v };
  } catch {
    return null;
  }
}

/**
 * @param {import('next/server').NextRequest} request
 * @param {string} username
 * @param {string} code
 * @param {number} expectedVersion
 */
export function isValidLinkUnlockCookie(request, username, code, expectedVersion) {
  const token = request.cookies.get(LINK_UNLOCK_COOKIE)?.value;
  const payload = decodeLinkUnlockToken(token);
  if (!payload) return false;
  return (
    payload.username === username &&
    payload.code === code &&
    payload.version === Number(expectedVersion)
  );
}

/** @param {import('next/server').NextResponse} response */
export function setLinkUnlockCookieOnResponse(response, { username, code, version }) {
  const token = signLinkUnlockToken({ username, code, version });
  response.cookies.set(LINK_UNLOCK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}
