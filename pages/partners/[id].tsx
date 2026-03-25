import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslations, useFormatter } from 'next-intl';
import { getAuthOptions } from '@/lib/auth/options';
import type { ContactInput } from '@/lib/validation';
import { ArrowLeft, Edit, Trash, Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import ContactsEditor from '@/components/ContactsEditor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PARTNER_TYPES = ['Reseller', 'Distributor', 'Technology', 'Service', 'Referral', 'Other'];

const TYPE_COLORS: Record<string, string> = {
  Reseller: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Distributor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  Technology: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  Service: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  Referral: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  Other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

interface PartnerShape {
  id: string;
  name: string;
  type?: string | null;
  website?: string | null;
  address?: string | null;
  notes?: string | null;
  contacts?: ContactInput[];
  createdAt: string;
  updatedAt: string;
}

// ----- EditPartnerForm -----

const editPartnerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().optional(),
  website: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\/.+/.test(v), {
      message: 'Website must start with http:// or https://',
    }),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type EditPartnerFormValues = z.infer<typeof editPartnerSchema>;

interface EditPartnerFormProps {
  partner: PartnerShape;
  onSave: (data: PartnerShape) => void;
  onClose: () => void;
}

function EditPartnerForm({ partner, onSave, onClose }: EditPartnerFormProps) {
  const t = useTranslations();
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditPartnerFormValues>({
    resolver: zodResolver(editPartnerSchema),
    defaultValues: {
      name: partner.name || '',
      type: partner.type || '',
      website: partner.website || '',
      address: partner.address || '',
      notes: partner.notes || '',
    },
  });

  const typeValue = watch('type');

  async function onSubmit(values: EditPartnerFormValues) {
    setSaveError('');
    setSaving(true);
    const payload: Record<string, string> = {};
    (Object.keys(values) as (keyof EditPartnerFormValues)[]).forEach((k) => {
      const v = values[k];
      if (v && v.trim?.() !== '') payload[k] = v as string;
    });
    let res: Response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      res = await fetch(`/api/partners/${partner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      data = await res.json();
    } catch {
      setSaving(false);
      setSaveError('A network error occurred. Please try again.');
      return;
    }
    setSaving(false);
    if (!res.ok) {
      const { formatApiError } = await import('@/lib/validation');
      setSaveError(formatApiError(data, t('validation.genericError')));
    } else {
      onSave(data);
    }
  }

  return (
    <div className="rounded-md border-2 border-primary/40 p-4">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-3">
          {saveError && (
            <Alert variant="destructive">
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-name">
                {t('partners.partnerName')} <span className="text-destructive">*</span>
              </Label>
              <Input id="edit-name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-type">{t('common.type')}</Label>
              <Select
                value={typeValue || '__none__'}
                onValueChange={(v) => setValue('type', v === '__none__' ? '' : v)}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue placeholder={t('common.none')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('common.none')}</SelectItem>
                  {PARTNER_TYPES.map((pt) => (
                    <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-website">{t('partners.website')}</Label>
            <Input id="edit-website" placeholder="https://example.com" {...register('website')} />
            {errors.website && (
              <p className="text-sm text-destructive">{errors.website.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-address">{t('partners.address')}</Label>
            <Textarea id="edit-address" rows={2} {...register('address')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-notes">{t('partners.notes')}</Label>
            <Textarea id="edit-notes" rows={3} {...register('notes')} />
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('common.saving') : t('common.saveChanges')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ----- InlineDeleteButton -----

interface InlineDeleteButtonProps {
  onConfirm: () => void;
}

/** Two-click inline delete button with 3-second auto-revert */
function InlineDeleteButton({ onConfirm }: InlineDeleteButtonProps) {
  const t = useTranslations();
  const [confirming, setConfirming] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startConfirm = useCallback(() => {
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), 5000);
  }, []);

  const handleConfirm = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
    onConfirm();
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button size="sm" variant="destructive" onClick={handleConfirm}>
          {t('common.confirm')}
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={startConfirm}
      title={t('common.delete')}
      className="text-destructive hover:text-destructive"
    >
      <Trash className="h-4 w-4" />
    </Button>
  );
}

// ----- PartnerDetailPage -----

export default function PartnerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();
  const t = useTranslations();
  const format = useFormatter();

  const [partner, setPartner] = useState<PartnerShape | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [contactsValue, setContactsValue] = useState<ContactInput[]>([]);
  const [contactsSaving, setContactsSaving] = useState<boolean>(false);

  // Inline editing state
  const [editingPartner, setEditingPartner] = useState<boolean>(false);

  const canEdit = ['ADMIN', 'EDITOR'].includes(session?.user?.role ?? '');
  const isAdmin = session?.user?.role === 'ADMIN';

  useEffect(() => {
    if (!id) return;
    fetch(`/api/partners/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setPartner(data);
          setContactsValue(data.contacts || []);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(t('partners.failedToLoad'));
        setLoading(false);
      });
  }, [id, t]);

  async function handleDeletePartner() {
    try {
      const res = await fetch(`/api/partners/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/partners');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(t('common.error'), { description: data.error || t('partners.failedToDelete') });
      }
    } catch {
      toast.error(t('common.error'), { description: t('partners.failedToDelete') });
    }
  }

  async function handleSaveContacts() {
    setContactsSaving(true);
    try {
      const res = await fetch(`/api/partners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: contactsValue }),
      });
      const data = await res.json();
      setContactsSaving(false);
      if (res.ok) {
        setPartner((prev) => (prev ? { ...prev, contacts: data.contacts } : prev));
        setContactsValue(data.contacts || []);
        toast.success(t('partners.contactsSaved'), { description: t('partners.contactsUpdated') });
      } else {
        toast.error(t('common.error'), { description: t('partners.failedToSaveContacts') });
      }
    } catch {
      setContactsSaving(false);
      toast.error(t('common.error'), { description: t('partners.failedToSaveContacts') });
    }
  }

  if (loading) {
    return (
      <AppShell title={t('partners.title')}>
        <div className="flex items-center justify-center mt-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !partner) {
    return (
      <AppShell title={t('partners.title')}>
        <Alert variant="destructive">
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error || t('partners.notFound')}</AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  return (
    <AppShell title={partner.name}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        {editingPartner ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/partners')}
                className="mt-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold">{t('partners.editPartner')}</h2>
            </div>
            <EditPartnerForm
              partner={partner}
              onSave={(data) => {
                setPartner((prev) => (prev ? { ...prev, ...data } : prev));
                setEditingPartner(false);
                toast.success(t('common.success'), { description: t('partners.partnerUpdated') });
              }}
              onClose={() => setEditingPartner(false)}
            />
          </div>
        ) : (
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div className="flex items-start gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/partners')}
                className="mt-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-lg font-semibold">{partner.name}</h2>
                {partner.type && (
                  <Badge
                    className={`border-0 mt-1 ${TYPE_COLORS[partner.type] || 'bg-gray-100 text-gray-600'}`}
                  >
                    {partner.type}
                  </Badge>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingPartner(true)}
                  title={t('common.edit')}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {isAdmin && <InlineDeleteButton onConfirm={handleDeletePartner} />}
              </div>
            )}
          </div>
        )}

        {/* Details + Notes */}
        {!editingPartner && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-sm font-semibold mb-4">{t('partners.details')}</h3>
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                        {t('partners.website')}
                      </p>
                      <p className="text-sm">
                        {partner.website ? (
                          <a
                            href={partner.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            {partner.website}
                          </a>
                        ) : (
                          '-'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                        {t('partners.address')}
                      </p>
                      <p className="text-sm">{partner.address || '-'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                          {t('common.createdAt')}
                        </p>
                        <p className="text-sm">
                          {format.dateTime(new Date(partner.createdAt), {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                          {t('common.updatedAt')}
                        </p>
                        <p className="text-sm">
                          {format.dateTime(new Date(partner.updatedAt), {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-sm font-semibold mb-4">{t('partners.notes')}</h3>
                  <p
                    className={`text-sm whitespace-pre-wrap ${partner.notes ? '' : 'text-muted-foreground'}`}
                  >
                    {partner.notes || t('partners.noNotes')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Contacts */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold mb-4">{t('partners.contacts')}</h3>
                <ContactsEditor
                  contacts={contactsValue}
                  onChange={canEdit ? setContactsValue : undefined}
                  onSave={canEdit ? handleSaveContacts : undefined}
                  saving={contactsSaving}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
}
