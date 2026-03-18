import { useState } from 'react';
import { ActionIcon, Alert, Box, Button, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react';

interface StatusManagerProps {
  statuses?: string[];
  statusUsage?: Record<string, number>;
  onSave?: (data: unknown) => void;
}

export default function StatusManager({ statuses = [], statusUsage = {}, onSave }: StatusManagerProps) {
  const [items, setItems] = useState(statuses);
  const [newStatus, setNewStatus] = useState('');
  const [newError, setNewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleAdd() {
    const trimmed = newStatus.trim();
    if (!trimmed) {
      setNewError('Status name cannot be empty');
      return;
    }
    if (items.includes(trimmed)) {
      setNewError('This status already exists');
      return;
    }
    setItems([...items, trimmed]);
    setNewStatus('');
    setNewError('');
  }

  function handleRemove(status: string) {
    setItems(items.filter((s) => s !== status));
  }

  function handleUpdate(index: number, value: string) {
    setItems(items.map((s, i) => (i === index ? value : s)));
  }

  function moveItem(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  }

  async function handleSave() {
    setError('');
    setSuccess(false);
    if (items.length === 0) {
      setError('At least one status is required');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerStatuses: items }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Failed to save statuses');
    } else {
      setSuccess(true);
      onSave?.(data);
    }
  }

  return (
    <Box>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {success && (
        <Alert color="green" mb="md">
          Customer statuses saved.
        </Alert>
      )}

      <Text size="sm" c="dimmed" mb="md">
        Define the allowed customer status values. Statuses in use by customers cannot be removed.
      </Text>

      <Stack gap="xs" mb="md">
        {items.map((status, index) => {
          const usageCount = statusUsage?.[status] || 0;
          const inUse = usageCount > 0;
          const removeTooltip = inUse
            ? `Cannot remove: ${usageCount} customer${usageCount !== 1 ? 's' : ''} use this status`
            : 'Remove status';

          return (
            <Group key={index} gap="xs" align="center">
              <TextInput
                value={status}
                onChange={(e) => handleUpdate(index, e.currentTarget.value)}
                size="sm"
                style={{ flex: 1 }}
              />
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
              >
                <IconArrowUp size={14} />
              </ActionIcon>
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
              >
                <IconArrowDown size={14} />
              </ActionIcon>
              <Tooltip label={removeTooltip} disabled={!inUse}>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={() => !inUse && handleRemove(status)}
                  disabled={inUse}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          );
        })}
      </Stack>

      <Group align="flex-start" mb="lg">
        <TextInput
          placeholder="e.g. On Hold"
          value={newStatus}
          onChange={(e) => setNewStatus(e.currentTarget.value)}
          error={newError}
          size="sm"
          style={{ width: 200 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button variant="light" leftSection={<IconPlus size={14} />} onClick={handleAdd} size="sm">
          Add
        </Button>
      </Group>

      <Button onClick={handleSave} loading={saving}>
        {saving ? 'Saving...' : 'Save Statuses'}
      </Button>
    </Box>
  );
}
