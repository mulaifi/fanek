import React, { useState, useEffect, useRef } from 'react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { getAuthOptions } from '@/lib/auth/options';
import {
  Alert,
  Avatar,
  Button,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload } from '@tabler/icons-react';
import AppShell from '@/components/AppShell';
import AuthProviderConfig from '@/components/admin/AuthProviderConfig';
import StatusManager from '@/components/admin/StatusManager';

const MAX_LOGO_BYTES = 256 * 1024; // 256 KB

interface SettingsShape {
  orgName?: string;
  orgLogo?: string | null;
  customerStatuses?: string[];
  [key: string]: unknown;
}

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<string>('organization');
  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [orgName, setOrgName] = useState<string>('');
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [orgSaving, setOrgSaving] = useState<boolean>(false);
  const [orgError, setOrgError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setOrgName(data.orgName || '');
        setOrgLogo(data.orgLogo || null);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load settings');
        setLoading(false);
      });
  }, []);

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      notifications.show({ color: 'red', message: 'Logo must be under 256 KB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setOrgLogo(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  async function handleSaveOrg(e: React.FormEvent<HTMLElement>) {
    e.preventDefault();
    setOrgError('');
    if (!orgName.trim()) {
      setOrgError('Organization name is required');
      return;
    }
    setOrgSaving(true);
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName: orgName.trim(), orgLogo }),
    });
    const data = await res.json();
    setOrgSaving(false);
    if (!res.ok) {
      setOrgError(data.error || 'Failed to save');
    } else {
      setSettings((prev) => ({ ...prev, ...data }));
      notifications.show({ color: 'green', message: 'Organization settings saved.' });
    }
  }

  async function handleExport() {
    const res = await fetch('/api/admin/export');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fanek-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <AppShell title="Settings">
        <Group justify="center" mt="xl">
          <Loader />
        </Group>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Settings">
        <Alert color="red">{error}</Alert>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings">
      <Tabs value={tab} onChange={(v) => setTab(v ?? 'organization')}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="organization">Organization</Tabs.Tab>
          <Tabs.Tab value="authentication">Authentication</Tabs.Tab>
          <Tabs.Tab value="statuses">Customer Statuses</Tabs.Tab>
          <Tabs.Tab value="data">Data</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="organization">
          <Stack maw={600} component="form" onSubmit={handleSaveOrg}>
            <Title order={5}>Organization Settings</Title>
            {orgError && <Alert color="red">{orgError}</Alert>}
            <TextInput
              label="Organization Name"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
            <Stack gap="xs">
              <Text size="sm" fw={500}>Logo</Text>
              <Group>
                <Avatar
                  src={orgLogo}
                  size={64}
                  radius="md"
                  style={{ cursor: 'pointer', border: '1px solid var(--mantine-color-default-border)' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {orgName?.charAt(0)?.toUpperCase() || 'L'}
                </Avatar>
                <Stack gap={4}>
                  <Button variant="default" size="xs" onClick={() => fileInputRef.current?.click()}>
                    Upload Logo
                  </Button>
                  {orgLogo && (
                    <Button variant="subtle" size="xs" color="red" onClick={() => setOrgLogo(null)}>
                      Remove
                    </Button>
                  )}
                  <Text size="xs" c="dimmed">Max 256 KB. PNG or JPG.</Text>
                </Stack>
              </Group>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={handleLogoFileChange}
              />
            </Stack>
            <Group>
              <Button type="submit" loading={orgSaving}>
                Save Organization Settings
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="authentication">
          <Stack maw={600}>
            <Title order={5}>Authentication Providers</Title>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <AuthProviderConfig
              settings={settings as any}
              onSave={(updated) => setSettings((prev) => ({ ...prev, ...updated as SettingsShape }))}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="statuses">
          <Stack maw={600}>
            <Title order={5}>Customer Statuses</Title>
            <StatusManager
              statuses={settings?.customerStatuses || []}
              onSave={(updated) => setSettings((prev) => ({ ...prev, ...updated as SettingsShape }))}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="data">
          <Stack maw={600}>
            <Title order={5}>Data Export</Title>
            <Text size="sm" c="dimmed">
              Export all data as a JSON archive for backup or migration purposes.
            </Text>
            <Group>
              <Button
                variant="default"
                leftSection={<IconDownload size={16} />}
                onClick={handleExport}
              >
                Export All Data (JSON)
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </AppShell>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  if (session.user?.role !== 'ADMIN') {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }
  return { props: {} };
}
