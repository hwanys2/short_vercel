export const THEME_STORAGE_KEY = 'short-theme-preference';

export const THEME_PREFERENCES = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
});

export function isValidThemePreference(value) {
  return value === THEME_PREFERENCES.LIGHT
    || value === THEME_PREFERENCES.DARK
    || value === THEME_PREFERENCES.SYSTEM;
}

export function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return THEME_PREFERENCES.DARK;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? THEME_PREFERENCES.DARK
    : THEME_PREFERENCES.LIGHT;
}

export function getStoredThemePreference() {
  if (typeof window === 'undefined') {
    return THEME_PREFERENCES.SYSTEM;
  }

  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidThemePreference(saved) ? saved : THEME_PREFERENCES.SYSTEM;
  } catch {
    return THEME_PREFERENCES.SYSTEM;
  }
}

export function setStoredThemePreference(preference) {
  if (typeof window === 'undefined' || !isValidThemePreference(preference)) {
    return;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore storage failures (private mode, blocked storage, etc.)
  }
}

export function resolveTheme(preference) {
  if (preference === THEME_PREFERENCES.LIGHT || preference === THEME_PREFERENCES.DARK) {
    return preference;
  }
  return getSystemTheme();
}

export function applyResolvedTheme(theme) {
  if (typeof document === 'undefined') {
    return;
  }
  const resolved = theme === THEME_PREFERENCES.LIGHT ? THEME_PREFERENCES.LIGHT : THEME_PREFERENCES.DARK;
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
}

export function getThemeInitScript() {
  return `
    (function () {
      try {
        var storageKey = '${THEME_STORAGE_KEY}';
        var rawPreference = localStorage.getItem(storageKey);
        var preference = (rawPreference === 'light' || rawPreference === 'dark' || rawPreference === 'system')
          ? rawPreference
          : 'system';
        var media = window.matchMedia('(prefers-color-scheme: dark)');
        var resolved = preference === 'system'
          ? (media.matches ? 'dark' : 'light')
          : preference;
        document.documentElement.setAttribute('data-theme', resolved);
        document.documentElement.style.colorScheme = resolved;
      } catch (error) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.style.colorScheme = 'dark';
      }
    })();
  `;
}
