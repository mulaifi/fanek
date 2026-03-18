import { useState } from 'react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { getAuthOptions } from '@/lib/auth/options';
import {
  Alert,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import AppShell from '@/components/AppShell';

const PARTNER_TYPES = ['Reseller', 'Distributor', 'Technology', 'Service', 'Referral', 'Other'];

export default function NewPartnerPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');

  interface NewPartnerFormValues {
    name: string;
    type: string;
    website: string;
    address: string;
    notes: string;
  }

  const form = useForm<NewPartnerFormValues>({
    initialValues: {
      name: '',
      type: '',
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

  async function handleSubmit(values: NewPartnerFormValues) {
    setApiError('');
    setSubmitting(true);

    const payload: Record<string, string> = { ...values };
    (Object.keys(payload) as (keyof typeof payload)[]).forEach((k) => {
      if (payload[k] === '') delete payload[k];
    });

    const res = await fetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setApiError(data.error || 'Failed to create partner');
    } else {
      notifications.show({
        title: 'Partner created',
        message: `${data.name} was added successfully.`,
        color: 'green',
      });
      router.push(`/partners/${data.id}`);
    }
  }

  const typeSelectData = [
    { value: '', label: 'None' },
    ...PARTNER_TYPES.map((t) => ({ value: t, label: t })),
  ];

  return (
    <AppShell title="New Partner">
      <Stack gap="md" maw={720}>
        {apiError && (
          <Alert color="red" title="Error">
            {apiError}
          </Alert>
        )}

        <Paper p="lg">
          <Title order={5} mb="md">
            Partner Details
          </Title>

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="Partner Name"
                  placeholder="Acme Partners Ltd"
                  required
                  autoFocus
                  {...form.getInputProps('name')}
                />
                <Select
                  label="Type"
                  data={typeSelectData}
                  {...form.getInputProps('type')}
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
                  Create Partner
                </Button>
                <Button variant="default" onClick={() => router.push('/partners')}>
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

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  if (!['ADMIN', 'EDITOR'].includes(session.user?.role)) {
    return { redirect: { destination: '/partners', permanent: false } };
  }
  return { props: {} };
}
