import { Checkbox, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import type { ServiceTypeFieldInput } from '@/lib/validation';

interface DynamicFormProps {
  fieldSchema?: ServiceTypeFieldInput[];
  values?: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export default function DynamicForm({
  fieldSchema = [],
  values = {},
  onChange,
  errors = {},
}: DynamicFormProps) {
  function handleChange(fieldName: string, value: unknown) {
    onChange({ ...values, [fieldName]: value });
  }

  return (
    <Stack gap="sm">
      {fieldSchema.map((field) => {
        const value = values[field.name] ?? '';
        const error = errors[field.name];

        switch (field.type) {
          case 'select':
            return (
              <Select
                key={field.name}
                label={field.label}
                value={(value as string) || null}
                onChange={(val) => handleChange(field.name, val ?? '')}
                data={field.options || []}
                clearable={!field.required}
                error={error}
                required={field.required}
              />
            );

          case 'boolean':
            return (
              <Checkbox
                key={field.name}
                label={field.label}
                checked={Boolean(value)}
                onChange={(e) => handleChange(field.name, e.currentTarget.checked)}
                error={error}
              />
            );

          case 'currency':
            return (
              <NumberInput
                key={field.name}
                label={field.label}
                value={value === '' ? undefined : Number(value)}
                onChange={(val) => handleChange(field.name, val)}
                error={error}
                required={field.required}
                min={0}
                decimalScale={2}
                fixedDecimalScale
                leftSection={<Text size="sm" c="dimmed">{field.currencySymbol || '$'}</Text>}
              />
            );

          case 'number':
            return (
              <NumberInput
                key={field.name}
                label={field.label}
                value={value === '' ? undefined : Number(value)}
                onChange={(val) => handleChange(field.name, val)}
                error={error}
                required={field.required}
              />
            );

          case 'date':
            return (
              <TextInput
                key={field.name}
                label={field.label}
                type="date"
                value={value as string}
                onChange={(e) => handleChange(field.name, e.currentTarget.value)}
                error={error}
                required={field.required}
              />
            );

          default: // text
            return (
              <TextInput
                key={field.name}
                label={field.label}
                type="text"
                value={value as string}
                onChange={(e) => handleChange(field.name, e.currentTarget.value)}
                error={error}
                required={field.required}
              />
            );
        }
      })}
    </Stack>
  );
}
