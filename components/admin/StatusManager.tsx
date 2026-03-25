import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface StatusManagerProps {
  statuses?: string[];
  statusUsage?: Record<string, number>;
  onSave?: (data: unknown) => void;
}

export default function StatusManager({ statuses = [], statusUsage = {}, onSave }: StatusManagerProps) {
  const t = useTranslations();
  const [items, setItems] = useState(statuses);
  const [newStatus, setNewStatus] = useState('');
  const [newError, setNewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleAdd() {
    const trimmed = newStatus.trim();
    if (!trimmed) {
      setNewError(t('admin.settings.statusNameEmpty'));
      return;
    }
    if (items.includes(trimmed)) {
      setNewError(t('admin.settings.statusAlreadyExists'));
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
      setError(t('admin.settings.atLeastOneStatus'));
      return;
    }
    setSaving(true);
    let res: Response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerStatuses: items }),
      });
      data = await res.json();
    } catch {
      setSaving(false);
      setError('A network error occurred. Please try again.');
      return;
    }
    setSaving(false);
    if (!res.ok) {
      setError(data.error || t('admin.settings.failedToSaveStatuses'));
    } else {
      setSuccess(true);
      onSave?.(data);
    }
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{t('admin.settings.statusesSaved')}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground mb-4">
        {t('admin.settings.statusesHint')}
      </p>

      <div className="space-y-2 mb-4">
        {items.map((status, index) => {
          const usageCount = statusUsage?.[status] || 0;
          const inUse = usageCount > 0;
          const removeTooltip = inUse
            ? t('admin.settings.cannotRemoveStatus', { count: usageCount })
            : t('admin.settings.removeStatus');

          return (
            <TooltipProvider key={index}>
              <div className="flex items-center gap-2">
                <Input
                  value={status}
                  onChange={(e) => handleUpdate(index, e.currentTarget.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => !inUse && handleRemove(status)}
                      disabled={inUse}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{removeTooltip}</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          );
        })}
      </div>

      <div className="flex items-start gap-2 mb-6">
        <div className="space-y-1">
          <Input
            placeholder={t('admin.settings.newStatusPlaceholder')}
            value={newStatus}
            onChange={(e) => setNewStatus(e.currentTarget.value)}
            className="w-[200px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          {newError && <p className="text-sm text-destructive">{newError}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5 me-1.5" />
          {t('common.add')}
        </Button>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? t('common.saving') : t('admin.settings.saveStatuses')}
      </Button>
    </div>
  );
}
