import { Badge, Box, SimpleGrid, Text } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

function FieldValue({ field, value }) {
  if (value === null || value === undefined || value === '') {
    return (
      <Text size="sm" c="dimmed">
        -
      </Text>
    );
  }

  switch (field.type) {
    case 'boolean':
      return value ? (
        <Badge variant="light" color="green" leftSection={<IconCheck size={12} />}>
          Yes
        </Badge>
      ) : (
        <Badge variant="light" color="gray" leftSection={<IconX size={12} />}>
          No
        </Badge>
      );

    case 'currency':
      return (
        <Text size="sm">
          ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      );

    case 'date':
      return (
        <Text size="sm">
          {new Date(value).toLocaleDateString()}
        </Text>
      );

    case 'select':
      return (
        <Badge variant="light">{String(value)}</Badge>
      );

    default:
      return <Text size="sm">{String(value)}</Text>;
  }
}

export default function DynamicFieldDisplay({ fieldSchema = [], values = {} }) {
  if (!fieldSchema.length) return null;

  return (
    <SimpleGrid cols={2}>
      {fieldSchema.map((field) => (
        <Box key={field.name}>
          <Text size="xs" c="dimmed" fw={600}>
            {field.label}
          </Text>
          <Box mt={2}>
            <FieldValue field={field} value={values[field.name]} />
          </Box>
        </Box>
      ))}
    </SimpleGrid>
  );
}
