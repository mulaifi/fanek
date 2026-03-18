import '@/styles/globals.css';

import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { SessionProvider } from 'next-auth/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AppProps } from 'next/app';
import type { Session } from 'next-auth';

type AppPropsWithSession = AppProps & {
  pageProps: { session?: Session } & Record<string, unknown>;
};

export default function App({ Component, pageProps: { session, ...pageProps } }: AppPropsWithSession) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Component {...pageProps} />
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
