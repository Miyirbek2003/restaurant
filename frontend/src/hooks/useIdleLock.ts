import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isWaiterTerminal } from '@/lib/waiterTerminal';

const IDLE_MS = 2 * 60 * 1000; // 2 minutes of inactivity locks the terminal

/**
 * On a bound waiter terminal, sign the active waiter out after a period of
 * inactivity so the next person must re-enter their own PIN. No-op on ordinary
 * manager/cashier monitors.
 */
export function useIdleLock() {
  const { session, signOut } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!session || !isWaiterTerminal()) return;

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void signOut();
      }, IDLE_MS);
    };

    const events: (keyof WindowEventMap)[] = [
      'pointerdown',
      'keydown',
      'touchstart',
      'mousemove',
      'wheel',
    ];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [session, signOut]);
}
