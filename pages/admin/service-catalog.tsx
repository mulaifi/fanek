// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth/options';
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconPencil, IconTrash } from '@tabler/icons-react';
import AppShell from '@/components/AppShell';
import ServiceTypeEditor from '@/components/admin/ServiceTypeEditor';

function emptyServiceType() {
  return { name: '', description: '', icon: '', active: true, fieldSchema: [] };
}

/** Two-click inline delete button with 3-second auto-revert */
function InlineDeleteButton({ onConfirm, disabled }) {
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
    <Button
      variant="subtle"
      size="xs"
      color="red"
      leftSection={<IconTrash size={14} />}
      disabled={disabled}
      onClick={startConfirm}
    >
      Delete
    </Button>
  );
}

export default function ServiceCatalogPage() {
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Inline editing states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState(null);

  async function loadServiceTypes() {
    setLoading(true);
    const res = await fetch('/api/service-types');
    const data = await res.json();
    setLoading(false);
    if (res.ok) setServiceTypes(data.data || []);
    else setError(data.error || 'Failed to load service types');
  }

  useEffect(() => {
    loadServiceTypes();
  }, []);

  async function handleDelete(st) {
    const res = await fetch(`/api/service-types/${st.id}`, { method: 'DELETE' });
    if (res.ok) {
      setServiceTypes((prev) => prev.filter((s) => s.id !== st.id));
      notifications.show({ color: 'green', message: 'Service type deleted.' });
    } else {
      const data = await res.json();
      notifications.show({ color: 'red', message: data.error || 'Failed to delete.' });
    }
  }

  return (
    <AppShell title="Service Catalog">
      {error && <Alert color="red" mb="md">{error}</Alert>}

      <Group justify="flex-end" mb="md">
        {!showCreateForm && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => { setShowCreateForm(true); setEditingTypeId(null); }}>
            New Service Type
          </Button>
        )}
      </Group>

      {/* Inline create form */}
      {showCreateForm && (
        <Paper withBorder p="md" mb="md" style={{ borderColor: 'var(--mantine-color-brand-5)', borderWidth: 2 }}>
          <Text fw={600} size="sm" mb="md">New Service Type</Text>
          <ServiceTypeForm
            initial={emptyServiceType()}
            editingType={null}
            onClose={() => setShowCreateForm(false)}
            onSuccess={() => {
              setShowCreateForm(false);
              loadServiceTypes();
            }}
          />
        </Paper>
      )}

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Fields</Table.Th>
            <Table.Th>Services</Table.Th>
            <Table.Th style={{ whiteSpace: 'nowrap' }}>Status</Table.Th>
            <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading && (
            <Table.Tr>
              <Table.Td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                Loading...
              </Table.Td>
            </Table.Tr>
          )}
          {!loading && serviceTypes.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                <Text size="sm" c="dimmed">No service types defined yet</Text>
              </Table.Td>
            </Table.Tr>
          )}
          {serviceTypes.map((st) => (
            editingTypeId === st.id ? (
              <Table.Tr key={st.id}>
                <Table.Td colSpan={6} style={{ padding: '1rem' }}>
                  <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-brand-5)', borderWidth: 2 }}>
                    <Text fw={600} size="sm" mb="md">Edit: {st.name}</Text>
                    <ServiceTypeForm
                      initial={{
                        name: st.name || '',
                        description: st.description || '',
                        icon: st.icon || '',
                        active: st.active !== false,
                        fieldSchema: st.fieldSchema || [],
                      }}
                      editingType={st}
                      onClose={() => setEditingTypeId(null)}
                      onSuccess={() => {
                        setEditingTypeId(null);
                        loadServiceTypes();
                      }}
                    />
                  </Paper>
                </Table.Td>
              </Table.Tr>
            ) : (
              <Table.Tr key={st.id} style={{ cursor: 'pointer' }} onClick={() => { setEditingTypeId(st.id); setShowCreateForm(false); }}>
                <Table.Td>
                  <Text fw={500}>
                    {st.name}
                  </Text>
                </Table.Td>
                <Table.Td>{st.description || '-'}</Table.Td>
                <Table.Td>
                  <Badge variant="light">{(st.fieldSchema || []).length} fields</Badge>
                </Table.Td>
                <Table.Td>{st._count?.services ?? 0}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={st.active ? 'green' : 'gray'}>
                    {st.active ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Group gap={4} justify="flex-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<IconPencil size={14} />}
                      onClick={() => { setEditingTypeId(st.id); setShowCreateForm(false); }}
                    >
                      Edit
                    </Button>
                    <InlineDeleteButton
                      onConfirm={() => handleDelete(st)}
                      disabled={st._count?.services > 0}
                    />
                  </Group>
                </Table.Td>
              </Table.Tr>
            )
          ))}
        </Table.Tbody>
      </Table>
    </AppShell>
  );
}

function ServiceTypeForm({ initial, editingType, onClose, onSuccess }) {
  const [form, setForm] = useState(initial);
  const [formErrors, setFormErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaveError('');
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setFormErrors({});
    setSaving(true);

    const url = editingType ? `/api/service-types/${editingType.id}` : '/api/service-types';
    const method = editingType ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setSaveError(data.error || 'Failed to save');
    } else {
      onSuccess();
    }
  }

  return (
    <Stack>
      {saveError && <Alert color="red">{saveError}</Alert>}
      <Group align="flex-start">
        <TextInput
          label="Service Type Name"
          required
          style={{ flex: 1 }}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={formErrors.name}
        />
        <TextInput
          label="Icon (emoji)"
          style={{ width: 100 }}
          placeholder="e.g. ☁️"
          value={form.icon}
          onChange={(e) => setForm({ ...form, icon: e.target.value })}
        />
      </Group>
      <Textarea
        label="Description"
        rows={2}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <Switch
        label="Active (visible when adding services)"
        checked={form.active}
        onChange={(e) => setForm({ ...form, active: e.currentTarget.checked })}
      />

      <Text fw={600} size="sm" mt="sm">Field Schema</Text>
      <ServiceTypeEditor
        fieldSchema={form.fieldSchema}
        onChange={(fieldSchema) => setForm({ ...form, fieldSchema })}
      />

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>
          {editingType ? 'Save Changes' : 'Create Service Type'}
        </Button>
      </Group>
    </Stack>
  );
}

export async function getServerSideProps(context) {
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
