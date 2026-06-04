import { useEffect, useState } from 'react';

/** Re-renders every second while enabled so time-based UI (e.g. discard countdown) stays live. */
export function useLiveSecond(enabled = true): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
}
