'use client';

import { useEffect } from 'react';

const BUILD = process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'dev';
const ATTEMPT_KEY = 'equity-lens:reloaded-for';

/**
 * Reloads onto a new deployment.
 *
 * A home-screen app has no reload button and resumes where it was left, so
 * after an update it keeps running the old code indefinitely. Whenever the
 * app comes back to the foreground (and every few minutes while open) this
 * asks the server which build is live and reloads if it differs.
 */
export function VersionWatcher() {
  useEffect(() => {
    if (BUILD === 'dev') return;

    let checking = false;
    async function check() {
      if (checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        const { version } = (await res.json()) as { version?: string };
        if (!version || version === 'dev' || version === BUILD) return;
        // One reload per new version, so a stale edge cache cannot loop us.
        if (sessionStorage.getItem(ATTEMPT_KEY) === version) return;
        sessionStorage.setItem(ATTEMPT_KEY, version);
        window.location.reload();
      } catch {
        // Offline or signed out: try again next time.
      } finally {
        checking = false;
      }
    }

    void check();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 5 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
