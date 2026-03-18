// @ts-nocheck
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
import { theme } from '@/lib/theme';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications position="top-right" />
        <Component {...pageProps} />
      </MantineProvider>
    </SessionProvider>
  );
}
