import { useState, useEffect, useCallback, useRef } from 'react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { getAuthOptions } from '@/lib/auth/options';
import type { ServiceTypeFieldInput } from '@/lib/validation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import ServiceTypeEditor from '@/components/admin/ServiceTypeEditor';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface ServiceTypeRow {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  active: boolean;
  fieldSchema?: ServiceTypeFieldInput[];
  _count?: { services: number };
}

interface ServiceTypeFormShape {
  name: string;
  description: string;
  icon: string;
  active: boolean;
  fieldSchema: ServiceTypeFieldInput[];
}

function emptyServiceType(): ServiceTypeFormShape {
  return { name: '', description: '', icon: '', active: true, fieldSchema: [] };
}

interface InlineDeleteButtonProps {
  onConfirm: () => void;
  disabled?: boolean;
}

/** Two-click inline delete button with 3-second auto-revert */
function InlineDeleteButton({ onConfirm, disabled }: InlineDeleteButtonProps) {
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
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 text-destructive hover:text-destructive"
      disabled={disabled}
      onClick={startConfirm}
    >
      <Trash2 className="h-3.5 w-3.5" />
      Delete
    </Button>
  );
}

export default function ServiceCatalogPage() {
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);

  async function loadServiceTypes() {
    setLoading(true);
    const res = await fetch('/api/service-types');
    const data = await res.json();
    setLoading(false);
    if (res.ok) setServiceTypes(data.data || []);
    else setError(data.error || 'Failed to load service types');
  }

  useEffect(() => {
    loadServiceTypes();
  }, []);

  async function handleDelete(st: ServiceTypeRow) {
    const res = await fetch(`/api/service-types/${st.id}`, { method: 'DELETE' });
    if (res.ok) {
      setServiceTypes((prev) => prev.filter((s) => s.id !== st.id));
      toast.success('Service type deleted.');
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to delete.');
    }
  }

  return (
    <AppShell title="Service Catalog">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end mb-4">
        {!showCreateForm && (
          <Button
            className="gap-2"
            onClick={() => {
              setShowCreateForm(true);
              setEditingTypeId(null);
            }}
          >
            <Plus className="h-4 w-4" />
            New Service Type
          </Button>
        )}
      </div>

      {/* Inline create form */}
      {showCreateForm && (
        <Card className="mb-4 border-2 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Service Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceTypeForm
              initial={emptyServiceType()}
              editingType={null}
              onClose={() => setShowCreateForm(false)}
              onSuccess={() => {
                setShowCreateForm(false);
                loadServiceTypes();
              }}
            />
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Fields</TableHead>
              <TableHead>Services</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && serviceTypes.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  No service types defined yet
                </TableCell>
              </TableRow>
            )}
            {serviceTypes.map((st) =>
              editingTypeId === st.id ? (
                <TableRow key={st.id}>
                  <TableCell colSpan={6} className="p-4">
                    <Card className="border-2 border-primary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Edit: {st.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ServiceTypeForm
                          initial={{
                            name: st.name || '',
                            description: st.description || '',
                            icon: st.icon || '',
                            active: st.active !== false,
                            fieldSchema: st.fieldSchema || [],
                          }}
                          editingType={st}
                          onClose={() => setEditingTypeId(null)}
                          onSuccess={() => {
                            setEditingTypeId(null);
                            loadServiceTypes();
                          }}
                        />
                      </CardContent>
                    </Card>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow
                  key={st.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setEditingTypeId(st.id);
                    setShowCreateForm(false);
                  }}
                >
                  <TableCell>
                    <span className="font-medium">
                      {st.icon ? `${st.icon} ` : ''}
                      {st.name}
                    </span>
                  </TableCell>
                  <TableCell>{st.description || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{(st.fieldSchema || []).length} fields</Badge>
                  </TableCell>
                  <TableCell>{st._count?.services ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={st.active ? 'default' : 'secondary'}>
                      {st.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center gap-1 justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          setEditingTypeId(st.id);
                          setShowCreateForm(false);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <InlineDeleteButton
                        onConfirm={() => handleDelete(st)}
                        disabled={(st._count?.services ?? 0) > 0}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}

interface ServiceTypeFormProps {
  initial: ServiceTypeFormShape;
  editingType: ServiceTypeRow | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ServiceTypeForm({ initial, editingType, onClose, onSuccess }: ServiceTypeFormProps) {
  const [form, setForm] = useState<ServiceTypeFormShape>(initial);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  async function handleSave() {
    setSaveError('');
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setFormErrors({});
    setSaving(true);

    const url = editingType ? `/api/service-types/${editingType.id}` : '/api/service-types';
    const method = editingType ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setSaveError(data.error || 'Failed to save');
    } else {
      onSuccess();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-start gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <Label htmlFor="st-name">
            Service Type Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="st-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          {formErrors.name && (
            <p className="text-xs text-destructive">{formErrors.name}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 w-24">
          <Label htmlFor="st-icon">Icon (emoji)</Label>
          <Input
            id="st-icon"
            placeholder="e.g. ☁️"
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="st-desc">Description</Label>
        <Textarea
          id="st-desc"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id="st-active"
          checked={form.active}
          onCheckedChange={(checked) => setForm({ ...form, active: checked })}
        />
        <Label htmlFor="st-active">Active (visible when adding services)</Label>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2 mt-1">Field Schema</p>
        <ServiceTypeEditor
          fieldSchema={form.fieldSchema}
          onChange={(fieldSchema) => setForm({ ...form, fieldSchema })}
        />
      </div>

      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {editingType ? 'Save Changes' : 'Create Service Type'}
        </Button>
      </div>
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  if (session.user?.role !== 'ADMIN') {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }
  return { props: {} };
}
