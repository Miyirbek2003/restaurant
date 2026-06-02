import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { completePendingWaiterInviteIfNeeded } from '@/lib/staffInvite';
import type { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True only while resolving the initial session (max ~8s) */
  loading: boolean;
  profileLoading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

  if (error || !profile) {
    console.error('Profile fetch error:', error?.message ?? 'No profile row');
    return null;
  }

  if (!profile.restaurant_id) {
    return { ...profile, restaurants: null } as Profile;
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, status, currency')
    .eq('id', profile.restaurant_id)
    .maybeSingle();

  return { ...profile, restaurants: restaurant ?? null } as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      const p = await withTimeout(
        fetchProfile(userId),
        AUTH_TIMEOUT_MS,
        'Profile request timed out. Check Supabase URL/API key.',
      );
      setProfile(p);
    } catch (e) {
      console.error(e);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await loadProfile(user.id);
  }, [user?.id, loadProfile]);

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
          'Auth timed out. Verify VITE_SUPABASE_URL and use the anon (eyJ…) key from Project Settings → API.',
        );
        if (error) throw error;
        if (!mounted) return;

        const s = data.session;
        setSession(s);
        setUser(s?.user ?? null);
        setAuthError(null);

        if (s?.user) {
          void loadProfile(s.user.id);
        }
      } catch (e) {
        console.error(e);
        if (mounted) {
          setAuthError(e instanceof Error ? e.message : 'Failed to connect to Supabase');
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);

      if (s?.user) {
        // Defer async work — avoids Supabase auth deadlocks
        setTimeout(() => {
          if (!mounted) return;
          void (async () => {
            if (event === 'SIGNED_IN') {
              try {
                await completePendingWaiterInviteIfNeeded();
              } catch (e) {
                console.error('Pending waiter invite failed:', e);
              }
              try {
                const { completePendingCashierInviteIfNeeded } = await import('@/lib/staffInvite');
                await completePendingCashierInviteIfNeeded();
              } catch (e) {
                console.error('Pending cashier invite failed:', e);
              }
            }
            if (mounted) await loadProfile(s.user!.id);
          })();
        }, 0);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        profileLoading,
        authError,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useRestaurantId(): string | null {
  const { profile } = useAuth();
  return profile?.restaurant_id ?? null;
}
