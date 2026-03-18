import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { getAuthOptions } from '@/lib/auth/options';
import type { ContactInput } from '@/lib/validation';
import type { ServiceTypeFieldInput } from '@/lib/validation';
import { ArrowLeft, Edit, Trash, Plus, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';
import AppShell from '@/components/AppShell';
import ContactsEditor from '@/components/ContactsEditor';
import DynamicForm from '@/components/DynamicForm';
import DynamicFieldDisplay from '@/components/DynamicFieldDisplay';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { statusColors } from '@/lib/theme';
import { DEFAULT_CUSTOMER_STATUSES } from '@/lib/constants';

interface ServiceTypeShape {
  id: string;
  name: string;
  fieldSchema?: ServiceTypeFieldInput[];
}

interface ServiceShape {
  id: string;
  serviceType?: ServiceTypeShape;
  fieldValues?: Record<string, unknown>;
  createdAt: string;
}

interface CustomerShape {
  id: string;
  name: string;
  clientCode?: string | null;
  status: string;
  vertical?: string | null;
  website?: string | null;
  address?: string | null;
  notes?: string | null;
  contacts?: ContactInput[];
  services?: ServiceShape[];
  createdAt: string;
  updatedAt: string;
}

// ----- EditCustomerForm -----

const editCustomerSchema = z.object({
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
});

type EditCustomerFormValues = z.infer<typeof editCustomerSchema>;

interface EditCustomerFormProps {
  customer: CustomerShape;
  statuses: readonly string[];
  onSave: (data: CustomerShape) => void;
  onClose: () => void;
}

function EditCustomerForm({ customer, statuses, onSave, onClose }: EditCustomerFormProps) {
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditCustomerFormValues>({
    resolver: zodResolver(editCustomerSchema),
    defaultValues: {
      name: customer.name || '',
      clientCode: customer.clientCode || '',
      status: customer.status || 'Active',
      vertical: customer.vertical || '',
      website: customer.website || '',
      address: customer.address || '',
    },
  });

  const statusValue = watch('status');

  async function onSubmit(values: EditCustomerFormValues) {
    setSaveError('');
    setSaving(true);
    const payload: Record<string, string | null> = {};
    (Object.keys(values) as (keyof EditCustomerFormValues)[]).forEach((k) => {
      const v = values[k];
      payload[k] = v && v.trim?.() !== '' ? (v as string) : null;
    });
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setSaveError(data.error || 'Failed to save');
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
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-name">
                Customer Name <span className="text-destructive">*</span>
              </Label>
              <Input id="edit-name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-clientCode">Client Code</Label>
              <Input id="edit-clientCode" {...register('clientCode')} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-status">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select value={statusValue} onValueChange={(v) => setValue('status', v)}>
                <SelectTrigger id="edit-status">
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
              <Label htmlFor="edit-vertical">Vertical</Label>
              <Input id="edit-vertical" {...register('vertical')} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-website">Website</Label>
            <Input id="edit-website" placeholder="https://example.com" {...register('website')} />
            {errors.website && (
              <p className="text-sm text-destructive">{errors.website.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-address">Address</Label>
            <Textarea id="edit-address" rows={2} {...register('address')} />
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ----- AddServiceForm -----

interface AddServiceFormProps {
  customerId: string | string[] | undefined;
  serviceTypes: ServiceTypeShape[];
  onAdd: (service: ServiceShape) => void;
  onClose: () => void;
}

function AddServiceForm({ customerId, serviceTypes, onAdd, onClose }: AddServiceFormProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [serviceFields, setServiceFields] = useState<Record<string, unknown>>({});
  const [serviceErrors, setServiceErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<boolean>(false);
  const [addError, setAddError] = useState<string>('');

  const selectedType = serviceTypes.find((t) => t.id === selectedTypeId);

  async function handleAdd() {
    setAddError('');
    if (!selectedTypeId) {
      setServiceErrors({ type: 'Please select a service type' });
      return;
    }
    const errs: Record<string, string> = {};
    (selectedType?.fieldSchema || []).forEach((f) => {
      if (f.required && !serviceFields[f.name]) {
        errs[f.name] = `${f.label} is required`;
      }
    });
    if (Object.keys(errs).length > 0) {
      setServiceErrors(errs);
      return;
    }
    setServiceErrors({});
    setAdding(true);
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, serviceTypeId: selectedTypeId, fieldValues: serviceFields }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) {
      setAddError(data.error || 'Failed to add service');
    } else {
      onAdd({ ...data, serviceType: selectedType });
    }
  }

  return (
    <div className="rounded-md border-2 border-primary/40 p-4 mb-4">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Add New Service</p>
        {addError && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{addError}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-1">
          <Label htmlFor="service-type">
            Service Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={selectedTypeId}
            onValueChange={(v) => {
              setSelectedTypeId(v);
              setServiceFields({});
              setServiceErrors({});
            }}
          >
            <SelectTrigger id="service-type">
              <SelectValue placeholder="Select a service type" />
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {serviceErrors.type && (
            <p className="text-sm text-destructive">{serviceErrors.type}</p>
          )}
        </div>
        {selectedType && (
          <DynamicForm
            fieldSchema={selectedType.fieldSchema || []}
            values={serviceFields}
            onChange={setServiceFields}
            errors={serviceErrors}
          />
        )}
        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={adding} onClick={handleAdd}>
            {adding ? 'Adding...' : 'Add Service'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----- EditServiceForm -----

interface EditServiceFormProps {
  service: ServiceShape;
  onSave: (service: ServiceShape) => void;
  onClose: () => void;
}

function EditServiceForm({ service, onSave, onClose }: EditServiceFormProps) {
  const [serviceFields, setServiceFields] = useState<Record<string, unknown>>(service.fieldValues || {});
  const [serviceErrors, setServiceErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');

  const fieldSchema = service.serviceType?.fieldSchema || [];

  async function handleSave() {
    setSaveError('');
    const errs: Record<string, string> = {};
    fieldSchema.forEach((f) => {
      if (f.required && !serviceFields[f.name]) {
        errs[f.name] = `${f.label} is required`;
      }
    });
    if (Object.keys(errs).length > 0) {
      setServiceErrors(errs);
      return;
    }
    setServiceErrors({});
    setSaving(true);
    const res = await fetch(`/api/services/${service.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldValues: serviceFields }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setSaveError(data.error || 'Failed to update service');
    } else {
      onSave({ ...data, serviceType: service.serviceType });
    }
  }

  return (
    <div className="rounded-md border-2 border-primary/40 p-4">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Edit {service.serviceType?.name || 'Service'}</p>
        {saveError && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}
        <DynamicForm
          fieldSchema={fieldSchema}
          values={serviceFields}
          onChange={setServiceFields}
          errors={serviceErrors}
        />
        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----- InlineDeleteButton -----

interface InlineDeleteButtonProps {
  onConfirm: () => void;
  label?: string;
}

/** Two-click inline delete button with 3-second auto-revert */
function InlineDeleteButton({ onConfirm, label = 'Delete' }: InlineDeleteButtonProps) {
  const [confirming, setConfirming] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startConfirm = useCallback(() => {
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), 3000);
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
          Confirm?
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={startConfirm} title={label} className="text-destructive hover:text-destructive">
      <Trash className="h-4 w-4" />
    </Button>
  );
}

// ----- InlineDeleteServiceButton -----

interface InlineDeleteServiceButtonProps {
  onConfirm: () => void;
}

/** Small inline delete for service rows */
function InlineDeleteServiceButton({ onConfirm }: InlineDeleteServiceButtonProps) {
  const [confirming, setConfirming] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startConfirm = useCallback(() => {
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), 3000);
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
          Confirm?
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={startConfirm} title="Remove service" className="text-destructive hover:text-destructive">
      <Trash className="h-4 w-4" />
    </Button>
  );
}

// ----- CustomerDetailPage -----

export default function CustomerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();

  const [customer, setCustomer] = useState<CustomerShape | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [statuses, setStatuses] = useState<readonly string[]>(DEFAULT_CUSTOMER_STATUSES);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeShape[]>([]);

  const [notesValue, setNotesValue] = useState<string>('');
  const [notesSaving, setNotesSaving] = useState<boolean>(false);
  const [contactsValue, setContactsValue] = useState<ContactInput[]>([]);
  const [contactsSaving, setContactsSaving] = useState<boolean>(false);

  // Inline editing states
  const [editingCustomer, setEditingCustomer] = useState<boolean>(false);
  const [addingService, setAddingService] = useState<boolean>(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const canEdit = ['ADMIN', 'EDITOR'].includes(session?.user?.role ?? '');
  const isAdmin = session?.user?.role === 'ADMIN';

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/customers/${id}`).then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/service-types?active=true').then((r) => r.json()),
    ])
      .then(([customerData, settingsData, stData]) => {
        if (customerData.error) {
          setError(customerData.error);
        } else {
          setCustomer(customerData);
          setNotesValue(customerData.notes || '');
          setContactsValue(customerData.contacts || []);
        }
        if (settingsData.customerStatuses?.length) setStatuses(settingsData.customerStatuses);
        if (stData.data) setServiceTypes(stData.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load customer');
        setLoading(false);
      });
  }, [id]);

  async function handleDeleteCustomer() {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/customers');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error('Error', { description: data.error || 'Failed to delete customer.' });
      }
    } catch {
      toast.error('Error', { description: 'Network error: failed to delete customer.' });
    }
  }

  async function handleDeleteService(svcId: string) {
    try {
      const res = await fetch(`/api/services/${svcId}`, { method: 'DELETE' });
      if (res.ok) {
        setCustomer((prev) =>
          prev
            ? { ...prev, services: prev.services?.filter((s) => s.id !== svcId) }
            : prev
        );
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error('Error', { description: data.error || 'Failed to remove service.' });
      }
    } catch {
      toast.error('Error', { description: 'Network error: failed to remove service.' });
    }
  }

  async function handleSaveContacts() {
    setContactsSaving(true);
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: contactsValue }),
    });
    const data = await res.json();
    setContactsSaving(false);
    if (res.ok) {
      setCustomer((prev) => (prev ? { ...prev, contacts: data.contacts } : prev));
      setContactsValue(data.contacts || []);
      toast.success('Contacts saved', { description: 'Contacts updated.' });
    } else {
      toast.error('Error', { description: 'Failed to save contacts.' });
    }
  }

  async function handleSaveNotes() {
    setNotesSaving(true);
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesValue }),
    });
    const data = await res.json();
    setNotesSaving(false);
    if (res.ok) {
      setCustomer((prev) => (prev ? { ...prev, notes: data.notes } : prev));
      toast.success('Notes saved', { description: 'Notes updated.' });
    } else {
      toast.error('Error', { description: 'Failed to save notes.' });
    }
  }

  if (loading) {
    return (
      <AppShell title="Customer">
        <div className="flex items-center justify-center mt-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !customer) {
    return (
      <AppShell title="Customer">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || 'Customer not found'}</AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  const servicesByType = (customer.services || []).reduce<Record<string, ServiceShape[]>>(
    (acc, svc) => {
      const typeName = svc.serviceType?.name || 'Unknown';
      if (!acc[typeName]) acc[typeName] = [];
      acc[typeName].push(svc);
      return acc;
    },
    {}
  );

  return (
    <AppShell title={customer.name}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        {editingCustomer ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/customers')}
                className="mt-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold">Edit Customer</h2>
            </div>
            <EditCustomerForm
              customer={customer}
              statuses={statuses}
              onSave={(data) => {
                setCustomer((prev) => (prev ? { ...prev, ...data } : prev));
                setEditingCustomer(false);
                toast.success('Saved', { description: 'Customer updated.' });
              }}
              onClose={() => setEditingCustomer(false)}
            />
          </div>
        ) : (
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div className="flex items-start gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/customers')}
                className="mt-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-lg font-semibold">{customer.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {customer.clientCode && (
                    <span className="text-sm text-muted-foreground">{customer.clientCode}</span>
                  )}
                  <Badge
                    className={`border-0 ${statusColors[customer.status] || 'bg-gray-100 text-gray-600'}`}
                  >
                    {customer.status}
                  </Badge>
                </div>
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingCustomer(true)}
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {isAdmin && <InlineDeleteButton onConfirm={handleDeleteCustomer} />}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        {!editingCustomer && (
          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="services">
                Services ({customer.services?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            {/* Info tab */}
            <TabsContent value="info" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                        Vertical
                      </p>
                      <p className="text-sm">{customer.vertical || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                        Website
                      </p>
                      <p className="text-sm">
                        {customer.website ? (
                          <a
                            href={customer.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            {customer.website}
                          </a>
                        ) : (
                          '-'
                        )}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                        Address
                      </p>
                      <p className="text-sm">{customer.address || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                        Created
                      </p>
                      <p className="text-sm">{dayjs(customer.createdAt).format('DD MMM YYYY')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                        Last Updated
                      </p>
                      <p className="text-sm">{dayjs(customer.updatedAt).format('DD MMM YYYY')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Services tab */}
            <TabsContent value="services" className="mt-4">
              <div className="flex flex-col gap-4">
                {canEdit && !addingService && (
                  <div className="flex justify-end">
                    <Button onClick={() => setAddingService(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Service
                    </Button>
                  </div>
                )}
                {addingService && (
                  <AddServiceForm
                    customerId={id}
                    serviceTypes={serviceTypes}
                    onAdd={(newService) => {
                      setCustomer((prev) =>
                        prev
                          ? { ...prev, services: [newService, ...(prev.services || [])] }
                          : prev
                      );
                      setAddingService(false);
                      toast.success('Service added', { description: 'Service was added.' });
                    }}
                    onClose={() => setAddingService(false)}
                  />
                )}
                {Object.keys(servicesByType).length === 0 && (
                  <p className="text-sm text-muted-foreground">No services yet.</p>
                )}
                {Object.entries(servicesByType).map(([typeName, services]) => (
                  <div key={typeName}>
                    <p className="text-sm font-semibold mb-2">{typeName}</p>
                    <div className="flex flex-col gap-2">
                      {services.map((svc) => (
                        <Card key={svc.id}>
                          <CardContent className="pt-4 pb-4">
                            {editingServiceId === svc.id ? (
                              <EditServiceForm
                                service={svc}
                                onSave={(updated) => {
                                  setCustomer((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          services: prev.services?.map((s) =>
                                            s.id === updated.id ? updated : s
                                          ),
                                        }
                                      : prev
                                  );
                                  setEditingServiceId(null);
                                  toast.success('Updated', { description: 'Service updated.' });
                                }}
                                onClose={() => setEditingServiceId(null)}
                              />
                            ) : (
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <DynamicFieldDisplay
                                    fieldSchema={svc.serviceType?.fieldSchema || []}
                                    values={svc.fieldValues || {}}
                                  />
                                  {!svc.serviceType?.fieldSchema?.length && (
                                    <p className="text-sm text-muted-foreground">
                                      No fields defined
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Added {dayjs(svc.createdAt).format('DD MMM YYYY')}
                                  </p>
                                </div>
                                {canEdit && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setEditingServiceId(svc.id)}
                                      title="Edit service"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    {isAdmin && (
                                      <InlineDeleteServiceButton
                                        onConfirm={() => handleDeleteService(svc.id)}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Contacts tab */}
            <TabsContent value="contacts" className="mt-4">
              <ContactsEditor
                contacts={contactsValue}
                onChange={canEdit ? setContactsValue : undefined}
                onSave={canEdit ? handleSaveContacts : undefined}
                saving={contactsSaving}
              />
              {!canEdit && (
                <p className="text-sm text-muted-foreground mt-2">
                  You do not have permission to edit contacts.
                </p>
              )}
            </TabsContent>

            {/* Notes tab */}
            <TabsContent value="notes" className="mt-4">
              <div className="flex flex-col gap-3 max-w-[600px]">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={6}
                  readOnly={!canEdit}
                />
                {canEdit && (
                  <div className="flex">
                    <Button disabled={notesSaving} onClick={handleSaveNotes}>
                      {notesSaving ? 'Saving...' : 'Save Notes'}
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
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
