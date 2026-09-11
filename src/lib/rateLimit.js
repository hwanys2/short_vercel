const attempts = new Map();

// 10분마다 만료된 레이트 리밋 기록 정리
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of attempts.entries()) {
      if (now > record.resetAt) {
        attempts.delete(key);
      }
    }
  }, 10 * 60 * 1000).unref?.();
}

/**
 * 인메모리 슬라이딩 윈도우 Rate Limiter
 * @param {string} identifier - IP 또는 사용자 고유 키
 * @param {number} limit - 허용 횟수 (예: 5)
 * @param {number} windowSeconds - 윈도우 시간 (초 단위, 예: 60)
 * @returns {{ success: boolean, remaining: number, resetInSeconds: number }}
 */
export function checkRateLimit(identifier, limit = 5, windowSeconds = 60) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const record = attempts.get(identifier);
  if (!record || now > record.resetAt) {
    attempts.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { success: true, remaining: limit - 1, resetInSeconds: windowSeconds };
  }

  if (record.count >= limit) {
    const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { success: false, remaining: 0, resetInSeconds };
  }

  record.count += 1;
  const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);
  return { success: true, remaining: limit - record.count, resetInSeconds };
}
