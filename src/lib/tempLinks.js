/**
 * 임시 단축 주소 (숏.한국/코드) 공용 상수·유틸.
 * 비회원 링크와 같은 네임스페이스(user_id IS NULL)를 쓰며, 회원이 만들면
 * created_by_user_id 로 대시보드에서 관리할 수 있다.
 * 서버/클라이언트 모두에서 import 가능해야 하므로 순수 함수만 둔다.
 */

/** code_id 파라미터에 이 값을 주면 "본인 코드 없이 임시 주소로" 생성/수정 */
export const TEMP_SCOPE = 'temp';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const TEMP_LINK_DURATIONS = Object.freeze({
  '24h': 24 * HOUR_MS,
  '48h': 48 * HOUR_MS,
  '1week': 7 * DAY_MS,
  '1month': 30 * DAY_MS,
});

export const TEMP_LINK_MAX_MS = TEMP_LINK_DURATIONS['1month'];
export const TEMP_LINK_DEFAULT_DURATION = '1week';

export const TEMP_LINK_DURATION_OPTIONS = Object.freeze([
  { value: '24h', label: '24시간' },
  { value: '48h', label: '48시간' },
  { value: '1week', label: '1주일' },
  { value: '1month', label: '1개월 (30일)' },
]);

export function isTempScope(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === TEMP_SCOPE;
}

export function isValidTempDuration(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(TEMP_LINK_DURATIONS, key);
}

/** 기간 키 → ms. 알 수 없는 값은 fallback 사용 */
export function tempLinkDurationMs(key, fallback = TEMP_LINK_DEFAULT_DURATION) {
  if (isValidTempDuration(key)) return TEMP_LINK_DURATIONS[key];
  return TEMP_LINK_DURATIONS[fallback] || TEMP_LINK_DURATIONS[TEMP_LINK_DEFAULT_DURATION];
}

/** 지금부터 key 기간 뒤 ISO */
export function tempLinkExpirationIso(key, fallback = TEMP_LINK_DEFAULT_DURATION, now = Date.now()) {
  return new Date(now + tempLinkDurationMs(key, fallback)).toISOString();
}

/** 임시 링크 만료일 상한(지금 + 30일)으로 잘라낸 ISO */
export function clampTempExpirationIso(iso, now = Date.now()) {
  const max = now + TEMP_LINK_MAX_MS;
  const t = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t) || t > max) return new Date(max).toISOString();
  return new Date(t).toISOString();
}

/**
 * 남은 시간 상태. 'expired' | 'expiring'(48시간 이내) | 'active'
 */
export function tempLinkRetentionStatus(iso, now = Date.now()) {
  if (!iso) return 'active';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'active';
  if (t <= now) return 'expired';
  if (t - now <= 2 * DAY_MS) return 'expiring';
  return 'active';
}

/** "3일 후 만료" / "5시간 후 만료" / "만료됨" (대략 표기) */
export function formatTempRemaining(iso, now = Date.now()) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = t - now;
  if (diff <= 0) return '만료됨';
  const days = Math.floor(diff / DAY_MS);
  if (days >= 1) return `${days}일 후 만료`;
  const hours = Math.floor(diff / HOUR_MS);
  if (hours >= 1) return `${hours}시간 후 만료`;
  const mins = Math.max(1, Math.floor(diff / (60 * 1000)));
  return `${mins}분 후 만료`;
}

/** 만료 일시 (한국어 짧은 표기) */
export function formatTempExpiryDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
