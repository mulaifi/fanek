import '@/styles/globals.css';

import { useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { SessionProvider } from 'next-auth/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NextIntlClientProvider } from 'next-intl';
import { inter, tajawal } from '@/lib/fonts';
import { getClientLocale, type Locale } from '@/lib/i18n';
import type { AppProps } from 'next/app';
import type { Session } from 'next-auth';

import enMessages from '@/messages/en.json';
import arMessages from '@/messages/ar.json';

const messages: Record<string, typeof enMessages> = { en: enMessages, ar: arMessages };

type AppPropsWithSession = AppProps & {
  pageProps: { session?: Session } & Record<string, unknown>;
};

export default function App({ Component, pageProps: { session, ...pageProps } }: AppPropsWithSession) {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    setLocale(getClientLocale());
  }, []);

  // Listen for locale changes (from LocaleSwitcher)
  useEffect(() => {
    const handleLocaleChange = () => setLocale(getClientLocale());
    window.addEventListener('locale-changed', handleLocaleChange);
    return () => window.removeEventListener('locale-changed', handleLocaleChange);
  }, []);

  // Always apply both font variables so the CSS [dir="rtl"] override can switch
  const fontClass = `${inter.variable} ${tajawal.variable}`;

  return (
    <div className={fontClass}>
      <SessionProvider session={session}>
        <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="Asia/Kuwait">
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <TooltipProvider>
              <Toaster position="top-right" richColors />
              <Component {...pageProps} />
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </SessionProvider>
    </div>
  );
}
