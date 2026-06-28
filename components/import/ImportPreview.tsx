import { useTranslations } from 'next-intl';
import type { ImportReport } from '@/lib/import';
import { Badge } from '@/components/ui/badge';

export default function ImportPreview({ report }: { report: ImportReport }) {
  const t = useTranslations('import');
  return (
    <div className="space-y-3" data-testid="import-preview">
      <div className="flex gap-2">
        <Badge variant="outline">{t('rowsTotal', { count: report.totalRows })}</Badge>
        <Badge variant="outline">{t('rowsValid', { count: report.validCount })}</Badge>
        <Badge variant={report.errorCount ? 'destructive' : 'outline'}>
          {t('rowsError', { count: report.errorCount })}
        </Badge>
      </div>
      {report.errorCount > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr><th className="text-left">{t('rowNumber')}</th><th className="text-left">{t('status')}</th><th className="text-left">{t('errors')}</th></tr>
          </thead>
          <tbody>
            {report.rows.filter((r) => r.status !== 'valid').map((r) => (
              <tr key={r.index} data-testid="error-row">
                <td>{r.index + 1}</td>
                <td>{r.status}</td>
                <td>{r.errors.join('; ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
