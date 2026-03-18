import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { getAuthOptions } from '@/lib/auth/options';
import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DataTable } from 'mantine-datatable';
import {
  IconPlus,
  IconDots,
  IconPencil,
  IconKey,
  IconLogout,
  IconTrash,
} from '@tabler/icons-react';
import AppShell from '@/components/AppShell';

const ROLE_COLORS = {
  ADMIN: 'red',
  EDITOR: 'blue',
  VIEWER: 'gray',
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
  color?: string;
  icon?: React.ReactNode;
  size?: string;
  variant?: string;
  disabled?: boolean;
}

/** Two-click inline confirm button with 3-second auto-revert */
function InlineConfirmButton({ onConfirm, label, confirmLabel = 'Confirm?', color = 'red', icon, size = 'xs', variant = 'subtle', disabled = false }: InlineConfirmButtonProps) {
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
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (confirming) {
    return (
      <Group gap={4}>
        <Button size="xs" color={color} variant="filled" onClick={handleConfirm}>{confirmLabel}</Button>
        <Button size="xs" variant="default" onClick={handleCancel}>Cancel</Button>
      </Group>
    );
  }

  return (
    <Button variant={variant} size={size} color={color} leftSection={icon} onClick={startConfirm} disabled={disabled}>
      {label}
    </Button>
  );
}

export default function AdminUsersPage() {
  const { data: session } = useSession();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Inline states
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
      setError(data.error || 'Failed to load users');
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
    notifications.show({ color: 'green', message: 'Role updated successfully.' });
  }

  async function handleResetPassword(user: UserRow) {
    const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setResetPasswordResult({ userId: user.id, userName: user.name, tempPassword: data.tempPassword });
    } else {
      notifications.show({ color: 'red', message: data.error || 'Failed to reset password.' });
    }
  }

  async function handleRevokeSessions(user: UserRow) {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/revoke-sessions`, { method: 'POST' });
      if (res.ok) {
        notifications.show({ color: 'green', message: `Sessions revoked for ${user.name}.` });
      } else {
        const data = await res.json();
        notifications.show({ color: 'red', message: data.error || 'Failed to revoke sessions.' });
      }
    } catch (err) {
      notifications.show({ color: 'red', message: 'Network error: failed to revoke sessions.' });
    }
  }

  async function handleDelete(user: UserRow) {
    if (user.id === session?.user?.id) {
      notifications.show({ color: 'red', message: 'You cannot delete your own account.' });
      return;
    }
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      notifications.show({ color: 'green', message: 'User deleted.' });
    } else {
      const data = await res.json();
      notifications.show({ color: 'red', message: data.error || 'Failed to delete user.' });
    }
  }

  return (
    <AppShell title="Users">
      {error && (
        <Alert color="red" mb="md">{error}</Alert>
      )}

      {/* Invite result banner */}
      {inviteResult && (
        <Alert color="green" mb="md" withCloseButton onClose={() => setInviteResult(null)} title="User Created">
          <Text size="sm">Share this temporary password with the user. It will not be shown again.</Text>
          <Code block mt="xs">{inviteResult.tempPassword}</Code>
        </Alert>
      )}

      {/* Reset password result banner */}
      {resetPasswordResult && (
        <Alert color="green" mb="md" withCloseButton onClose={() => setResetPasswordResult(null)} title="Password Reset">
          <Text size="sm">New temporary password for {resetPasswordResult.userName} (shown once only):</Text>
          <Code block mt="xs">{resetPasswordResult.tempPassword}</Code>
        </Alert>
      )}

      <Group justify="flex-end" mb="md">
        {!showInviteForm && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setShowInviteForm(true)}>
            Invite User
          </Button>
        )}
      </Group>

      {/* Inline invite form */}
      {showInviteForm && (
        <Paper withBorder p="md" mb="md" style={{ borderColor: 'var(--mantine-color-brand-5)', borderWidth: 2 }}>
          <Text fw={600} size="sm" mb="md">Invite New User</Text>
          <InviteUserForm onClose={() => setShowInviteForm(false)} onSuccess={handleInviteSuccess} />
        </Paper>
      )}

      <DataTable
        records={users}
        fetching={loading}
        minHeight={200}
        columns={[
          {
            accessor: 'name',
            title: 'Name',
            render: (user) => <Text fw={500}>{user.name}</Text>,
          },
          { accessor: 'email', title: 'Email' },
          {
            accessor: 'role',
            title: 'Role',
            render: (user) => {
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
                <Badge variant="light" color={ROLE_COLORS[user.role] || 'gray'}>
                  {user.role}
                </Badge>
              );
            },
          },
          {
            accessor: 'createdAt',
            title: 'Created',
            render: (user) => new Date(user.createdAt).toLocaleDateString(),
          },
          {
            accessor: 'actions',
            title: '',
            textAlign: 'right',
            render: (user) => (
              <Group gap={4} justify="flex-end" wrap="nowrap">
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconPencil size={14} />}
                  onClick={() => setEditingRoleUserId(user.id)}
                >
                  Edit Role
                </Button>
                <InlineConfirmButton
                  onConfirm={() => handleResetPassword(user)}
                  label="Reset Password"
                  confirmLabel="Reset?"
                  color="orange"
                  icon={<IconKey size={14} />}
                />
                <InlineConfirmButton
                  onConfirm={() => handleRevokeSessions(user)}
                  label="Revoke Sessions"
                  confirmLabel="Revoke?"
                  color="orange"
                  icon={<IconLogout size={14} />}
                />
                <InlineConfirmButton
                  onConfirm={() => handleDelete(user)}
                  label="Delete"
                  confirmLabel="Confirm?"
                  color="red"
                  icon={<IconTrash size={14} />}
                  disabled={user.id === session?.user?.id}
                />
              </Group>
            ),
          },
        ]}
        noRecordsText="No users found"
      />
    </AppShell>
  );
}

interface InlineEditRoleProps {
  user: UserRow;
  onSave: (userId: string, role: UserRole) => void;
  onCancel: () => void;
}

function InlineEditRole({ user, onSave, onCancel }: InlineEditRoleProps) {
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
        notifications.show({ color: 'red', message: data.error || 'Failed to update role.' });
      }
    } catch (err) {
      notifications.show({ color: 'red', message: 'Network error: failed to update role.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Group gap={4} wrap="nowrap">
      <Select
        size="xs"
        value={role}
        onChange={(v) => { if (v) setRole(v as UserRole); }}
        data={[
          { value: 'VIEWER', label: 'Viewer' },
          { value: 'EDITOR', label: 'Editor' },
          { value: 'ADMIN', label: 'Admin' },
        ]}
        style={{ width: 120 }}
      />
      <Button size="xs" onClick={handleSave} loading={saving}>Save</Button>
      <Button size="xs" variant="default" onClick={onCancel}>Cancel</Button>
    </Group>
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
  const [form, setForm] = useState<{ name: string; email: string; role: UserRole }>({ name: '', email: '', role: 'VIEWER' });
  const [errors, setErrors] = useState<InviteFormErrors>({});
  const [inviting, setInviting] = useState<boolean>(false);

  async function handleSubmit() {
    const errs: InviteFormErrors = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email';
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
      setErrors({ _form: data.error || 'Failed to create user' });
    } else {
      onSuccess(data);
    }
  }

  return (
    <Stack>
      {errors._form && <Alert color="red">{errors._form}</Alert>}
      <TextInput
        label="Full Name"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        error={errors.name}
      />
      <TextInput
        label="Email Address"
        type="email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        error={errors.email}
      />
      <Select
        label="Role"
        value={form.role}
        onChange={(v) => { if (v) setForm({ ...form, role: v as UserRole }); }}
        data={[
          { value: 'VIEWER', label: 'Viewer' },
          { value: 'EDITOR', label: 'Editor' },
          { value: 'ADMIN', label: 'Admin' },
        ]}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} loading={inviting}>Send Invite</Button>
      </Group>
    </Stack>
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
