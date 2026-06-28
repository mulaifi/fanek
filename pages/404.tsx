import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

export default function NotFoundPage() {
  const t = useTranslations('notFound');
  const tNav = useTranslations('nav');
  const { resolvedTheme } = useTheme();
  const { status } = useSession();

  // Avoid a hydration mismatch: the theme is only known on the client, so we
  // render the light logo on the server/first paint and swap after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const logoSrc =
    mounted && resolvedTheme === 'dark' ? '/Fanek_logo_dark.svg' : '/Fanek_logo_light.svg';

  const loading = status === 'loading';
  const authenticated = status === 'authenticated';
  const backHref = authenticated ? '/dashboard' : '/login';
  const backLabel = authenticated ? t('backToDashboard') : t('backToLogin');

  return (
    <div className="relative min-h-screen flex items-center justify-center py-8 px-4">
      <div className="absolute top-4 end-4">
        <LocaleSwitcher />
      </div>
      <div className="w-full max-w-[420px] flex flex-col items-center text-center gap-6">
        <img src={logoSrc} alt={tNav('appName')} className="w-16 h-16" />
        <div className="flex flex-col items-center gap-2">
          <p className="text-5xl font-bold tracking-tight text-primary">404</p>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground max-w-sm">{t('message')}</p>
        </div>
        {loading ? (
          <Button size="lg" disabled aria-busy="true">
            <Loader2 className="h-4 w-4 animate-spin" />
          </Button>
        ) : (
          <Button asChild size="lg">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
