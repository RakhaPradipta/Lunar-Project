import { useEffect, useRef } from 'react';

/** How often pages re-fetch data in the background to stay up to date (ms). */
export const REFRESH_INTERVAL_MS = 5000;

/**
 * Calls `callback` every `intervalMs` while `active` is true.
 * The latest callback is always used, so the interval never restarts on re-renders.
 *
 * Hemat resource: polling dijeda saat tab browser tersembunyi (document.hidden)
 * dan dilanjutkan — plus langsung refresh sekali — saat tab terlihat kembali.
 * Dulu fetch terus berjalan di background walau user sedang di tab lain,
 * membebani server & baterai tanpa ada yang melihat hasilnya.
 */
export function usePolling(
  callback: () => void,
  active = true,
  intervalMs = REFRESH_INTERVAL_MS,
): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  });

  useEffect(() => {
    if (!active) return;

    const tick = () => {
      // Jangan fetch saat tab tidak terlihat — datanya tak dilihat siapa pun
      if (typeof document !== 'undefined' && document.hidden) return;
      savedCallback.current();
    };

    const id = window.setInterval(tick, intervalMs);

    // Saat user kembali ke tab, langsung refresh sekali agar data tidak basi
    const onVisible = () => {
      if (!document.hidden) savedCallback.current();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, intervalMs]);
}
