import { useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { getAuthOptions } from '@/lib/auth/options';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import AppShell from '@/components/AppShell';
import { getClientLocale, setLocaleCookie, type Locale } from '@/lib/i18n';

function getPasswordStrength(password: string): number {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 25;
  if (/[A-Z]/.test(password)) strength += 25;
  if (/[^A-Za-z0-9]/.test(password)) strength += 25;
  return strength;
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

interface NameFormProps {
  user?: { name?: string | null };
  onUpdate: (updates: { name: string }) => Promise<void>;
}

function NameForm({ user, onUpdate }: NameFormProps) {
  const t = useTranslations();
  const [saving, setSaving] = useState<boolean>(false);

  const nameSchema = z.object({
    name: z.string().min(1, t('profile.nameRequired')),
  });
  type NameFormValues = z.infer<typeof nameSchema>;

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
      setError('name', { message: data.error || t('profile.failedUpdateName') });
    } else {
      await onUpdate({ name: data.name });
      toast.success(t('profile.nameUpdated'), { description: t('profile.nameUpdatedDesc') });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-3">
        <div className="space-y-2">
          <Label htmlFor="display-name">{t('profile.fullName')}</Label>
          <Input id="display-name" {...register('name')} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="flex">
          <Button type="submit" disabled={saving}>
            {saving ? t('common.saving') : t('profile.saveName')}
          </Button>
        </div>
      </div>
    </form>
  );
}

interface PasswordFormProps {
  onSuccess?: (data: { firstLogin?: boolean }) => void;
  successMessage?: string;
}

function PasswordForm({ onSuccess, successMessage }: PasswordFormProps) {
  const t = useTranslations();
  const [saving, setSaving] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  const passwordSchema = z
    .object({
      currentPassword: z.string().min(1, t('profile.currentPasswordRequired')),
      newPassword: z
        .string()
        .min(1, t('profile.newPasswordRequired'))
        .min(8, t('profile.passwordMinLength')),
      confirmPassword: z.string().min(1, t('profile.confirmPasswordRequired')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('profile.passwordsMismatch'),
      path: ['confirmPassword'],
    });
  type PasswordFormValues = z.infer<typeof passwordSchema>;

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

  function getStrengthLabel(s: number): string {
    if (s < 25) return t('profile.strengthTooShort');
    if (s < 50) return t('profile.strengthWeak');
    if (s < 75) return t('profile.strengthFair');
    if (s < 100) return t('profile.strengthGood');
    return t('profile.strengthStrong');
  }

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
      setApiError(data.error || t('profile.failedChangePassword'));
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
            <AlertTitle>{t('common.success')}</AlertTitle>
            <AlertDescription>
              {successMessage || t('profile.passwordChanged')}
            </AlertDescription>
          </Alert>
        )}
        {apiError && (
          <Alert variant="destructive">
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}
        <PasswordInput
          label={t('profile.currentPassword')}
          required
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <div>
          <PasswordInput
            label={t('profile.newPassword')}
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
          label={t('profile.confirmNewPassword')}
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div className="flex">
          <Button type="submit" disabled={saving}>
            {saving ? t('common.saving') : t('profile.changePassword')}
          </Button>
        </div>
      </div>
    </form>
  );
}

function LanguageSelector() {
  const t = useTranslations();
  const [currentLocale, setCurrentLocale] = useState<Locale>(getClientLocale());

  async function handleLocaleChange(newLocale: string) {
    const locale = newLocale as Locale;
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        toast.error(t('profile.failedUpdateLocale'));
        return;
      }
      setLocaleCookie(locale);
      setCurrentLocale(locale);
      window.location.reload();
    } catch {
      toast.error(t('profile.failedUpdateLocale'));
    }
  }

  return (
    <div className="space-y-2">
      <Label>{t('profile.language')}</Label>
      <Select value={currentLocale} onValueChange={handleLocaleChange}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t('profile.langEnglish')}</SelectItem>
          <SelectItem value="ar">{t('profile.langArabic')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const t = useTranslations();
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
          <AlertTitle>{t('profile.firstLoginWelcome')}</AlertTitle>
          <AlertDescription>{t('profile.firstLoginDesc')}</AlertDescription>
        </Alert>
      )}

      {!isFirstLogin && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-2">{t('profile.accountInfo')}</h3>
            <Separator className="mb-4" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                  {t('common.email')}
                </p>
                <p className="text-sm">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                  {t('common.role')}
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
            <h3 className="text-sm font-semibold mb-2">{t('profile.displayName')}</h3>
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

      {!isFirstLogin && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-2">{t('profile.language')}</h3>
            <Separator className="mb-4" />
            <LanguageSelector />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold mb-2">{t('profile.changePassword')}</h3>
          <Separator className="mb-4" />
          <PasswordForm
            successMessage={
              isFirstLogin
                ? t('profile.passwordChangedRedirecting')
                : t('profile.passwordChanged')
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
          <h1 className="text-xl font-bold mb-4">{t('profile.firstLoginTitle')}</h1>
          {content}
        </div>
      </div>
    );
  }

  return <AppShell title={t('profile.title')}>{content}</AppShell>;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
}
