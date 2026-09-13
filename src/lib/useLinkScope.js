'use client';
import { useCallback, useMemo, useState } from 'react';
import { TEMP_SCOPE } from '@/lib/tempLinks';

const storageKey = (userId) => `short_create_code_id_${userId}`;

function readSavedScope(userId) {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

/**
 * 로그인 사용자의 "어디에 만들까" 선택 상태.
 * scope: number(본인 코드 id) | 'temp'(임시 주소) | null(비로그인/로딩)
 * 마지막 선택은 localStorage 에 기억한다 (홈·대시보드 공용 키).
 */
export function useLinkScope(user) {
  // 이 세션에서 사용자가 직접 고른 값 (계정이 바뀌면 무시)
  const [override, setOverride] = useState(null); // { userId, scope } | null

  const codes = useMemo(() => user?.codes || [], [user]);

  const scope = useMemo(() => {
    if (!user?.id) return null;
    if (override && override.userId === user.id) return override.scope;

    const primaryId =
      user.primary_code_id || codes.find((c) => c.is_primary)?.id || codes[0]?.id || null;
    const saved = readSavedScope(user.id);
    if (saved === TEMP_SCOPE) return TEMP_SCOPE;
    if (saved != null && saved !== '') {
      const n = Number(saved);
      if (codes.some((c) => Number(c.id) === n)) return n;
    }
    return primaryId;
  }, [user, codes, override]);

  const isTemp = scope === TEMP_SCOPE;

  const activeCode = useMemo(() => {
    if (isTemp) return null;
    return (
      codes.find((c) => Number(c.id) === Number(scope)) ||
      codes.find((c) => c.is_primary) ||
      codes[0] ||
      null
    );
  }, [codes, scope, isTemp]);

  const setScope = useCallback(
    (value) => {
      const next = value === TEMP_SCOPE ? TEMP_SCOPE : Number(value);
      if (!user?.id) return;
      setOverride({ userId: user.id, scope: next });
      try {
        localStorage.setItem(storageKey(user.id), String(next));
      } catch {}
    },
    [user]
  );

  return {
    scope,
    isTemp,
    codes,
    activeCode,
    activeUsername: activeCode?.username || user?.username || '',
    setScope,
    /** <select value> 용 문자열 */
    selectValue: scope == null ? '' : String(scope),
  };
}

/** <select onChange> 값 → scope 값 */
export function parseScopeSelectValue(raw) {
  return raw === TEMP_SCOPE ? TEMP_SCOPE : Number(raw);
}
