import { useLocale } from 'next-intl';
import { setLocaleCookie, type Locale } from '@/lib/i18n';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const { data: session, update } = useSession();

  const switchLocale = async (newLocale: Locale) => {
    if (newLocale === locale) return;
    setLocaleCookie(newLocale);

    // Update user profile if logged in
    if (session?.user) {
      try {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: newLocale }),
        });
        if (res.ok) {
          await update({ locale: newLocale });
        }
      } catch {
        // Cookie is already set, page will reload anyway
      }
    }

    // Full reload required: _document.tsx sets <html lang/dir> and --app-font on SSR,
    // which cannot be updated via client-side router navigation alone.
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-0.5 text-xs font-medium">
      <button
        onClick={() => switchLocale('ar')}
        className={cn(
          'rounded px-1.5 py-0.5 transition-colors',
          locale === 'ar'
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
        )}
      >
        AR
      </button>
      <span className="text-sidebar-foreground/30">|</span>
      <button
        onClick={() => switchLocale('en')}
        className={cn(
          'rounded px-1.5 py-0.5 transition-colors',
          locale === 'en'
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
        )}
      >
        EN
      </button>
    </div>
  );
}
