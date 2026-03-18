import { useState, useEffect } from 'react';
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
import { DEFAULT_CUSTOMER_STATUSES } from '@/lib/constants';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  clientCode: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  vertical: z.string().optional(),
  website: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\/.+/.test(v), {
      message: 'Website must start with http:// or https://',
    }),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type NewCustomerFormValues = z.infer<typeof schema>;

export default function NewCustomerPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');
  const [statuses, setStatuses] = useState<readonly string[]>(DEFAULT_CUSTOMER_STATUSES);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.customerStatuses?.length) setStatuses(data.customerStatuses);
      })
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewCustomerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      clientCode: '',
      status: 'Active',
      vertical: '',
      website: '',
      address: '',
      notes: '',
    },
  });

  const statusValue = watch('status');

  async function onSubmit(values: NewCustomerFormValues) {
    setApiError('');
    setSubmitting(true);

    const payload: Record<string, string> = {};
    (Object.keys(values) as (keyof NewCustomerFormValues)[]).forEach((k) => {
      const v = values[k];
      if (v && v.trim?.() !== '') payload[k] = v as string;
    });

    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setApiError(data.error || 'Failed to create customer');
    } else {
      toast.success('Customer created', { description: `${data.name} was added successfully.` });
      router.push(`/customers/${data.id}`);
    }
  }

  return (
    <AppShell title="New Customer">
      <div className="flex flex-col gap-4 max-w-[720px]">
        {apiError && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold mb-4">Customer Details</h2>

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="name">
                      Customer Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="Acme Corporation"
                      autoFocus
                      {...register('name')}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="clientCode">Client Code</Label>
                    <Input id="clientCode" placeholder="e.g. ACME-001" {...register('clientCode')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="status">
                      Status <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={statusValue}
                      onValueChange={(v) => setValue('status', v)}
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.status && (
                      <p className="text-sm text-destructive">{errors.status.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="vertical">Vertical</Label>
                    <Input id="vertical" placeholder="Technology" {...register('vertical')} />
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
                    {submitting ? 'Creating...' : 'Create Customer'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/customers')}
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
    return { redirect: { destination: '/customers', permanent: false } };
  }
  return { props: {} };
}
