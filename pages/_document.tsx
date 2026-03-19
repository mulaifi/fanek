import { Html, Head, Main, NextScript } from 'next/document';
import type { DocumentContext, DocumentInitialProps } from 'next/document';
import { getLocaleFromCookies, getDirection, getFontFamily } from '@/lib/i18n';

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
  const locale = getLocaleFromCookies(ctx.req?.headers.cookie);
  return { ...initialProps, locale };
};
