/**
 * Path/query segments may arrive percent-encoded on the edge; DB stores decoded Unicode.
 */
export function safeDecodeURIComponent(segment) {
  if (segment == null || segment === '') return segment;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function normalizeShortPathSegment(segment) {
  const decoded = safeDecodeURIComponent(segment);
  try {
    return decoded.normalize('NFC');
  } catch {
    return decoded;
  }
}

/** 미들웨어 rewrite 시 Next가 쿼리를 넘기지 않는 경우 x-middleware-request-* 헤더로 전달됨 */
export function readMiddlewareShortHeader(request, headerKey) {
  const raw =
    request.headers.get(`x-middleware-request-${headerKey}`) ||
    request.headers.get(headerKey);
  if (raw == null || raw === '') return null;
  return normalizeShortPathSegment(raw);
}
