import { useEffect, useState } from 'react';
import type { UserPreferences } from '../core/types';

/** Current time, refreshed every `ms` (default 30 s) and whenever the tab becomes visible. */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ms]);
  return now;
}

export function isSafeMode(prefs: UserPreferences | undefined, now: Date = new Date()): boolean {
  return !!prefs?.safeModeUntil && new Date(prefs.safeModeUntil) > now;
}

function systemDark() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Apply theme, text scale, motion and safe-mode attributes to <html>. */
export function useApplyAppearance(prefs: UserPreferences | undefined, safe: boolean) {
  const [sysDark, setSysDark] = useState(systemDark);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSysDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    const theme = prefs?.theme ?? 'system';
    // Safe mode shifts to maximum contrast with muted tones (blueprint §2.4).
    const resolved = safe && theme !== 'contrast' ? (sysDark || theme === 'dark' ? 'dark' : 'light') : theme === 'system' ? (sysDark ? 'dark' : 'light') : theme;
    el.dataset.theme = resolved;
    el.dataset.safe = String(safe);
    el.dataset.motion = prefs?.reducedMotion ? 'reduce' : 'auto';
    el.style.setProperty('--text-scale', String(prefs?.textScale ?? 1));
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', resolved === 'light' ? '#f6f4ef' : '#0f1418');
  }, [prefs?.theme, prefs?.reducedMotion, prefs?.textScale, safe, sysDark]);
}
