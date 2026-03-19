import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { getAuthOptions } from '@/lib/auth/options';
import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus, Pencil, Key, LogOut, Trash2, Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { DataTable } from '@/components/ui/data-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ADMIN: 'destructive',
  EDITOR: 'default',
  VIEWER: 'secondary',
};

type UserRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface InviteResult {
  user: UserRow;
  tempPassword: string;
}

interface ResetPasswordResult {
  userId: string;
  userName: string;
  tempPassword: string;
}

interface InlineConfirmButtonProps {
  onConfirm: () => void;
  label: string;
  confirmLabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: 'ghost' | 'outline' | 'destructive';
}

/** Two-click inline confirm button with 3-second auto-revert */
function InlineConfirmButton({
  onConfirm,
  label,
  confirmLabel,
  icon,
  disabled = false,
  variant = 'ghost',
}: InlineConfirmButtonProps) {
  const t = useTranslations();
  const [confirming, setConfirming] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startConfirm = useCallback(() => {
    if (disabled) return;
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), 3000);
  }, [disabled]);

  const handleConfirm = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
    onConfirm();
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button size="sm" variant="destructive" onClick={handleConfirm}>
          {confirmLabel ?? t('admin.users.confirmQuestion')}
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={startConfirm}
      disabled={disabled}
      className="gap-1"
    >
      {icon}
      {label}
    </Button>
  );
}

export default function AdminUsersPage() {
  const t = useTranslations();
  const { data: session } = useSession();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [showInviteForm, setShowInviteForm] = useState<boolean>(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [editingRoleUserId, setEditingRoleUserId] = useState<string | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<ResetPasswordResult | null>(null);

  async function loadUsers() {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setUsers(data.data || []);
    } else {
      setError(data.error || t('admin.users.failedLoadUsers'));
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleInviteSuccess(result: InviteResult) {
    setUsers((prev) => [result.user, ...prev]);
    setShowInviteForm(false);
    setInviteResult(result);
  }

  function handleRoleUpdated(userId: string, newRole: UserRole) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    setEditingRoleUserId(null);
    toast.success(t('admin.users.roleUpdated'));
  }

  async function handleResetPassword(user: UserRow) {
    const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setResetPasswordResult({ userId: user.id, userName: user.name, tempPassword: data.tempPassword });
    } else {
      toast.error(data.error || t('admin.users.failedResetPassword'));
    }
  }

  async function handleRevokeSessions(user: UserRow) {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/revoke-sessions`, { method: 'POST' });
      if (res.ok) {
        toast.success(t('admin.users.sessionsRevoked', { name: user.name }));
      } else {
        const data = await res.json();
        toast.error(data.error || t('admin.users.failedRevokeSessions'));
      }
    } catch {
      toast.error(t('admin.users.networkErrorRevoke'));
    }
  }

  async function handleDelete(user: UserRow) {
    if (user.id === session?.user?.id) {
      toast.error(t('admin.users.cannotDeleteSelf'));
      return;
    }
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(t('admin.users.userDeleted'));
    } else {
      const data = await res.json();
      toast.error(data.error || t('admin.users.failedDeleteUser'));
    }
  }

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: 'name',
      header: t('admin.users.name'),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'email',
      header: t('admin.users.email'),
    },
    {
      accessorKey: 'role',
      header: t('admin.users.role'),
      cell: ({ row }) => {
        const user = row.original;
        if (editingRoleUserId === user.id) {
          return (
            <InlineEditRole
              user={user}
              onSave={handleRoleUpdated}
              onCancel={() => setEditingRoleUserId(null)}
            />
          );
        }
        return (
          <Badge variant={ROLE_VARIANT[user.role] || 'secondary'}>
            {user.role}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: t('admin.users.created'),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-1 justify-end flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => setEditingRoleUserId(user.id)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {t('admin.users.editRole')}
            </Button>
            <InlineConfirmButton
              onConfirm={() => handleResetPassword(user)}
              label={t('admin.users.resetPassword')}
              confirmLabel={t('admin.users.resetQuestion')}
              icon={<Key className="h-3.5 w-3.5" />}
              variant="ghost"
            />
            <InlineConfirmButton
              onConfirm={() => handleRevokeSessions(user)}
              label={t('admin.users.revokeSessions')}
              confirmLabel={t('admin.users.revokeQuestion')}
              icon={<LogOut className="h-3.5 w-3.5" />}
              variant="ghost"
            />
            <InlineConfirmButton
              onConfirm={() => handleDelete(user)}
              label={t('admin.users.deleteUser')}
              confirmLabel={t('admin.users.confirmQuestion')}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              variant="ghost"
              disabled={user.id === session?.user?.id}
            />
          </div>
        );
      },
    },
  ];

  return (
    <AppShell title={t('admin.users.title')}>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Invite result banner */}
      {inviteResult && (
        <Alert className="mb-4">
          <AlertTitle>{t('admin.users.userCreatedTitle')}</AlertTitle>
          <AlertDescription>
            <p className="text-sm mb-2">{t('admin.users.userCreatedDesc')}</p>
            <code className="font-mono bg-muted px-2 py-1 rounded text-sm block mt-1">
              {inviteResult.tempPassword}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setInviteResult(null)}
            >
              {t('admin.users.dismiss')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Reset password result banner */}
      {resetPasswordResult && (
        <Alert className="mb-4">
          <AlertTitle>{t('admin.users.passwordResetTitle')}</AlertTitle>
          <AlertDescription>
            <p className="text-sm mb-2">
              {t('admin.users.passwordResetDesc', { name: resetPasswordResult.userName })}
            </p>
            <code className="font-mono bg-muted px-2 py-1 rounded text-sm block mt-1">
              {resetPasswordResult.tempPassword}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setResetPasswordResult(null)}
            >
              {t('admin.users.dismiss')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end mb-4">
        {!showInviteForm && (
          <Button onClick={() => setShowInviteForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('admin.users.inviteUser')}
          </Button>
        )}
      </div>

      {/* Inline invite form */}
      {showInviteForm && (
        <Card className="mb-4 border-2 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('admin.users.inviteNewUser')}</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteUserForm
              onClose={() => setShowInviteForm(false)}
              onSuccess={handleInviteSuccess}
            />
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          emptyMessage={t('admin.users.noUsers')}
        />
      )}
    </AppShell>
  );
}

interface InlineEditRoleProps {
  user: UserRow;
  onSave: (userId: string, role: UserRole) => void;
  onCancel: () => void;
}

function InlineEditRole({ user, onSave, onCancel }: InlineEditRoleProps) {
  const t = useTranslations();
  const [role, setRole] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState<boolean>(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        onSave(user.id, role);
      } else {
        const data = await res.json();
        toast.error(data.error || t('admin.users.failedUpdateRole'));
      }
    } catch {
      toast.error(t('admin.users.networkErrorRole'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="VIEWER">{t('admin.users.roleViewer')}</SelectItem>
          <SelectItem value="EDITOR">{t('admin.users.roleEditor')}</SelectItem>
          <SelectItem value="ADMIN">{t('admin.users.roleAdmin')}</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs">
        {saving && <Loader2 className="h-3 w-3 animate-spin me-1" />}
        {t('common.save')}
      </Button>
      <Button size="sm" variant="outline" onClick={onCancel} className="h-7 text-xs">
        {t('common.cancel')}
      </Button>
    </div>
  );
}

interface InviteUserFormProps {
  onClose: () => void;
  onSuccess: (result: InviteResult) => void;
}

interface InviteFormErrors {
  name?: string;
  email?: string;
  _form?: string;
}

function InviteUserForm({ onClose, onSuccess }: InviteUserFormProps) {
  const t = useTranslations();
  const [form, setForm] = useState<{ name: string; email: string; role: UserRole }>({
    name: '',
    email: '',
    role: 'VIEWER',
  });
  const [errors, setErrors] = useState<InviteFormErrors>({});
  const [inviting, setInviting] = useState<boolean>(false);

  async function handleSubmit() {
    const errs: InviteFormErrors = {};
    if (!form.name.trim()) errs.name = t('admin.users.nameRequired');
    if (!form.email.trim()) errs.email = t('admin.users.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('admin.users.emailInvalid');
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setInviting(true);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setInviting(false);
    if (!res.ok) {
      setErrors({ _form: data.error || t('admin.users.failedCreateUser') });
    } else {
      onSuccess(data);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {errors._form && (
        <Alert variant="destructive">
          <AlertDescription>{errors._form}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-1">
        <Label htmlFor="invite-name">
          {t('admin.users.fullName')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="invite-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="invite-email">
          {t('admin.users.emailAddress')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="invite-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="invite-role">{t('admin.users.role')}</Label>
        <Select
          value={form.role}
          onValueChange={(v) => setForm({ ...form, role: v as UserRole })}
        >
          <SelectTrigger id="invite-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="VIEWER">{t('admin.users.roleViewer')}</SelectItem>
            <SelectItem value="EDITOR">{t('admin.users.roleEditor')}</SelectItem>
            <SelectItem value="ADMIN">{t('admin.users.roleAdmin')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSubmit} disabled={inviting}>
          {inviting && <Loader2 className="h-4 w-4 animate-spin me-2" />}
          {t('admin.users.sendInvite')}
        </Button>
      </div>
    </div>
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
