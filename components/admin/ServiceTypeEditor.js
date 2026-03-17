import { ActionIcon, Badge, Box, Button, Checkbox, Group, Paper, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (dropdown)' },
  { value: 'currency', label: 'Currency' },
  { value: 'boolean', label: 'Checkbox (Yes/No)' },
];

function newField() {
  return { name: '', label: '', type: 'text', required: false, options: [] };
}

export default function ServiceTypeEditor({ fieldSchema = [], onChange }) {
  function addField() {
    onChange([...fieldSchema, newField()]);
  }

  function removeField(index) {
    onChange(fieldSchema.filter((_, i) => i !== index));
  }

  function updateField(index, updated) {
    onChange(fieldSchema.map((f, i) => (i === index ? updated : f)));
  }

  function moveField(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= fieldSchema.length) return;
    const next = [...fieldSchema];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function handleOptionsChange(index, value) {
    const opts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateField(index, { ...fieldSchema[index], options: opts });
  }

  return (
    <Box>
      <Text size="sm" c="dimmed" mb="md">
        Define the fields for this service type. Field names must be unique and use only letters, numbers, and underscores.
      </Text>

      {fieldSchema.length === 0 && (
        <Text size="sm" c="dimmed" mb="md">
          No fields defined. Add a field to get started.
        </Text>
      )}

      {fieldSchema.map((field, index) => (
        <Paper key={index} withBorder p="md" mb="md">
          <Group justify="space-between" align="center" mb="sm">
            <Text size="sm" c="dimmed">
              Field {index + 1}
            </Text>
            <Group gap={4}>
              <Tooltip label="Move up">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => moveField(index, -1)}
                  disabled={index === 0}
                >
                  <IconArrowUp size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Move down">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => moveField(index, 1)}
                  disabled={index === fieldSchema.length - 1}
                >
                  <IconArrowDown size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Remove field">
                <ActionIcon size="sm" variant="subtle" color="red" onClick={() => removeField(index)}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <Group align="flex-end" grow>
            <TextInput
              label="Field Name"
              value={field.name}
              onChange={(e) =>
                updateField(index, {
                  ...field,
                  name: e.currentTarget.value.replace(/\s/g, '_').toLowerCase(),
                })
              }
              size="sm"
              placeholder="e.g. contract_value"
              description="Unique identifier, no spaces"
            />
            <TextInput
              label="Display Label"
              value={field.label}
              onChange={(e) => updateField(index, { ...field, label: e.currentTarget.value })}
              size="sm"
              placeholder="e.g. Contract Value"
            />
            <Select
              label="Type"
              value={field.type}
              onChange={(val) => updateField(index, { ...field, type: val, options: [] })}
              data={FIELD_TYPES}
              size="sm"
            />
            <Checkbox
              label={<Text size="xs">Req.</Text>}
              checked={field.required}
              onChange={(e) => updateField(index, { ...field, required: e.currentTarget.checked })}
              mt="xl"
            />
          </Group>

          {field.type === 'select' && (
            <Box mt="sm">
              <TextInput
                label="Options (comma-separated)"
                value={(field.options || []).join(', ')}
                onChange={(e) => handleOptionsChange(index, e.currentTarget.value)}
                size="sm"
                placeholder="Option A, Option B, Option C"
                description="Enter options separated by commas"
              />
              <Group gap={4} mt="xs" style={{ flexWrap: 'wrap' }}>
                {(field.options || []).map((opt) => (
                  <Badge key={opt} variant="light" size="sm">
                    {opt}
                  </Badge>
                ))}
              </Group>
            </Box>
          )}
        </Paper>
      ))}

      <Button variant="light" leftSection={<IconPlus size={14} />} onClick={addField} size="sm">
        Add Field
      </Button>
    </Box>
  );
}
