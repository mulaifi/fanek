import { useState } from 'react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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

    const res = await fetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setApiError(data.error || 'Failed to create partner');
    } else {
      toast.success('Partner created', { description: `${data.name} was added successfully.` });
      router.push(`/partners/${data.id}`);
    }
  }

  return (
    <AppShell title="New Partner">
      <div className="flex flex-col gap-4 max-w-[720px]">
        {apiError && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold mb-4">Partner Details</h2>

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="name">
                      Partner Name <span className="text-destructive">*</span>
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
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={typeValue || '__none__'}
                      onValueChange={(v) => setValue('type', v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger id="type">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {PARTNER_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" placeholder="https://example.com" {...register('website')} />
                  {errors.website && (
                    <p className="text-sm text-destructive">{errors.website.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="address">Address</Label>
                  <Textarea id="address" rows={2} {...register('address')} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" rows={3} {...register('notes')} />
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Partner'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/partners')}
                  >
                    Cancel
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
