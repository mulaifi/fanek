import { useState } from 'react';
import { Alert, Box, Button, Card, Divider, Group, PasswordInput, Stack, Switch, Text, TextInput } from '@mantine/core';

interface OAuthProviderSettings {
  clientId?: string;
  tenantId?: string;
}

interface AuthSettingsInput {
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
    <Box>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {success && (
        <Alert color="green" mb="md">
          Authentication settings saved.
        </Alert>
      )}

      <Card withBorder mb="lg">
        <Group justify="space-between" mb="md">
          <Text size="md" fw={600}>
            Google OAuth
          </Text>
          <Switch
            checked={googleEnabled}
            onChange={(e) => setGoogleEnabled(e.currentTarget.checked)}
            label={googleEnabled ? 'Enabled' : 'Disabled'}
          />
        </Group>
        <Divider mb="md" />
        <Stack gap="sm">
          <TextInput
            label="Client ID"
            value={googleClientId}
            onChange={(e) => setGoogleClientId(e.currentTarget.value)}
            size="sm"
            disabled={!googleEnabled}
          />
          <PasswordInput
            label="Client Secret"
            value={googleClientSecret}
            onChange={(e) => setGoogleClientSecret(e.currentTarget.value)}
            size="sm"
            description="Leave blank to keep the existing secret"
            disabled={!googleEnabled}
          />
        </Stack>
      </Card>

      <Card withBorder mb="lg">
        <Group justify="space-between" mb="md">
          <Text size="md" fw={600}>
            Microsoft OAuth
          </Text>
          <Switch
            checked={msEnabled}
            onChange={(e) => setMsEnabled(e.currentTarget.checked)}
            label={msEnabled ? 'Enabled' : 'Disabled'}
          />
        </Group>
        <Divider mb="md" />
        <Stack gap="sm">
          <TextInput
            label="Client ID"
            value={msClientId}
            onChange={(e) => setMsClientId(e.currentTarget.value)}
            size="sm"
            disabled={!msEnabled}
          />
          <TextInput
            label="Tenant ID"
            value={msTenantId}
            onChange={(e) => setMsTenantId(e.currentTarget.value)}
            size="sm"
            disabled={!msEnabled}
          />
          <PasswordInput
            label="Client Secret"
            value={msClientSecret}
            onChange={(e) => setMsClientSecret(e.currentTarget.value)}
            size="sm"
            description="Leave blank to keep the existing secret"
            disabled={!msEnabled}
          />
        </Stack>
      </Card>

      <Button onClick={handleSave} loading={saving}>
        {saving ? 'Saving...' : 'Save Authentication Settings'}
      </Button>
    </Box>
  );
}
