import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isWaiter } from '@/lib/roles';
import { isWaiterTerminal } from '@/lib/waiterTerminal';

const IDLE_MS = 2 * 60 * 1000; // 2 minutes of inactivity locks the terminal

/**
 * On a bound waiter terminal, sign the active waiter out after a period of
 * inactivity so the next person must re-enter their own PIN. Managers and
 * cashiers stay signed in; only waiters are auto-locked.
 */
export function useIdleLock() {
  const { session, profile, signOut } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const role = profile?.role;
    if (!session || !isWaiterTerminal() || !role || !isWaiter(role)) return;

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
  }, [session, profile?.role, signOut]);
}
