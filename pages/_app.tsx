import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';
import '@mantine/charts/styles.css';
import 'mantine-datatable/styles.css';
import '@/styles/globals.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import type { Session } from 'next-auth';
import { theme } from '@/lib/theme';

type AppPropsWithSession = AppProps & {
  pageProps: { session?: Session } & Record<string, unknown>;
};

export default function App({ Component, pageProps: { session, ...pageProps } }: AppPropsWithSession) {
  return (
    <SessionProvider session={session}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications position="top-right" />
        <Component {...pageProps} />
      </MantineProvider>
    </SessionProvider>
  );
}
