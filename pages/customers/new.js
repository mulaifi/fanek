import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth/options';
import {
  Alert,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import AppShell from '@/components/AppShell';

const DEFAULT_STATUSES = ['Active', 'Inactive', 'Suspended', 'Prospect', 'Churned'];

export default function NewCustomerPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.customerStatuses?.length) setStatuses(data.customerStatuses);
      })
      .catch(() => {});
  }, []);

  const form = useForm({
    initialValues: {
      name: '',
      clientCode: '',
      status: 'Active',
      vertical: '',
      website: '',
      address: '',
      notes: '',
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      website: (v) =>
        !v || /^https?:\/\/.+/.test(v) ? null : 'Website must start with http:// or https://',
    },
  });

  async function handleSubmit(values) {
    setApiError('');
    setSubmitting(true);

    const payload = { ...values };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') delete payload[k];
    });

    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setApiError(data.error || 'Failed to create customer');
    } else {
      notifications.show({
        title: 'Customer created',
        message: `${data.name} was added successfully.`,
        color: 'green',
      });
      router.push(`/customers/${data.id}`);
    }
  }

  const statusSelectData = statuses.map((s) => ({ value: s, label: s }));

  return (
    <AppShell title="New Customer">
      <Stack gap="md" maw={720}>
        {apiError && (
          <Alert color="red" title="Error">
            {apiError}
          </Alert>
        )}

        <Paper p="lg">
          <Title order={5} mb="md">
            Customer Details
          </Title>

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="Customer Name"
                  placeholder="Acme Corporation"
                  required
                  autoFocus
                  {...form.getInputProps('name')}
                />
                <TextInput
                  label="Client Code"
                  placeholder="e.g. ACME-001"
                  {...form.getInputProps('clientCode')}
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select
                  label="Status"
                  data={statusSelectData}
                  required
                  {...form.getInputProps('status')}
                />
                <TextInput
                  label="Vertical"
                  placeholder="Technology"
                  {...form.getInputProps('vertical')}
                />
              </SimpleGrid>

              <TextInput
                label="Website"
                placeholder="https://example.com"
                {...form.getInputProps('website')}
              />

              <Textarea
                label="Address"
                rows={2}
                {...form.getInputProps('address')}
              />

              <Textarea
                label="Notes"
                rows={3}
                {...form.getInputProps('notes')}
              />

              <Group mt="sm">
                <Button type="submit" color="brand" loading={submitting}>
                  Create Customer
                </Button>
                <Button variant="default" onClick={() => router.push('/customers')}>
                  Cancel
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </AppShell>
  );
}

export async function getServerSideProps(context) {
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  if (!['ADMIN', 'EDITOR'].includes(session.user?.role)) {
    return { redirect: { destination: '/customers', permanent: false } };
  }
  return { props: {} };
}
