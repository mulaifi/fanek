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
  Tabs,
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
  IconPlus,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import AppShell from '@/components/AppShell';
import ContactsEditor from '@/components/ContactsEditor';
import DynamicForm from '@/components/DynamicForm';
import DynamicFieldDisplay from '@/components/DynamicFieldDisplay';
import { statusColors } from '@/lib/theme';

const DEFAULT_STATUSES = ['Active', 'Inactive', 'Suspended', 'Prospect', 'Churned'];

function EditCustomerForm({ customer, statuses, onSave, onClose }) {
  const form = useForm({
    initialValues: {
      name: customer.name || '',
      clientCode: customer.clientCode || '',
      status: customer.status || 'Active',
      vertical: customer.vertical || '',
      website: customer.website || '',
      address: customer.address || '',
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      website: (v) =>
        !v || /^https?:\/\/.+/.test(v) ? null : 'Website must start with http:// or https://',
    },
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleSubmit(values) {
    setSaveError('');
    setSaving(true);
    const payload = { ...values };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') payload[k] = null;
    });
    const res = await fetch(`/api/customers/${customer.id}`, {
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

  const statusSelectData = statuses.map((s) => ({ value: s, label: s }));

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
            <TextInput label="Customer Name" required {...form.getInputProps('name')} />
            <TextInput label="Client Code" {...form.getInputProps('clientCode')} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label="Status" data={statusSelectData} required {...form.getInputProps('status')} />
            <TextInput label="Vertical" {...form.getInputProps('vertical')} />
          </SimpleGrid>
          <TextInput label="Website" placeholder="https://example.com" {...form.getInputProps('website')} />
          <Textarea label="Address" rows={2} {...form.getInputProps('address')} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" color="brand" loading={saving}>Save Changes</Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}

function AddServiceForm({ customerId, serviceTypes, onAdd, onClose }) {
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [serviceFields, setServiceFields] = useState({});
  const [serviceErrors, setServiceErrors] = useState({});
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const selectedType = serviceTypes.find((t) => t.id === selectedTypeId);

  async function handleAdd() {
    setAddError('');
    if (!selectedTypeId) {
      setServiceErrors({ type: 'Please select a service type' });
      return;
    }
    const errs = {};
    (selectedType?.fieldSchema || []).forEach((f) => {
      if (f.required && !serviceFields[f.name]) {
        errs[f.name] = `${f.label} is required`;
      }
    });
    if (Object.keys(errs).length > 0) {
      setServiceErrors(errs);
      return;
    }
    setServiceErrors({});
    setAdding(true);
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, serviceTypeId: selectedTypeId, fieldValues: serviceFields }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) {
      setAddError(data.error || 'Failed to add service');
    } else {
      onAdd({ ...data, serviceType: selectedType });
    }
  }

  const typeSelectData = serviceTypes.map((t) => ({ value: t.id, label: t.name }));

  return (
    <Paper withBorder p="md" mb="md" style={{ borderColor: 'var(--mantine-color-brand-5)', borderWidth: 2 }}>
      <Stack gap="sm">
        <Text fw={600} size="sm">Add New Service</Text>
        {addError && (
          <Alert color="red" title="Error">
            {addError}
          </Alert>
        )}
        <Select
          label="Service Type"
          placeholder="Select a service type"
          data={typeSelectData}
          value={selectedTypeId}
          onChange={(v) => {
            setSelectedTypeId(v || '');
            setServiceFields({});
            setServiceErrors({});
          }}
          error={serviceErrors.type}
          required
        />
        {selectedType && (
          <DynamicForm
            fieldSchema={selectedType.fieldSchema || []}
            values={serviceFields}
            onChange={setServiceFields}
            errors={serviceErrors}
          />
        )}
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="brand" loading={adding} onClick={handleAdd}>Add Service</Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function EditServiceForm({ service, onSave, onClose }) {
  const [serviceFields, setServiceFields] = useState(service.fieldValues || {});
  const [serviceErrors, setServiceErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fieldSchema = service.serviceType?.fieldSchema || [];

  async function handleSave() {
    setSaveError('');
    const errs = {};
    fieldSchema.forEach((f) => {
      if (f.required && !serviceFields[f.name]) {
        errs[f.name] = `${f.label} is required`;
      }
    });
    if (Object.keys(errs).length > 0) {
      setServiceErrors(errs);
      return;
    }
    setServiceErrors({});
    setSaving(true);
    const res = await fetch(`/api/services/${service.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldValues: serviceFields }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setSaveError(data.error || 'Failed to update service');
    } else {
      onSave({ ...data, serviceType: service.serviceType });
    }
  }

  return (
    <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-brand-5)', borderWidth: 2 }}>
      <Stack gap="sm">
        <Text fw={600} size="sm">Edit {service.serviceType?.name || 'Service'}</Text>
        {saveError && (
          <Alert color="red" title="Error">
            {saveError}
          </Alert>
        )}
        <DynamicForm
          fieldSchema={fieldSchema}
          values={serviceFields}
          onChange={setServiceFields}
          errors={serviceErrors}
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="brand" loading={saving} onClick={handleSave}>Save Changes</Button>
        </Group>
      </Stack>
    </Paper>
  );
}

/** Two-click inline delete button with 3-second auto-revert */
function InlineDeleteButton({ onConfirm, label = 'Delete', size = 'lg', iconSize = 16 }) {
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
    <ActionIcon variant="default" size={size} color="red" onClick={startConfirm} title={label}>
      <IconTrash size={iconSize} />
    </ActionIcon>
  );
}

/** Small inline delete for service rows */
function InlineDeleteServiceButton({ onConfirm }) {
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
    <ActionIcon color="red" variant="subtle" onClick={startConfirm} title="Remove service">
      <IconTrash size={16} />
    </ActionIcon>
  );
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [serviceTypes, setServiceTypes] = useState([]);

  const [notesValue, setNotesValue] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [contactsValue, setContactsValue] = useState([]);
  const [contactsSaving, setContactsSaving] = useState(false);

  // Inline editing states
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [addingService, setAddingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);

  const canEdit = ['ADMIN', 'EDITOR'].includes(session?.user?.role);
  const isAdmin = session?.user?.role === 'ADMIN';

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/customers/${id}`).then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/service-types?active=true').then((r) => r.json()),
    ])
      .then(([customerData, settingsData, stData]) => {
        if (customerData.error) {
          setError(customerData.error);
        } else {
          setCustomer(customerData);
          setNotesValue(customerData.notes || '');
          setContactsValue(customerData.contacts || []);
        }
        if (settingsData.customerStatuses?.length) setStatuses(settingsData.customerStatuses);
        if (stData.data) setServiceTypes(stData.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load customer');
        setLoading(false);
      });
  }, [id]);

  async function handleDeleteCustomer() {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/customers');
      } else {
        const data = await res.json().catch(() => ({}));
        notifications.show({ title: 'Error', message: data.error || 'Failed to delete customer.', color: 'red' });
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Network error: failed to delete customer.', color: 'red' });
    }
  }

  async function handleDeleteService(svcId) {
    try {
      const res = await fetch(`/api/services/${svcId}`, { method: 'DELETE' });
      if (res.ok) {
        setCustomer((prev) => ({
          ...prev,
          services: prev.services.filter((s) => s.id !== svcId),
        }));
      } else {
        const data = await res.json().catch(() => ({}));
        notifications.show({ title: 'Error', message: data.error || 'Failed to remove service.', color: 'red' });
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Network error: failed to remove service.', color: 'red' });
    }
  }

  async function handleSaveContacts() {
    setContactsSaving(true);
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: contactsValue }),
    });
    const data = await res.json();
    setContactsSaving(false);
    if (res.ok) {
      setCustomer((prev) => ({ ...prev, contacts: data.contacts }));
      setContactsValue(data.contacts || []);
      notifications.show({ title: 'Contacts saved', message: 'Contacts updated.', color: 'green' });
    } else {
      notifications.show({ title: 'Error', message: 'Failed to save contacts.', color: 'red' });
    }
  }

  async function handleSaveNotes() {
    setNotesSaving(true);
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesValue }),
    });
    const data = await res.json();
    setNotesSaving(false);
    if (res.ok) {
      setCustomer((prev) => ({ ...prev, notes: data.notes }));
      notifications.show({ title: 'Notes saved', message: 'Notes updated.', color: 'green' });
    } else {
      notifications.show({ title: 'Error', message: 'Failed to save notes.', color: 'red' });
    }
  }

  if (loading) {
    return (
      <AppShell title="Customer">
        <Center mt="xl">
          <Loader />
        </Center>
      </AppShell>
    );
  }

  if (error || !customer) {
    return (
      <AppShell title="Customer">
        <Alert color="red" title="Error">
          {error || 'Customer not found'}
        </Alert>
      </AppShell>
    );
  }

  const servicesByType = (customer.services || []).reduce((acc, svc) => {
    const typeName = svc.serviceType?.name || 'Unknown';
    if (!acc[typeName]) acc[typeName] = [];
    acc[typeName].push(svc);
    return acc;
  }, {});

  return (
    <AppShell title={customer.name}>
      <Stack gap="md">
        {/* Header */}
        {editingCustomer ? (
          <Box>
            <Group gap="sm" mb="md">
              <ActionIcon variant="subtle" onClick={() => router.push('/customers')} mt={4}>
                <IconArrowLeft size={18} />
              </ActionIcon>
              <Title order={3}>Edit Customer</Title>
            </Group>
            <EditCustomerForm
              customer={customer}
              statuses={statuses}
              onSave={(data) => {
                setCustomer((prev) => ({ ...prev, ...data }));
                setEditingCustomer(false);
                notifications.show({ title: 'Saved', message: 'Customer updated.', color: 'green' });
              }}
              onClose={() => setEditingCustomer(false)}
            />
          </Box>
        ) : (
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Group gap="sm" align="flex-start">
              <ActionIcon variant="subtle" onClick={() => router.push('/customers')} mt={4}>
                <IconArrowLeft size={18} />
              </ActionIcon>
              <Box>
                <Title order={3}>{customer.name}</Title>
                <Group gap="xs" mt={4}>
                  {customer.clientCode && (
                    <Text size="sm" c="dimmed">
                      {customer.clientCode}
                    </Text>
                  )}
                  <Badge color={statusColors[customer.status] || 'gray'}>
                    {customer.status}
                  </Badge>
                </Group>
              </Box>
            </Group>
            {canEdit && (
              <Group gap="xs">
                <ActionIcon variant="default" size="lg" onClick={() => setEditingCustomer(true)} title="Edit">
                  <IconEdit size={16} />
                </ActionIcon>
                {isAdmin && (
                  <InlineDeleteButton onConfirm={handleDeleteCustomer} />
                )}
              </Group>
            )}
          </Group>
        )}

        {/* Tabs */}
        {!editingCustomer && (
          <Tabs defaultValue="info">
            <Tabs.List>
              <Tabs.Tab value="info">Info</Tabs.Tab>
              <Tabs.Tab value="services">Services ({customer.services?.length || 0})</Tabs.Tab>
              <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
              <Tabs.Tab value="notes">Notes</Tabs.Tab>
            </Tabs.List>

            {/* Info tab */}
            <Tabs.Panel value="info" pt="md">
              <Paper p="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Box>
                    <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb={4}>Vertical</Text>
                    <Text size="sm">{customer.vertical || '-'}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb={4}>Website</Text>
                    <Text size="sm">
                      {customer.website ? (
                        <a href={customer.website} target="_blank" rel="noopener noreferrer">
                          {customer.website}
                        </a>
                      ) : '-'}
                    </Text>
                  </Box>
                  <Box style={{ gridColumn: '1 / -1' }}>
                    <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb={4}>Address</Text>
                    <Text size="sm">{customer.address || '-'}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb={4}>Created</Text>
                    <Text size="sm">{dayjs(customer.createdAt).format('DD MMM YYYY')}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb={4}>Last Updated</Text>
                    <Text size="sm">{dayjs(customer.updatedAt).format('DD MMM YYYY')}</Text>
                  </Box>
                </SimpleGrid>
              </Paper>
            </Tabs.Panel>

            {/* Services tab */}
            <Tabs.Panel value="services" pt="md">
              <Stack gap="md">
                {canEdit && !addingService && (
                  <Group justify="flex-end">
                    <Button leftSection={<IconPlus size={16} />} color="brand" onClick={() => setAddingService(true)}>
                      Add Service
                    </Button>
                  </Group>
                )}
                {addingService && (
                  <AddServiceForm
                    customerId={id}
                    serviceTypes={serviceTypes}
                    onAdd={(newService) => {
                      setCustomer((prev) => ({
                        ...prev,
                        services: [newService, ...(prev.services || [])],
                      }));
                      setAddingService(false);
                      notifications.show({ title: 'Service added', message: 'Service was added.', color: 'green' });
                    }}
                    onClose={() => setAddingService(false)}
                  />
                )}
                {Object.keys(servicesByType).length === 0 && (
                  <Text c="dimmed">No services yet.</Text>
                )}
                {Object.entries(servicesByType).map(([typeName, services]) => (
                  <Box key={typeName}>
                    <Text fw={600} mb="xs">
                      {typeName}
                    </Text>
                    <Stack gap="xs">
                      {services.map((svc) => (
                        <Paper key={svc.id} p="md" withBorder>
                          {editingServiceId === svc.id ? (
                            <EditServiceForm
                              service={svc}
                              onSave={(updated) => {
                                setCustomer((prev) => ({
                                  ...prev,
                                  services: prev.services.map((s) => (s.id === updated.id ? updated : s)),
                                }));
                                setEditingServiceId(null);
                                notifications.show({ title: 'Updated', message: 'Service updated.', color: 'green' });
                              }}
                              onClose={() => setEditingServiceId(null)}
                            />
                          ) : (
                            <Group justify="space-between" align="flex-start">
                              <Box style={{ flex: 1 }}>
                                <DynamicFieldDisplay
                                  fieldSchema={svc.serviceType?.fieldSchema || []}
                                  values={svc.fieldValues || {}}
                                />
                                {!svc.serviceType?.fieldSchema?.length && (
                                  <Text size="sm" c="dimmed">
                                    No fields defined
                                  </Text>
                                )}
                                <Text size="xs" c="dimmed" mt="xs">
                                  Added {dayjs(svc.createdAt).format('DD MMM YYYY')}
                                </Text>
                              </Box>
                              {canEdit && (
                                <Group gap={4}>
                                  <ActionIcon
                                    variant="subtle"
                                    onClick={() => setEditingServiceId(svc.id)}
                                    title="Edit service"
                                  >
                                    <IconEdit size={16} />
                                  </ActionIcon>
                                  {isAdmin && (
                                    <InlineDeleteServiceButton onConfirm={() => handleDeleteService(svc.id)} />
                                  )}
                                </Group>
                              )}
                            </Group>
                          )}
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Tabs.Panel>

            {/* Contacts tab */}
            <Tabs.Panel value="contacts" pt="md">
              <ContactsEditor
                contacts={contactsValue}
                onChange={canEdit ? setContactsValue : undefined}
                onSave={canEdit ? handleSaveContacts : undefined}
                saving={contactsSaving}
              />
              {!canEdit && (
                <Text size="sm" c="dimmed" mt="xs">
                  You do not have permission to edit contacts.
                </Text>
              )}
            </Tabs.Panel>

            {/* Notes tab */}
            <Tabs.Panel value="notes" pt="md">
              <Stack gap="sm" maw={600}>
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  autosize
                  minRows={6}
                  readOnly={!canEdit}
                />
                {canEdit && (
                  <Group>
                    <Button color="brand" loading={notesSaving} onClick={handleSaveNotes}>
                      Save Notes
                    </Button>
                  </Group>
                )}
              </Stack>
            </Tabs.Panel>
          </Tabs>
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
