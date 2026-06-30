import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useTerminals, useRegisterTerminal, useRevokeTerminal } from '@/hooks/useTerminals';
import {
  getTerminalConfig,
  saveTerminalConfig,
  clearTerminalConfig,
} from '@/lib/waiterTerminal';
import { useNotificationStore } from '@/stores/notificationStore';
import { getErrorMessage } from '@/lib/errors';
import { t } from '@/i18n';

export function TerminalsCard() {
  const notify = useNotificationStore((s) => s.add);
  const { data: terminals = [], isLoading } = useTerminals();
  const register = useRegisterTerminal();
  const revoke = useRevokeTerminal();

  const [label, setLabel] = useState('');
  const [newToken, setNewToken] = useState<{ terminalId: string; token: string; label: string } | null>(null);
  const bound = getTerminalConfig();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate(label.trim() || 'Terminal', {
      onSuccess: (data) => {
        setNewToken({ terminalId: data.terminal_id, token: data.token, label: label.trim() || 'Terminal' });
        setLabel('');
      },
      onError: (err) => notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) }),
    });
  };

  const bindThisDevice = () => {
    if (!newToken) return;
    saveTerminalConfig({
      terminalId: newToken.terminalId,
      terminalToken: newToken.token,
      label: newToken.label,
    });
    notify({ type: 'success', title: t('terminal.boundToThisDevice') });
    setNewToken(null);
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="font-semibold">{t('terminal.terminalsTitle')}</h3>
        <p className="mt-1 text-sm text-slate-500">{t('terminal.terminalsDesc')}</p>
      </div>

      {bound && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
          <span className="font-medium text-emerald-800 dark:text-emerald-200">
            {t('terminal.boundToThisDevice')}{bound.label ? ` · ${bound.label}` : ''}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              clearTerminalConfig();
              notify({ type: 'success', title: t('terminal.unbindThisDevice') });
            }}
          >
            {t('terminal.unbindThisDevice')}
          </Button>
        </div>
      )}

      {newToken && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-100">{t('terminal.tokenOnce')}</p>
          <code className="block break-all rounded bg-white px-2 py-1 text-xs dark:bg-slate-900">
            {newToken.token}
          </code>
          <Button size="sm" onClick={bindThisDevice}>
            {t('terminal.useOnThisDevice')}
          </Button>
        </div>
      )}

      <form onSubmit={handleRegister} className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <Input
            label={t('terminal.terminalLabel')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Hall / Bar / Terrace"
          />
        </div>
        <Button type="submit" loading={register.isPending}>
          {t('terminal.registerTerminal')}
        </Button>
      </form>

      {isLoading ? (
        <Spinner />
      ) : terminals.length === 0 ? (
        <p className="text-sm text-slate-500">{t('terminal.noTerminals')}</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {terminals.map((term) => (
            <li key={term.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="text-sm font-medium">{term.label}</p>
                <p className="text-xs text-slate-500">
                  {t('terminal.lastSeen')}:{' '}
                  {term.last_seen_at ? new Date(term.last_seen_at).toLocaleString() : t('terminal.never')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={term.is_active ? 'green' : 'gray'} size="sm">
                  {term.is_active ? t('terminal.active') : t('terminal.revoked')}
                </Badge>
                {term.is_active && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (!window.confirm(t('terminal.revokeConfirm', { label: term.label }))) return;
                      revoke.mutate(term.id, {
                        onError: (err) =>
                          notify({ type: 'error', title: t('common.error'), message: getErrorMessage(err) }),
                      });
                    }}
                  >
                    {t('terminal.revokeTerminal')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
