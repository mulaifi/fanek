import React, { useState, useEffect, useRef } from 'react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { getAuthOptions } from '@/lib/auth/options';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import AuthProviderConfig from '@/components/admin/AuthProviderConfig';
import StatusManager from '@/components/admin/StatusManager';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
      toast.error('Logo must be under 256 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setOrgLogo((ev.target?.result as string) ?? null);
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
      toast.success('Organization settings saved.');
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
        <div className="flex justify-center mt-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Settings">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="statuses">Customer Statuses</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="organization">
          <form onSubmit={handleSaveOrg} className="flex flex-col gap-4 max-w-lg">
            <h2 className="text-base font-semibold">Organization Settings</h2>
            {orgError && (
              <Alert variant="destructive">
                <AlertDescription>{orgError}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="org-name">
                Organization Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-name"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="rounded-md border border-border overflow-hidden w-16 h-16 flex items-center justify-center bg-muted shrink-0 hover:opacity-80 transition-opacity"
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to upload logo"
                >
                  {orgLogo ? (
                    <Avatar className="w-16 h-16 rounded-md">
                      <AvatarImage src={orgLogo} alt="Logo" className="object-contain" />
                      <AvatarFallback className="rounded-md text-lg">
                        {orgName?.charAt(0)?.toUpperCase() || 'L'}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="text-2xl font-bold text-muted-foreground">
                      {orgName?.charAt(0)?.toUpperCase() || 'L'}
                    </span>
                  )}
                </button>
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Logo
                  </Button>
                  {orgLogo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setOrgLogo(null)}
                    >
                      Remove
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">Max 256 KB. PNG, JPG, GIF, or WebP.</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={handleLogoFileChange}
              />
            </div>
            <div>
              <Button type="submit" disabled={orgSaving}>
                {orgSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Organization Settings
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="authentication">
          <div className="flex flex-col gap-4 max-w-lg">
            <h2 className="text-base font-semibold">Authentication Providers</h2>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <AuthProviderConfig
              settings={settings as any}
              onSave={(updated) =>
                setSettings((prev) => ({ ...prev, ...(updated as SettingsShape) }))
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="statuses">
          <div className="flex flex-col gap-4 max-w-lg">
            <h2 className="text-base font-semibold">Customer Statuses</h2>
            <StatusManager
              statuses={settings?.customerStatuses || []}
              onSave={(updated) =>
                setSettings((prev) => ({ ...prev, ...(updated as SettingsShape) }))
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="data">
          <div className="flex flex-col gap-4 max-w-lg">
            <h2 className="text-base font-semibold">Data Export</h2>
            <p className="text-sm text-muted-foreground">
              Export all data as a JSON archive for backup or migration purposes.
            </p>
            <div>
              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Export All Data (JSON)
              </Button>
            </div>
          </div>
        </TabsContent>
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
