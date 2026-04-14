/**
 * Returns an ISO 8601 UTC string for the start of the calendar day in Asia/Seoul
 * (KST, fixed UTC+9) for the instant `now`.
 */
export function getSeoulStartOfTodayISO(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !d) {
    throw new Error('Could not resolve Seoul calendar date');
  }
  return new Date(`${y}-${m}-${d}T00:00:00+09:00`).toISOString();
}
