import { useState } from 'react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { getAuthOptions } from '@/lib/auth/options';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import AppShell from '@/components/AppShell';

const PARTNER_TYPES = ['Reseller', 'Distributor', 'Technology', 'Service', 'Referral', 'Other'];

const schema = z.object({
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

type NewPartnerFormValues = z.infer<typeof schema>;

export default function NewPartnerPage() {
  const router = useRouter();
  const t = useTranslations();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewPartnerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      type: '',
      website: '',
      address: '',
      notes: '',
    },
  });

  const typeValue = watch('type');

  async function onSubmit(values: NewPartnerFormValues) {
    setApiError('');
    setSubmitting(true);

    const payload: Record<string, string> = {};
    (Object.keys(values) as (keyof NewPartnerFormValues)[]).forEach((k) => {
      const v = values[k];
      if (v && v.trim?.() !== '') payload[k] = v as string;
    });

    let res: Response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      data = await res.json();
    } catch {
      setSubmitting(false);
      setApiError(t('common.networkError'));
      return;
    }
    setSubmitting(false);

    if (!res.ok) {
      const { formatApiError } = await import('@/lib/validation');
      setApiError(formatApiError(data, t('validation.genericError')));
    } else {
      toast.success(t('partners.partnerCreated'), { description: t('partners.partnerCreatedDescription', { name: data.name }) });
      router.push(`/partners/${data.id}`);
    }
  }

  return (
    <AppShell title={t('partners.newPartner')}>
      <div className="flex flex-col gap-4 max-w-[720px]">
        {apiError && (
          <Alert variant="destructive">
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold mb-4">{t('partners.partnerDetails')}</h2>

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="name">
                      {t('partners.partnerName')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="Acme Partners Ltd"
                      autoFocus
                      {...register('name')}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="type">{t('common.type')}</Label>
                    <Select
                      value={typeValue || '__none__'}
                      onValueChange={(v) => setValue('type', v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger id="type">
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
                  <Label htmlFor="website">{t('partners.website')}</Label>
                  <Input id="website" placeholder="https://example.com" {...register('website')} />
                  {errors.website && (
                    <p className="text-sm text-destructive">{errors.website.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="address">{t('partners.address')}</Label>
                  <Textarea id="address" rows={2} {...register('address')} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="notes">{t('partners.notes')}</Label>
                  <Textarea id="notes" rows={3} {...register('notes')} />
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? t('common.creating') : t('partners.createPartner')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/partners')}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
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
  if (!['ADMIN', 'EDITOR'].includes(session.user?.role)) {
    return { redirect: { destination: '/partners', permanent: false } };
  }
  return { props: {} };
}
