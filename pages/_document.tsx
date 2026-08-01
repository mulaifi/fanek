import { Html, Head, Main, NextScript } from 'next/document';
import type { DocumentContext, DocumentInitialProps } from 'next/document';
import { getDirection, getFontFamily } from '@/lib/i18n';
import { resolveLocaleWithSource, publishLocaleCookie } from '@/lib/localeServer';

interface DocumentProps extends DocumentInitialProps {
  locale: string;
}

export default function Document({ locale }: DocumentProps) {
  const dir = getDirection(locale as 'en' | 'ar');
  const appFont = getFontFamily(locale as 'en' | 'ar');
  return (
    <Html lang={locale} dir={dir} style={{ ['--app-font' as string]: appFont }} suppressHydrationWarning>
      <Head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" type="image/svg+xml" href="/Fanek_logo_light.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

Document.getInitialProps = async (ctx: DocumentContext): Promise<DocumentProps> => {
  const initialProps = await ctx.defaultGetInitialProps(ctx);
  const { locale, source } = await resolveLocaleWithSource(ctx.req);
  // _app reads the language from the cookie, so the shell and the strings would
  // otherwise disagree on a device that has never chosen one. Only a token-sourced
  // answer is published: see resolveLocaleWithSource.
  if (source === 'token') publishLocaleCookie(ctx.req, ctx.res, locale);
  return { ...initialProps, locale };
};
