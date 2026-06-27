import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

function ErrorFallback() {
  const t = useTranslations('errorBoundary');
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground max-w-md">{t('message')}</p>
      <Button onClick={() => window.location.reload()}>{t('reload')}</Button>
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time errors anywhere in the component tree and shows a
 * translated fallback instead of an unrecoverable white screen.
 */
export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Client-side crash; surface to the browser console for diagnostics.
    console.error('ErrorBoundary caught an error', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) return <ErrorFallback />;
    return this.props.children;
  }
}
