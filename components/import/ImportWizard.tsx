import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  parseRows, autoMap, CUSTOMER_FIELDS, serviceFieldTargets,
  type FieldTarget, type ImportFormat, type ImportReport,
} from '@/lib/import';
import type { ServiceTypeFieldInput } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import ColumnMapper from './ColumnMapper';
import ImportPreview from './ImportPreview';

export interface ServiceTypeLite { id: string; name: string; fieldSchema: ServiceTypeFieldInput[] }

interface Props {
  entity: 'customer' | 'service';
  serviceTypes?: ServiceTypeLite[];
}

export default function ImportWizard({ entity, serviceTypes = [] }: Props) {
  const t = useTranslations('import');
  const [format, setFormat] = useState<ImportFormat>('csv');
  const [raw, setRaw] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  const targets: FieldTarget[] = useMemo(() => {
    if (entity === 'customer') return CUSTOMER_FIELDS;
    const st = serviceTypes.find((s) => s.id === serviceTypeId);
    return st ? serviceFieldTargets(st.fieldSchema) : [];
  }, [entity, serviceTypeId, serviceTypes]);

  const onFile = useCallback(async (file: File) => {
    const text = await file.text();
    const fmt: ImportFormat = file.name.endsWith('.json') ? 'json' : 'csv';
    try {
      const parsed = parseRows(fmt, text);
      setFormat(fmt);
      setRaw(text);
      setHeaders(parsed.headers);
      setMapping(autoMap(parsed.headers, targets));
      setReport(null);
    } catch (err) {
      if (err instanceof Error && /too many rows/i.test(err.message)) {
        toast.error(t('tooManyRows'));
      } else {
        toast.error(err instanceof Error ? err.message : t('genericError'));
      }
    }
  }, [targets, t]);

  const endpoint = entity === 'customer' ? '/api/import/customers' : '/api/import/services';

  const call = useCallback(async (dryRun: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, data: raw, mapping, dryRun, ...(entity === 'service' ? { serviceTypeId } : {}) }),
      });
      const body = await res.json();
      if (!res.ok && res.status !== 400) { toast.error(body.error ?? t('genericError')); return; }
      setReport(body);
      if (!dryRun && body.committed != null) toast.success(t('successTitle', { count: body.committed }));
    } catch {
      toast.error(t('genericError'));
    } finally {
      setBusy(false);
    }
  }, [endpoint, format, raw, mapping, entity, serviceTypeId, t]);

  const needType = entity === 'service' && !serviceTypeId;

  return (
    <div className="space-y-4">
      {entity === 'service' && (
        <select
          data-testid="service-type-select"
          className="border rounded p-2"
          value={serviceTypeId}
          onChange={(e) => { setServiceTypeId(e.target.value); setHeaders([]); setReport(null); }}
        >
          <option value="">{t('selectServiceTypePlaceholder')}</option>
          {serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      <div>
        <input
          key={serviceTypeId || 'default'}
          type="file"
          accept=".csv,.json"
          data-testid="import-file"
          disabled={needType}
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <p className="text-xs text-muted-foreground">{t('csvContactsNote')}</p>
      </div>

      {headers.length > 0 && (
        <>
          <ColumnMapper
            headers={headers}
            targets={targets}
            mapping={mapping}
            onChange={(col, field) => { setMapping((m) => ({ ...m, [col]: field })); setReport(null); }}
          />
          <Button onClick={() => call(true)} disabled={busy} data-testid="preview-btn">{t('preview')}</Button>
        </>
      )}

      {report && (
        <>
          <ImportPreview report={report} />
          <Button
            onClick={() => call(false)}
            disabled={busy || !report.canCommit}
            data-testid="commit-btn"
          >
            {report.canCommit ? t('commit', { count: report.validCount }) : t('commitDisabled')}
          </Button>
        </>
      )}
    </div>
  );
}
