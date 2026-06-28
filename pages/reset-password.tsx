import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PasswordInput } from '@/components/ui/password-input';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { Loader2 } from 'lucide-react';

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

export default function ResetPasswordPage() {
  const t = useTranslations();
  const router = useRouter();
  const tokenParam = router.query.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  const [password, setPassword] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(false);

  const strength = getPasswordStrength(password);

  function getStrengthLabel(s: number): string {
    if (s < 25) return t('profile.strengthTooShort');
    if (s < 50) return t('profile.strengthWeak');
    if (s < 75) return t('profile.strengthFair');
    if (s < 100) return t('profile.strengthGood');
    return t('profile.strengthStrong');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Router query is not populated on the first client render; don't act until ready.
    if (!router.isReady) return;
    if (!token) {
      setError(t('auth.resetPassword.invalidToken'));
      return;
    }
    if (password !== confirm) {
      setError(t('profile.passwordsMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === 'Weak password' && Array.isArray(data.details)) {
          setError(data.details.join(', '));
        } else {
          setError(data.error || t('auth.resetPassword.invalidToken'));
        }
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError(t('common.networkError'));
    }
    setSubmitting(false);
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center py-8 px-4">
      <div className="absolute top-4 end-4">
        <LocaleSwitcher />
      </div>
      <div className="w-full max-w-[420px]">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-2 mb-6">
              <h2 className="text-xl font-bold text-center">{t('auth.resetPassword.title')}</h2>
              <p className="text-sm text-muted-foreground text-center">
                {t('auth.resetPassword.subtitle')}
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!router.isReady ? (
              <div className="flex justify-center py-4" data-testid="reset-password-loading">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : done ? (
              <div className="flex flex-col gap-4" data-testid="reset-password-success">
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <AlertDescription>{t('auth.resetPassword.success')}</AlertDescription>
                </Alert>
                <Button asChild className="w-full">
                  <Link href="/login">{t('auth.resetPassword.goToLogin')}</Link>
                </Button>
              </div>
            ) : !token ? (
              <div className="flex flex-col gap-4" data-testid="reset-password-no-token">
                <Alert variant="destructive">
                  <AlertDescription>{t('auth.resetPassword.invalidToken')}</AlertDescription>
                </Alert>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/forgot-password">{t('auth.resetPassword.requestNewLink')}</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <PasswordInput
                      label={t('auth.resetPassword.newPassword')}
                      id="new-password"
                      value={password}
                      onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                      required
                      autoComplete="new-password"
                      autoFocus
                    />
                    {password.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getStrengthBarColor(strength)}`}
                            style={{ width: `${strength}%` }}
                          />
                        </div>
                        <p className={`text-xs ${getStrengthTextColor(strength)}`}>{getStrengthLabel(strength)}</p>
                      </div>
                    )}
                  </div>
                  <PasswordInput
                    label={t('auth.resetPassword.confirmPassword')}
                    id="confirm-password"
                    value={confirm}
                    onChange={(e) => setConfirm((e.target as HTMLInputElement).value)}
                    required
                    autoComplete="new-password"
                  />
                  <Button type="submit" className="w-full mt-1" size="lg" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="me-2 h-4 w-4 animate-spin" />
                        {t('common.saving')}
                      </>
                    ) : (
                      t('auth.resetPassword.submit')
                    )}
                  </Button>
                  <Button asChild variant="ghost" className="w-full" size="sm">
                    <Link href="/login">{t('auth.forgotPassword.backToLogin')}</Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
