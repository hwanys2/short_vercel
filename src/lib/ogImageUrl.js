/** Supabase Storage folder for OG images (matches short_* naming). */
const OG_PREFIX = 'short_og';

function trimEnv(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function objectPathForFilename(filename) {
  const name = trimEnv(filename).replace(/^\/+/, '');
  if (name.startsWith(`${OG_PREFIX}/`)) return name;
  return `${OG_PREFIX}/${name}`;
}

/**
 * Public Storage object URL under the `short_og/` folder.
 * @param {string} filename e.g. `default.png` → `short_og/default.png`
 */
export function getOgImageUrl(filename) {
  const supabaseUrl = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const bucket = trimEnv(process.env.NEXT_PUBLIC_OG_STORAGE_BUCKET) || 'short_site';
  if (!supabaseUrl) return undefined;
  const base = supabaseUrl.replace(/\/$/, '');
  const objectPath = objectPathForFilename(filename);
  return `${base}/storage/v1/object/public/${bucket}/${objectPath}`;
}

/** Full URL override, or Supabase `short_site` bucket `short_og/default.png`. */
export function getDefaultOgImageUrl() {
  const override = trimEnv(process.env.NEXT_PUBLIC_OG_IMAGE_URL);
  if (override) return override;
  return getOgImageUrl('default.png');
}
