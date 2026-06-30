import { supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errors';
import { t } from '@/i18n';

const TERMINAL_KEY = 'waiter_terminal_config';

export type TerminalConfig = {
  terminalId: string;
  terminalToken: string;
  label?: string;
};

export type TerminalStaff = {
  id: string;
  name: string;
  role: string;
};

/** A device is a "waiter terminal" once it has been bound with a terminal token. */
export function getTerminalConfig(): TerminalConfig | null {
  try {
    const raw = localStorage.getItem(TERMINAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TerminalConfig;
    if (!parsed.terminalId || !parsed.terminalToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTerminalConfig(config: TerminalConfig) {
  localStorage.setItem(TERMINAL_KEY, JSON.stringify(config));
}

export function clearTerminalConfig() {
  localStorage.removeItem(TERMINAL_KEY);
}

export function isWaiterTerminal(): boolean {
  return getTerminalConfig() !== null;
}

async function callPinLoginFn(payload: Record<string, unknown>) {
  const config = getTerminalConfig();
  if (!config) throw new Error('TERMINAL_NOT_CONFIGURED');

  const { data, error } = await supabase.functions.invoke('waiter-pin-login', {
    body: {
      terminal_id: config.terminalId,
      terminal_token: config.terminalToken,
      ...payload,
    },
  });

  if (error) {
    let detail = getErrorMessage(error);
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = (await ctx.json()) as { error?: string; message?: string };
        detail = body.message ?? body.error ?? detail;
      } catch {
        /* ignore parse failure */
      }
    }
    if (/failed to fetch|cors|network/i.test(detail)) {
      throw new Error(t('terminal.pinServiceUnavailable'));
    }
    const err = new Error(detail) as Error & { code?: string };
    if (/invalid_pin/i.test(detail)) err.code = 'invalid_pin';
    if (/locked/i.test(detail)) err.code = 'locked';
    throw err;
  }

  const body = data as { error?: string; message?: string };
  if (body?.error) {
    const err = new Error(body.message ?? body.error) as Error & { code?: string };
    err.code = body.error;
    throw err;
  }
  return data;
}

/** Staff (with a PIN) in this terminal's restaurant. */
export async function listTerminalStaff(): Promise<TerminalStaff[]> {
  const config = getTerminalConfig();
  if (!config) return [];

  const { data, error } = await supabase.rpc('list_terminal_staff_for_device', {
    p_terminal_id: config.terminalId,
    p_token: config.terminalToken,
  });

  if (error) {
    if (/function.*does not exist|404/i.test(error.message)) {
      throw new Error(t('terminal.migrationRequired'));
    }
    if (/terminal not recognized/i.test(error.message)) {
      throw new Error(t('terminal.terminalRevoked'));
    }
    throw error;
  }

  return (data ?? []) as TerminalStaff[];
}

export type PinLoginError = Error & { code?: 'invalid_pin' | 'locked' | string };

/** Verify the PIN server-side and start a real Supabase session for that staff member. */
export async function pinLogin(staffId: string, pin: string): Promise<void> {
  const data = (await callPinLoginFn({ action: 'login', staff_id: staffId, pin })) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!data.access_token || !data.refresh_token) {
    throw new Error(t('terminal.pinServiceUnavailable'));
  }
  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (error) throw error;
}
