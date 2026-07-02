import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isPinWaiterSession, isWaiterTerminal } from '@/lib/waiterTerminal';

const IDLE_MS = 2 * 60 * 1000; // 2 minutes of inactivity locks the terminal

/**
 * On a bound waiter terminal, sign out only PIN-based waiter sessions after
 * inactivity. Managers and cashiers (email/password login) are never auto-locked.
 */
export function useIdleLock() {
  const { session, profile, signOut } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  useEffect(() => {
    const role = profile?.role;
    const shouldLock =
      Boolean(session) &&
      isWaiterTerminal() &&
      role === 'WAITER' &&
      isPinWaiterSession();

    if (!shouldLock) {
      if (timer.current) clearTimeout(timer.current);
      return;
    }

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void signOutRef.current();
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
  }, [session, profile?.role]);
}
