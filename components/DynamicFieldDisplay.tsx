import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import type { ServiceTypeFieldInput } from '@/lib/validation';

interface FieldValueProps {
  field: ServiceTypeFieldInput;
  value: unknown;
}

function FieldValue({ field, value }: FieldValueProps) {
  if (value === null || value === undefined || value === '') {
    return (
      <span className="text-sm text-muted-foreground">-</span>
    );
  }

  switch (field.type) {
    case 'boolean':
      return value ? (
        <Badge variant="secondary" className="gap-1 text-green-700 bg-green-100">
          <Check className="h-3 w-3" />
          Yes
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1 text-muted-foreground">
          <X className="h-3 w-3" />
          No
        </Badge>
      );

    case 'currency':
      return (
        <span className="text-sm">
          {field.currencySymbol || '$'}{Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );

    case 'date':
      return (
        <span className="text-sm">
          {new Date(value as string).toLocaleDateString()}
        </span>
      );

    case 'select':
      return (
        <Badge variant="secondary">{String(value)}</Badge>
      );

    default:
      return <span className="text-sm">{String(value)}</span>;
  }
}

interface DynamicFieldDisplayProps {
  fieldSchema?: ServiceTypeFieldInput[];
  values?: Record<string, unknown>;
}

export default function DynamicFieldDisplay({ fieldSchema = [], values = {} }: DynamicFieldDisplayProps) {
  if (!fieldSchema.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {fieldSchema.map((field) => (
        <div key={field.name}>
          <p className="text-xs text-muted-foreground font-semibold mb-1">
            {field.label}
          </p>
          <div>
            <FieldValue field={field} value={values[field.name]} />
          </div>
        </div>
      ))}
    </div>
  );
}
