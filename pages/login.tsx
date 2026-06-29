import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signIn, getSession } from 'next-auth/react';
import type { GetServerSidePropsContext } from 'next';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Separator } from '@/components/ui/separator';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const { error: queryError, passwordChanged } = router.query;

  const [orgName, setOrgName] = useState<string>('Fanek');
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState<boolean>(false);
  const [passwordResetEnabled, setPasswordResetEnabled] = useState<boolean>(false);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.setupComplete === false) {
          router.replace('/setup');
          return;
        }
        if (data.orgName) setOrgName(data.orgName);
        if (data.orgLogo) setOrgLogo(data.orgLogo);
        setGoogleEnabled(!!data.googleOAuthEnabled);
        setPasswordResetEnabled(!!data.passwordResetEnabled);
      } catch {
        // Continue with defaults if settings fetch fails
      }
    }
    loadSettings();
  }, [router]);

  const queryErrorStr = Array.isArray(queryError) ? queryError[0] : queryError;
  const displayError =
    formError ||
    (queryErrorStr
      ? queryErrorStr === 'CredentialsSignin'
        ? t('auth.invalidCredentials')
        : queryErrorStr === 'RateLimited'
          ? t('auth.rateLimited')
          : queryErrorStr === 'OAuthSignin'
            ? t('auth.oauthError')
            : queryErrorStr === 'OAuthCallback'
              ? t('auth.oauthCancelled')
              : t('auth.error')
      : null);

  async function handleCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      setFormError(result.error === 'RateLimited' ? t('auth.rateLimited') : t('auth.invalidCredentials'));
      setSubmitting(false);
    } else {
      router.replace('/dashboard');
    }
  }

  async function handleGoogleSignIn() {
    setFormError(null);
    await signIn('google', { callbackUrl: '/dashboard' });
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
              <Avatar className="h-[72px] w-[72px] rounded-sm">
                {orgLogo ? (
                  <AvatarImage src={orgLogo} alt={orgName} />
                ) : null}
                <AvatarFallback className="rounded-sm text-2xl font-bold bg-primary text-primary-foreground">
                  {orgName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold text-center">{orgName}</h2>
              <p className="text-sm text-muted-foreground text-center">{t('auth.signInToAccount')}</p>
            </div>

            {passwordChanged && !displayError && (
              <Alert className="mb-4 border-green-200 bg-green-50 dark:bg-green-950/20">
                <AlertDescription>{t('auth.passwordChangedNotice')}</AlertDescription>
              </Alert>
            )}

            {displayError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{displayError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleCredentialsSubmit}>
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
                <PasswordInput
                  label={t('auth.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                {passwordResetEnabled && (
                  <div className="-mt-1 text-end">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                    >
                      {t('auth.forgotPassword.link')}
                    </Link>
                  </div>
                )}
                <Button type="submit" className="w-full mt-1" size="lg" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t('auth.signingIn')}
                    </>
                  ) : (
                    t('auth.signIn')
                  )}
                </Button>
              </div>
            </form>

            {googleEnabled && (
              <>
                <div className="relative my-4">
                  <Separator />
                  <span className="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-sm text-muted-foreground">
                    {t('auth.orContinueWith')}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={handleGoogleSignIn}
                >
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    width={20}
                    height={20}
                    loading="lazy"
                    decoding="async"
                    className="w-5 h-5 me-2"
                  />
                  {t('auth.signInWith', { provider: 'Google' })}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getSession(context);
  if (session) {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }
  return { props: {} };
}
