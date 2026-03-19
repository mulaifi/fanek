import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { ServiceTypeFieldInput } from '@/lib/validation';

interface ServiceTypeEditorProps {
  fieldSchema?: ServiceTypeFieldInput[];
  onChange: (fieldSchema: ServiceTypeFieldInput[]) => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (dropdown)' },
  { value: 'currency', label: 'Currency' },
  { value: 'boolean', label: 'Checkbox (Yes/No)' },
];

function newField(): ServiceTypeFieldInput {
  return { name: '', label: '', type: 'text', required: false, options: [] };
}

let globalNextId = 0;

export default function ServiceTypeEditor({ fieldSchema = [], onChange }: ServiceTypeEditorProps) {
  const t = useTranslations();
  const [fieldKeys, setFieldKeys] = useState<string[]>(() =>
    fieldSchema.map(() => `field-${globalNextId++}`)
  );
  const nextIdRef = useRef(globalNextId);

  // Ensure keys array stays in sync with fieldSchema length
  const getKeys = useCallback(() => {
    if (fieldKeys.length < fieldSchema.length) {
      const newKeys = [...fieldKeys];
      while (newKeys.length < fieldSchema.length) {
        newKeys.push(`field-${nextIdRef.current++}`);
      }
      setFieldKeys(newKeys);
      return newKeys;
    }
    if (fieldKeys.length > fieldSchema.length) {
      const trimmed = fieldKeys.slice(0, fieldSchema.length);
      setFieldKeys(trimmed);
      return trimmed;
    }
    return fieldKeys;
  }, [fieldKeys, fieldSchema.length]);

  const currentKeys = getKeys();

  function addField() {
    const newKey = `field-${nextIdRef.current++}`;
    setFieldKeys((prev) => [...prev, newKey]);
    onChange([...fieldSchema, newField()]);
  }

  function removeField(index: number) {
    setFieldKeys((prev) => prev.filter((_, i) => i !== index));
    onChange(fieldSchema.filter((_, i) => i !== index));
  }

  function updateField(index: number, updated: ServiceTypeFieldInput) {
    onChange(fieldSchema.map((f, i) => (i === index ? updated : f)));
  }

  function moveField(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= fieldSchema.length) return;
    const next = [...fieldSchema];
    [next[index], next[target]] = [next[target], next[index]];
    setFieldKeys((prev) => {
      const newKeys = [...prev];
      [newKeys[index], newKeys[target]] = [newKeys[target], newKeys[index]];
      return newKeys;
    });
    onChange(next);
  }

  function handleOptionsChange(index: number, value: string) {
    const opts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateField(index, { ...fieldSchema[index], options: opts });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        {t('admin.serviceCatalog.fieldSchemaHint')}
      </p>

      {fieldSchema.length === 0 && (
        <p className="text-sm text-muted-foreground mb-4">
          {t('admin.serviceCatalog.noFieldsDefined')}
        </p>
      )}

      {fieldSchema.map((field, index) => (
        <Card key={currentKeys[index]} className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{t('admin.serviceCatalog.fieldN', { n: index + 1 })}</span>
              <TooltipProvider>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveField(index, -1)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('common.moveUp')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveField(index, 1)}
                        disabled={index === fieldSchema.length - 1}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('common.moveDown')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeField(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('admin.serviceCatalog.removeField')}</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <Label>{t('admin.serviceCatalog.fieldName')}</Label>
                <Input
                  value={field.name}
                  onChange={(e) =>
                    updateField(index, {
                      ...field,
                      name: e.currentTarget.value.replace(/\s/g, '_').toLowerCase(),
                    })
                  }
                  placeholder="e.g. contract_value"
                />
                <p className="text-xs text-muted-foreground">{t('admin.serviceCatalog.fieldNameHint')}</p>
              </div>
              <div className="space-y-1">
                <Label>{t('admin.serviceCatalog.displayLabel')}</Label>
                <Input
                  value={field.label}
                  onChange={(e) => updateField(index, { ...field, label: e.currentTarget.value })}
                  placeholder="e.g. Contract Value"
                />
              </div>
              <div className="space-y-1">
                <Label>{t('admin.serviceCatalog.fieldType')}</Label>
                <Select
                  value={field.type}
                  onValueChange={(val) =>
                    updateField(index, {
                      ...field,
                      type: val as ServiceTypeFieldInput['type'],
                      options: [],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((ft) => (
                      <SelectItem key={ft.value} value={ft.value}>
                        {ft.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <Checkbox
                id={`field-required-${index}`}
                checked={field.required}
                onCheckedChange={(checked) =>
                  updateField(index, { ...field, required: Boolean(checked) })
                }
              />
              <Label htmlFor={`field-required-${index}`} className="text-xs">
                {t('admin.serviceCatalog.fieldRequired')}
              </Label>
            </div>

            {field.type === 'select' && (
              <div className="mt-3 space-y-2">
                <div className="space-y-1">
                  <Label>{t('admin.serviceCatalog.fieldOptions')}</Label>
                  <Input
                    value={(field.options || []).join(', ')}
                    onChange={(e) => handleOptionsChange(index, e.currentTarget.value)}
                    placeholder="Option A, Option B, Option C"
                  />
                  <p className="text-xs text-muted-foreground">{t('admin.serviceCatalog.fieldOptionsHint')}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(field.options || []).map((opt) => (
                    <Badge key={opt} variant="secondary" className="text-xs">
                      {opt}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" size="sm" onClick={addField}>
        <Plus className="h-3.5 w-3.5 me-1.5" />
        {t('admin.serviceCatalog.addField')}
      </Button>
    </div>
  );
}
