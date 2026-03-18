import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordInput } from '@/components/ui/password-input';

interface OAuthProviderSettings {
  clientId?: string;
  tenantId?: string;
}

export interface AuthSettingsInput {
  googleOAuthEnabled?: boolean;
  microsoftOAuthEnabled?: boolean;
  authProviders?: {
    google?: OAuthProviderSettings;
    microsoft?: OAuthProviderSettings;
  };
}

interface AuthProviderConfigProps {
  settings?: AuthSettingsInput;
  onSave?: (data: unknown) => void;
}

export default function AuthProviderConfig({ settings, onSave }: AuthProviderConfigProps) {
  const [googleEnabled, setGoogleEnabled] = useState(settings?.googleOAuthEnabled || false);
  const [googleClientId, setGoogleClientId] = useState(settings?.authProviders?.google?.clientId || '');
  const [googleClientSecret, setGoogleClientSecret] = useState('');

  const [msEnabled, setMsEnabled] = useState(settings?.microsoftOAuthEnabled || false);
  const [msClientId, setMsClientId] = useState(settings?.authProviders?.microsoft?.clientId || '');
  const [msClientSecret, setMsClientSecret] = useState('');
  const [msTenantId, setMsTenantId] = useState(settings?.authProviders?.microsoft?.tenantId || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setError('');
    setSuccess(false);
    setSaving(true);

    const authProviders: Record<string, { enabled: boolean; clientId: string; tenantId?: string; clientSecret?: string }> = {};

    if (googleEnabled || googleClientId) {
      authProviders.google = {
        enabled: googleEnabled,
        clientId: googleClientId,
        ...(googleClientSecret && { clientSecret: googleClientSecret }),
      };
    }

    if (msEnabled || msClientId) {
      authProviders.microsoft = {
        enabled: msEnabled,
        clientId: msClientId,
        tenantId: msTenantId,
        ...(msClientSecret && { clientSecret: msClientSecret }),
      };
    }

    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authProviders }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || 'Failed to save');
    } else {
      setSuccess(true);
      setGoogleClientSecret('');
      setMsClientSecret('');
      onSave?.(data);
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
          <AlertDescription>Authentication settings saved.</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">Google OAuth</span>
            <div className="flex items-center gap-2">
              <Switch
                id="google-oauth-switch"
                checked={googleEnabled}
                onCheckedChange={setGoogleEnabled}
              />
              <Label htmlFor="google-oauth-switch" className="text-sm text-muted-foreground">
                {googleEnabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
          </div>
          <Separator className="mb-4" />
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="google-client-id">Client ID</Label>
              <Input
                id="google-client-id"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.currentTarget.value)}
                disabled={!googleEnabled}
              />
            </div>
            <PasswordInput
              label="Client Secret"
              value={googleClientSecret}
              onChange={(e) => setGoogleClientSecret((e.target as HTMLInputElement).value)}
              disabled={!googleEnabled}
            />
            <p className="text-xs text-muted-foreground">Leave blank to keep the existing secret</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">Microsoft OAuth</span>
            <div className="flex items-center gap-2">
              <Switch
                id="ms-oauth-switch"
                checked={msEnabled}
                onCheckedChange={setMsEnabled}
              />
              <Label htmlFor="ms-oauth-switch" className="text-sm text-muted-foreground">
                {msEnabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
          </div>
          <Separator className="mb-4" />
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ms-client-id">Client ID</Label>
              <Input
                id="ms-client-id"
                value={msClientId}
                onChange={(e) => setMsClientId(e.currentTarget.value)}
                disabled={!msEnabled}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ms-tenant-id">Tenant ID</Label>
              <Input
                id="ms-tenant-id"
                value={msTenantId}
                onChange={(e) => setMsTenantId(e.currentTarget.value)}
                disabled={!msEnabled}
              />
            </div>
            <PasswordInput
              label="Client Secret"
              value={msClientSecret}
              onChange={(e) => setMsClientSecret((e.target as HTMLInputElement).value)}
              disabled={!msEnabled}
            />
            <p className="text-xs text-muted-foreground">Leave blank to keep the existing secret</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Authentication Settings'}
      </Button>
    </div>
  );
}
