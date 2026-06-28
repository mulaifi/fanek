import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setError(t('auth.forgotPassword.rateLimited'));
      } else if (res.ok) {
        // Success is the generic, enumeration-safe message. Only a 2xx (which the
        // API returns identically whether or not the account exists) promotes to it.
        setDone(true);
      } else {
        // 4xx/5xx (e.g. malformed email) — show a generic error, never success.
        setError(t('common.networkError'));
      }
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
              <h2 className="text-xl font-bold text-center">{t('auth.forgotPassword.title')}</h2>
              <p className="text-sm text-muted-foreground text-center">
                {t('auth.forgotPassword.subtitle')}
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {done ? (
              <div className="flex flex-col gap-4" data-testid="forgot-password-success">
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <AlertDescription>{t('auth.forgotPassword.genericSuccess')}</AlertDescription>
                </Alert>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login">{t('auth.forgotPassword.backToLogin')}</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('auth.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full mt-1" size="lg" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="me-2 h-4 w-4 animate-spin" />
                        {t('common.saving')}
                      </>
                    ) : (
                      t('auth.forgotPassword.submit')
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
