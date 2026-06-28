import { useTranslations } from 'next-intl';
import type { FieldTarget } from '@/lib/import';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  headers: string[];
  targets: FieldTarget[];
  mapping: Record<string, string | null>;
  onChange: (col: string, field: string | null) => void;
}

const IGNORE = '__ignore__';

export default function ColumnMapper({ headers, targets, mapping, onChange }: Props) {
  const t = useTranslations('import');
  return (
    <div className="space-y-2">
      {headers.map((h) => (
        <div key={h} className="flex items-center gap-3" data-testid="map-row">
          <span className="w-1/2 truncate font-medium">{h}</span>
          <Select
            value={mapping[h] ?? IGNORE}
            onValueChange={(v) => onChange(h, v === IGNORE ? null : v)}
          >
            <SelectTrigger className="w-1/2" data-testid={`map-select-${h}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={IGNORE}>{t('ignore')}</SelectItem>
              {targets.map((tg) => (
                <SelectItem key={tg.field} value={tg.field}>
                  {tg.label}{tg.required ? ' *' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
