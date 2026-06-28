import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordInput } from '@/components/ui/password-input';

export interface SmtpSettingsInput {
  smtp?: {
    enabled?: boolean;
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    from?: string;
    hasPass?: boolean;
  };
}

interface SmtpConfigProps {
  settings?: SmtpSettingsInput;
  onSave?: (data: unknown) => void;
}

export default function SmtpConfig({ settings, onSave }: SmtpConfigProps) {
  const t = useTranslations();
  const smtp = settings?.smtp ?? {};
  const [enabled, setEnabled] = useState<boolean>(smtp.enabled ?? false);
  const [host, setHost] = useState<string>(smtp.host ?? '');
  const [port, setPort] = useState<string>(smtp.port ? String(smtp.port) : '587');
  const [secure, setSecure] = useState<boolean>(smtp.secure ?? false);
  const [user, setUser] = useState<string>(smtp.user ?? '');
  const [pass, setPass] = useState<string>('');
  const [from, setFrom] = useState<string>(smtp.from ?? '');
  const [hasPass, setHasPass] = useState<boolean>(smtp.hasPass ?? false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSave() {
    setError('');
    setSuccess('');
    setSaving(true);

    const payload = {
      smtp: {
        enabled,
        host,
        port: Number(port),
        secure,
        user,
        from,
        ...(pass ? { pass } : {}),
      },
    };

    let res: Response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      data = await res.json();
    } catch {
      setSaving(false);
      setError(t('common.networkError'));
      return;
    }
    setSaving(false);

    if (!res.ok) {
      setError(data.error || t('common.failedToSave'));
    } else {
      setSuccess(t('admin.settings.emailSettingsSaved'));
      if (pass) setHasPass(true);
      setPass('');
      onSave?.(data);
    }
  }

  async function handleTest() {
    setError('');
    setSuccess('');
    setTesting(true);
    let res: Response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      data = await res.json();
    } catch {
      setTesting(false);
      setError(t('common.networkError'));
      return;
    }
    setTesting(false);
    if (!res.ok) {
      setError(data.error || t('admin.settings.testEmailFailed'));
    } else {
      setSuccess(t('admin.settings.testEmailSent', { email: data.sentTo ?? '' }));
    }
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">{t('admin.settings.smtpEmail')}</span>
            <div className="flex items-center gap-2">
              <Switch id="smtp-enabled-switch" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="smtp-enabled-switch" className="text-sm text-muted-foreground">
                {enabled ? t('admin.settings.enabled') : t('admin.settings.disabled')}
              </Label>
            </div>
          </div>
          <Separator className="mb-4" />
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="smtp-host">{t('admin.settings.smtpHost')}</Label>
              <Input id="smtp-host" value={host} onChange={(e) => setHost(e.currentTarget.value)} placeholder="smtp.example.com" />
            </div>
            <div className="flex gap-3">
              <div className="space-y-1 flex-1">
                <Label htmlFor="smtp-port">{t('admin.settings.smtpPort')}</Label>
                <Input id="smtp-port" type="number" value={port} onChange={(e) => setPort(e.currentTarget.value)} placeholder="587" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch id="smtp-secure-switch" checked={secure} onCheckedChange={setSecure} />
                <Label htmlFor="smtp-secure-switch" className="text-sm text-muted-foreground">
                  {t('admin.settings.smtpSecure')}
                </Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="smtp-user">{t('admin.settings.smtpUser')}</Label>
              <Input id="smtp-user" value={user} onChange={(e) => setUser(e.currentTarget.value)} autoComplete="off" />
            </div>
            <PasswordInput
              label={t('admin.settings.smtpPass')}
              value={pass}
              onChange={(e) => setPass((e.target as HTMLInputElement).value)}
              autoComplete="new-password"
              placeholder={hasPass ? '••••••••' : ''}
            />
            <p className="text-xs text-muted-foreground">{t('admin.settings.leaveBlankSecret')}</p>
            <div className="space-y-1">
              <Label htmlFor="smtp-from">{t('admin.settings.smtpFrom')}</Label>
              <Input id="smtp-from" value={from} onChange={(e) => setFrom(e.currentTarget.value)} placeholder="Fanek <noreply@example.com>" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('admin.settings.saveEmailSettings')}
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing || !enabled}>
          {testing ? t('admin.settings.sendingTestEmail') : t('admin.settings.sendTestEmail')}
        </Button>
      </div>
    </div>
  );
}
