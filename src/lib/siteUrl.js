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
