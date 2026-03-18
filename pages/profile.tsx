// @ts-nocheck
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth/options';
import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  PasswordInput,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import AppShell from '@/components/AppShell';

function getPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 25;
  if (/[A-Z]/.test(password)) strength += 25;
  if (/[^A-Za-z0-9]/.test(password)) strength += 25;
  return strength;
}

function getStrengthColor(strength) {
  if (strength < 50) return 'red';
  if (strength < 75) return 'yellow';
  return 'green';
}

function getStrengthLabel(strength) {
  if (strength < 25) return 'Too short';
  if (strength < 50) return 'Weak';
  if (strength < 75) return 'Fair';
  if (strength < 100) return 'Good';
  return 'Strong';
}

function NameForm({ user, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const form = useForm({
    initialValues: { name: user?.name || '' },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
    },
  });

  async function handleSubmit(values) {
    setSuccess(false);
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: values.name.trim() }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      form.setFieldError('name', data.error || 'Failed to update name');
    } else {
      setSuccess(true);
      onUpdate({ name: data.name });
      notifications.show({ title: 'Name updated', message: 'Display name saved.', color: 'green' });
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="sm">
        {success && (
          <Alert color="green" title="Success">
            Name updated successfully.
          </Alert>
        )}
        <TextInput label="Full Name" required {...form.getInputProps('name')} />
        <Group>
          <Button type="submit" color="brand" loading={saving}>
            Save Name
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function PasswordForm({ onSuccess, successMessage }) {
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);

  const form = useForm({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      currentPassword: (v) => (v ? null : 'Current password is required'),
      newPassword: (v) =>
        !v ? 'New password is required' : v.length < 8 ? 'Password must be at least 8 characters' : null,
      confirmPassword: (v, values) =>
        !v ? 'Please confirm your new password' : v !== values.newPassword ? 'Passwords do not match' : null,
    },
  });

  const strength = getPasswordStrength(form.values.newPassword);

  async function handleSubmit(values) {
    setApiError('');
    setSuccess(false);
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setApiError(data.error || 'Failed to change password');
    } else {
      setSuccess(true);
      form.reset();
      if (onSuccess) onSuccess(data);
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="sm">
        {success && (
          <Alert color="green" title="Success">
            {successMessage || 'Password changed successfully.'}
          </Alert>
        )}
        {apiError && (
          <Alert color="red" title="Error">
            {apiError}
          </Alert>
        )}
        <PasswordInput
          label="Current Password"
          required
          {...form.getInputProps('currentPassword')}
        />
        <Box>
          <PasswordInput
            label="New Password"
            required
            {...form.getInputProps('newPassword')}
          />
          {form.values.newPassword && (
            <Box mt="xs">
              <Progress
                value={strength}
                color={getStrengthColor(strength)}
                size="xs"
                mb={4}
              />
              <Text size="xs" c={getStrengthColor(strength)}>
                {getStrengthLabel(strength)}
              </Text>
            </Box>
          )}
        </Box>
        <PasswordInput
          label="Confirm New Password"
          required
          {...form.getInputProps('confirmPassword')}
        />
        <Group>
          <Button type="submit" color="brand" loading={saving}>
            Change Password
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const user = session?.user;
  const isFirstLogin = user?.firstLogin;

  const roleColors = { ADMIN: 'red', EDITOR: 'blue', VIEWER: 'gray' };

  const content = (
    <Stack gap="md" maw={600}>
      {isFirstLogin && (
        <Alert color="blue" title="Welcome">
          Please change your temporary password to continue.
        </Alert>
      )}

      {!isFirstLogin && (
        <Paper p="lg">
          <Title order={5} mb="sm">Account Information</Title>
          <Divider mb="md" />
          <SimpleGrid cols={2} spacing="md">
            <Box>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Email</Text>
              <Text size="sm">{user?.email}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Role</Text>
              <Badge color={roleColors[user?.role] || 'gray'}>{user?.role}</Badge>
            </Box>
          </SimpleGrid>
        </Paper>
      )}

      {!isFirstLogin && (
        <Paper p="lg">
          <Title order={5} mb="sm">Display Name</Title>
          <Divider mb="md" />
          <NameForm
            user={user}
            onUpdate={async (updates) => {
              await update(updates);
            }}
          />
        </Paper>
      )}

      <Paper p="lg">
        <Title order={5} mb="sm">Change Password</Title>
        <Divider mb="md" />
        <PasswordForm
          successMessage={isFirstLogin ? 'Password changed successfully. Redirecting to dashboard...' : 'Password changed successfully.'}
          onSuccess={(data) => {
            if (data.firstLogin === false) {
              setTimeout(async () => {
                await update({ firstLogin: false });
                router.replace('/dashboard');
              }, 1500);
            }
          }}
        />
      </Paper>
    </Stack>
  );

  if (isFirstLogin) {
    return (
      <Box
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--mantine-color-body)',
          padding: 24,
        }}
      >
        <Container size="sm" w="100%">
          <Title order={3} mb="md">Set Your Password</Title>
          {content}
        </Container>
      </Box>
    );
  }

  return <AppShell title="My Profile">{content}</AppShell>;
}

export async function getServerSideProps(context) {
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
}
