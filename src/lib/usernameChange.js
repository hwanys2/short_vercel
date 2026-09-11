import { formatKoreanDurationUntil } from '@/lib/shortCodeConflictMessage';

export const USERNAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;
export const USERNAME_CHANGE_CONFIRM_PHRASE = '주소변경';

/**
 * @param {string | null | undefined} usernameChangedAt
 * @param {number} [now]
 */
export function getUsernameChangeCooldown(usernameChangedAt, now = Date.now()) {
  if (!usernameChangedAt) {
    return {
      canChange: true,
      lastChangedAt: null,
      nextChangeAt: null,
      remainingMs: 0,
      remainingLabel: null,
    };
  }

  const last = new Date(usernameChangedAt).getTime();
  if (!Number.isFinite(last)) {
    return {
      canChange: true,
      lastChangedAt: null,
      nextChangeAt: null,
      remainingMs: 0,
      remainingLabel: null,
    };
  }

  const next = last + USERNAME_CHANGE_COOLDOWN_MS;
  const remaining = next - now;
  if (remaining <= 0) {
    return {
      canChange: true,
      lastChangedAt: new Date(last).toISOString(),
      nextChangeAt: null,
      remainingMs: 0,
      remainingLabel: null,
    };
  }

  return {
    canChange: false,
    lastChangedAt: new Date(last).toISOString(),
    nextChangeAt: new Date(next).toISOString(),
    remainingMs: remaining,
    remainingLabel: formatKoreanDurationUntil(remaining),
  };
}

export function serializeUsernameChangeCooldown(usernameChangedAt, now = Date.now()) {
  const cooldown = getUsernameChangeCooldown(usernameChangedAt, now);
  return {
    can_change: cooldown.canChange,
    last_changed_at: cooldown.lastChangedAt,
    next_change_at: cooldown.nextChangeAt,
    remaining_ms: cooldown.remainingMs,
    remaining_label: cooldown.remainingLabel,
    cooldown_days: USERNAME_CHANGE_COOLDOWN_DAYS,
    confirm_phrase: USERNAME_CHANGE_CONFIRM_PHRASE,
  };
}
