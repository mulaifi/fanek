import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  disabled = false,
}: DynamicFormProps) {
  const t = useTranslations();

  function handleChange(fieldName: string, value: unknown) {
    onChange({ ...values, [fieldName]: value });
  }

  return (
    <div className="space-y-4">
      {fieldSchema.map((field) => {
        const value = values[field.name] ?? '';
        const error = errors[field.name];

        switch (field.type) {
          case 'select':
            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-destructive ms-1">*</span>}
                </Label>
                <Select
                  value={(value as string) || undefined}
                  onValueChange={(val) => handleChange(field.name, val === '__none__' ? '' : val)}
                  disabled={disabled}
                >
                  <SelectTrigger id={field.name}>
                    <SelectValue placeholder={t('common.selectOption')} />
                  </SelectTrigger>
                  <SelectContent>
                    {!field.required && (
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">{t('common.none')}</span>
                      </SelectItem>
                    )}
                    {(field.options || []).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            );

          case 'boolean':
            return (
              <div key={field.name} className="flex items-center gap-2">
                <Checkbox
                  id={field.name}
                  checked={Boolean(value)}
                  onCheckedChange={(checked) => handleChange(field.name, Boolean(checked))}
                  disabled={disabled}
                />
                <Label htmlFor={field.name}>{field.label}</Label>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            );

          case 'currency':
            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-destructive ms-1">*</span>}
                </Label>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-3 rounded-s-md border border-e-0 border-input bg-muted text-muted-foreground text-sm h-9">
                    {field.currencySymbol || '$'}
                  </span>
                  <Input
                    id={field.name}
                    type="number"
                    value={value === '' ? '' : Number(value)}
                    onChange={(e) =>
                      handleChange(
                        field.name,
                        e.target.value === '' ? '' : parseFloat(e.target.value)
                      )
                    }
                    min={0}
                    step="0.01"
                    className="rounded-s-none"
                    required={field.required}
                    disabled={disabled}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            );

          case 'number':
            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-destructive ms-1">*</span>}
                </Label>
                <Input
                  id={field.name}
                  type="number"
                  value={value === '' ? '' : Number(value)}
                  onChange={(e) =>
                    handleChange(
                      field.name,
                      e.target.value === '' ? '' : parseFloat(e.target.value)
                    )
                  }
                  required={field.required}
                  disabled={disabled}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            );

          case 'date':
            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-destructive ms-1">*</span>}
                </Label>
                <Input
                  id={field.name}
                  type="date"
                  value={value as string}
                  onChange={(e) => handleChange(field.name, e.currentTarget.value)}
                  required={field.required}
                  disabled={disabled}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            );

          default: // text
            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-destructive ms-1">*</span>}
                </Label>
                <Input
                  id={field.name}
                  type="text"
                  value={value as string}
                  onChange={(e) => handleChange(field.name, e.currentTarget.value)}
                  required={field.required}
                  disabled={disabled}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            );
        }
      })}
    </div>
  );
}
