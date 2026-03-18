import { useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { getAuthOptions } from '@/lib/auth/options';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Separator } from '@/components/ui/separator';
import AppShell from '@/components/AppShell';

function getPasswordStrength(password: string): number {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 25;
  if (/[A-Z]/.test(password)) strength += 25;
  if (/[^A-Za-z0-9]/.test(password)) strength += 25;
  return strength;
}

function getStrengthColor(strength: number): string {
  if (strength < 50) return 'red';
  if (strength < 75) return 'yellow';
  return 'green';
}

function getStrengthLabel(strength: number): string {
  if (strength < 25) return 'Too short';
  if (strength < 50) return 'Weak';
  if (strength < 75) return 'Fair';
  if (strength < 100) return 'Good';
  return 'Strong';
}

function getStrengthBarColor(strength: number): string {
  if (strength < 50) return 'bg-red-500';
  if (strength < 75) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getStrengthTextColor(strength: number): string {
  if (strength < 50) return 'text-red-600';
  if (strength < 75) return 'text-yellow-600';
  return 'text-green-600';
}

const nameSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});
type NameFormValues = z.infer<typeof nameSchema>;

interface NameFormProps {
  user?: { name?: string | null };
  onUpdate: (updates: { name: string }) => Promise<void>;
}

function NameForm({ user, onUpdate }: NameFormProps) {
  const [saving, setSaving] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<NameFormValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: user?.name || '' },
  });

  async function onSubmit(values: NameFormValues) {
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: values.name.trim() }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError('name', { message: data.error || 'Failed to update name' });
    } else {
      await onUpdate({ name: data.name });
      toast.success('Name updated', { description: 'Display name saved.' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-3">
        <div className="space-y-2">
          <Label htmlFor="display-name">Full Name</Label>
          <Input id="display-name" {...register('name')} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="flex">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Name'}
          </Button>
        </div>
      </div>
    </form>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(1, 'New password is required')
      .min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
type PasswordFormValues = z.infer<typeof passwordSchema>;

interface PasswordFormProps {
  onSuccess?: (data: { firstLogin?: boolean }) => void;
  successMessage?: string;
}

function PasswordForm({ onSuccess, successMessage }: PasswordFormProps) {
  const [saving, setSaving] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPasswordValue = watch('newPassword');
  const strength = getPasswordStrength(newPasswordValue || '');

  async function onSubmit(values: PasswordFormValues) {
    setApiError('');
    setSuccess(false);
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setApiError(data.error || 'Failed to change password');
    } else {
      setSuccess(true);
      reset();
      if (onSuccess) onSuccess(data);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-3">
        {success && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              {successMessage || 'Password changed successfully.'}
            </AlertDescription>
          </Alert>
        )}
        {apiError && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}
        <PasswordInput
          label="Current Password"
          required
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <div>
          <PasswordInput
            label="New Password"
            required
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          {newPasswordValue && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getStrengthBarColor(strength)}`}
                  style={{ width: `${strength}%` }}
                />
              </div>
              <p className={`text-xs ${getStrengthTextColor(strength)}`}>
                {getStrengthLabel(strength)}
              </p>
            </div>
          )}
        </div>
        <PasswordInput
          label="Confirm New Password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div className="flex">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Change Password'}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const user = session?.user;
  const isFirstLogin = user?.firstLogin;

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    EDITOR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    VIEWER: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  const content = (
    <div className="flex flex-col gap-4 max-w-[600px]">
      {isFirstLogin && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <AlertTitle>Welcome</AlertTitle>
          <AlertDescription>
            Please change your temporary password to continue.
          </AlertDescription>
        </Alert>
      )}

      {!isFirstLogin && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-2">Account Information</h3>
            <Separator className="mb-4" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                  Email
                </p>
                <p className="text-sm">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                  Role
                </p>
                <Badge
                  className={`border-0 ${roleColors[user?.role ?? ''] || 'bg-gray-100 text-gray-600'}`}
                >
                  {user?.role}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isFirstLogin && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-2">Display Name</h3>
            <Separator className="mb-4" />
            <NameForm
              user={user}
              onUpdate={async (updates) => {
                await update(updates);
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold mb-2">Change Password</h3>
          <Separator className="mb-4" />
          <PasswordForm
            successMessage={
              isFirstLogin
                ? 'Password changed successfully. Redirecting to dashboard...'
                : 'Password changed successfully.'
            }
            onSuccess={(data) => {
              if (data.firstLogin === false) {
                setTimeout(async () => {
                  await update({ firstLogin: false });
                  router.replace('/dashboard');
                }, 1500);
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );

  if (isFirstLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg">
          <h1 className="text-xl font-bold mb-4">Set Your Password</h1>
          {content}
        </div>
      </div>
    );
  }

  return <AppShell title="My Profile">{content}</AppShell>;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
}
