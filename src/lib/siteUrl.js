function normalizeBaseWithSlash(baseUrl) {
  const raw = (baseUrl || 'https://숏.한국/').trim();
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** Share/copy short URL with trailing slash (helps mobile browsers treat it as a path). */
export function buildShortUrl({ baseUrl, code, username } = {}) {
  const root = normalizeBaseWithSlash(
    baseUrl ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'https://숏.한국/'
  );
  const path = username ? `${username}/${code}` : code;
  return `${root}${path}/`;
}

/** Canonical host for metadata, sitemap, robots (no trailing slash). */
export function getSiteOrigin() {
  const raw = (process.env.NEXT_PUBLIC_BASE_URL || 'https://숏.한국/').trim();
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return 'https://숏.한국';
  }
}

export function getMetadataBase() {
  return new URL(`${getSiteOrigin()}/`);
}
