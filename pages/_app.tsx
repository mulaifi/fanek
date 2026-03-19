import '@/styles/globals.css';

import { useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { SessionProvider } from 'next-auth/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NextIntlClientProvider } from 'next-intl';
import '@/lib/fonts'; // Side-effect: registers Inter + Tajawal @font-face
import { getClientLocale, getFontFamily, type Locale } from '@/lib/i18n';
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

  // Set font CSS variable based on locale direction
  useEffect(() => {
    document.documentElement.style.setProperty('--app-font', getFontFamily(locale));
  }, [locale]);

  return (
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
  );
}
