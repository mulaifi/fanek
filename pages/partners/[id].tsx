import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth/options';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
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
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import AppShell from '@/components/AppShell';
import ContactsEditor from '@/components/ContactsEditor';

const PARTNER_TYPES = ['Reseller', 'Distributor', 'Technology', 'Service', 'Referral', 'Other'];

const TYPE_COLORS = {
  Reseller: 'blue',
  Distributor: 'cyan',
  Technology: 'violet',
  Service: 'teal',
  Referral: 'orange',
  Other: 'gray',
};

function EditPartnerForm({ partner, onSave, onClose }) {
  const form = useForm({
    initialValues: {
      name: partner.name || '',
      type: partner.type || '',
      website: partner.website || '',
      address: partner.address || '',
      notes: partner.notes || '',
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      website: (v) =>
        !v || /^https?:\/\/.+/.test(v) ? null : 'Website must start with http:// or https://',
    },
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const typeSelectData = [
    { value: '', label: 'None' },
    ...PARTNER_TYPES.map((t) => ({ value: t, label: t })),
  ];

  async function handleSubmit(values) {
    setSaveError('');
    setSaving(true);
    const payload = { ...values };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') payload[k] = null;
    });
    const res = await fetch(`/api/partners/${partner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setSaveError(data.error || 'Failed to save');
    } else {
      onSave(data);
    }
  }

  return (
    <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-brand-5)', borderWidth: 2 }}>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          {saveError && (
            <Alert color="red" title="Error">
              {saveError}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Partner Name" required {...form.getInputProps('name')} />
            <Select label="Type" data={typeSelectData} {...form.getInputProps('type')} />
          </SimpleGrid>
          <TextInput label="Website" placeholder="https://example.com" {...form.getInputProps('website')} />
          <Textarea label="Address" rows={2} {...form.getInputProps('address')} />
          <Textarea label="Notes" rows={3} {...form.getInputProps('notes')} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" color="brand" loading={saving}>Save Changes</Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}

/** Two-click inline delete button with 3-second auto-revert */
function InlineDeleteButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef(null);

  const startConfirm = useCallback(() => {
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), 3000);
  }, []);

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
        <Button size="xs" color="red" variant="filled" onClick={handleConfirm}>Confirm?</Button>
        <Button size="xs" variant="default" onClick={handleCancel}>Cancel</Button>
      </Group>
    );
  }

  return (
    <ActionIcon variant="default" size="lg" color="red" onClick={startConfirm} title="Delete">
      <IconTrash size={16} />
    </ActionIcon>
  );
}

export default function PartnerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();

  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contactsValue, setContactsValue] = useState([]);
  const [contactsSaving, setContactsSaving] = useState(false);

  // Inline editing state
  const [editingPartner, setEditingPartner] = useState(false);

  const canEdit = ['ADMIN', 'EDITOR'].includes(session?.user?.role);
  const isAdmin = session?.user?.role === 'ADMIN';

  useEffect(() => {
    if (!id) return;
    fetch(`/api/partners/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setPartner(data);
          setContactsValue(data.contacts || []);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load partner');
        setLoading(false);
      });
  }, [id]);

  async function handleDeletePartner() {
    try {
      const res = await fetch(`/api/partners/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/partners');
      } else {
        const data = await res.json().catch(() => ({}));
        notifications.show({ title: 'Error', message: data.error || 'Failed to delete partner.', color: 'red' });
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Network error: failed to delete partner.', color: 'red' });
    }
  }

  async function handleSaveContacts() {
    setContactsSaving(true);
    const res = await fetch(`/api/partners/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: contactsValue }),
    });
    const data = await res.json();
    setContactsSaving(false);
    if (res.ok) {
      setPartner((prev) => ({ ...prev, contacts: data.contacts }));
      setContactsValue(data.contacts || []);
      notifications.show({ title: 'Contacts saved', message: 'Contacts updated.', color: 'green' });
    } else {
      notifications.show({ title: 'Error', message: 'Failed to save contacts.', color: 'red' });
    }
  }

  if (loading) {
    return (
      <AppShell title="Partner">
        <Center mt="xl">
          <Loader />
        </Center>
      </AppShell>
    );
  }

  if (error || !partner) {
    return (
      <AppShell title="Partner">
        <Alert color="red" title="Error">
          {error || 'Partner not found'}
        </Alert>
      </AppShell>
    );
  }

  return (
    <AppShell title={partner.name}>
      <Stack gap="md">
        {/* Header */}
        {editingPartner ? (
          <Box>
            <Group gap="sm" mb="md">
              <ActionIcon variant="subtle" onClick={() => router.push('/partners')} mt={4}>
                <IconArrowLeft size={18} />
              </ActionIcon>
              <Title order={3}>Edit Partner</Title>
            </Group>
            <EditPartnerForm
              partner={partner}
              onSave={(data) => {
                setPartner((prev) => ({ ...prev, ...data }));
                setEditingPartner(false);
                notifications.show({ title: 'Saved', message: 'Partner updated.', color: 'green' });
              }}
              onClose={() => setEditingPartner(false)}
            />
          </Box>
        ) : (
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Group gap="sm" align="flex-start">
              <ActionIcon variant="subtle" onClick={() => router.push('/partners')} mt={4}>
                <IconArrowLeft size={18} />
              </ActionIcon>
              <Box>
                <Title order={3}>{partner.name}</Title>
                {partner.type && (
                  <Badge color={TYPE_COLORS[partner.type] || 'gray'} mt={4}>
                    {partner.type}
                  </Badge>
                )}
              </Box>
            </Group>
            {canEdit && (
              <Group gap="xs">
                <ActionIcon variant="default" size="lg" onClick={() => setEditingPartner(true)} title="Edit">
                  <IconEdit size={16} />
                </ActionIcon>
                {isAdmin && (
                  <InlineDeleteButton onConfirm={handleDeletePartner} />
                )}
              </Group>
            )}
          </Group>
        )}

        {/* Details + Notes */}
        {!editingPartner && (
          <>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Paper p="md">
                <Title order={6} mb="md">Details</Title>
                <Stack gap="sm">
                  <Box>
                    <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb={4}>Website</Text>
                    <Text size="sm">
                      {partner.website ? (
                        <a href={partner.website} target="_blank" rel="noopener noreferrer">
                          {partner.website}
                        </a>
                      ) : '-'}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb={4}>Address</Text>
                    <Text size="sm">{partner.address || '-'}</Text>
                  </Box>
                  <SimpleGrid cols={2}>
                    <Box>
                      <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb={4}>Created</Text>
                      <Text size="sm">{dayjs(partner.createdAt).format('DD MMM YYYY')}</Text>
                    </Box>
                    <Box>
                      <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb={4}>Updated</Text>
                      <Text size="sm">{dayjs(partner.updatedAt).format('DD MMM YYYY')}</Text>
                    </Box>
                  </SimpleGrid>
                </Stack>
              </Paper>

              <Paper p="md">
                <Title order={6} mb="md">Notes</Title>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }} c={partner.notes ? undefined : 'dimmed'}>
                  {partner.notes || 'No notes.'}
                </Text>
              </Paper>
            </SimpleGrid>

            {/* Contacts */}
            <Paper p="md">
              <Title order={6} mb="md">Contacts</Title>
              <ContactsEditor
                contacts={contactsValue}
                onChange={canEdit ? setContactsValue : undefined}
                onSave={canEdit ? handleSaveContacts : undefined}
                saving={contactsSaving}
              />
            </Paper>
          </>
        )}
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
  return { props: {} };
}
