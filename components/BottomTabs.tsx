import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  Handshake,
  Settings,
  type LucideIcon,
} from 'lucide-react';

interface NavTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

export default function BottomTabs() {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations('nav');

  const isAdmin = session?.user?.role === 'ADMIN';

  const mainTabs: NavTab[] = [
    { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/customers', label: t('customers'), icon: Users },
    { href: '/partners', label: t('partners'), icon: Handshake },
  ];

  const adminTab: NavTab = { href: '/admin/users', label: t('admin'), icon: Settings };

  const tabs = isAdmin ? [...mainTabs, adminTab] : mainTabs;

  function isActive(href: string): boolean {
    return router.pathname === href || router.pathname.startsWith(href + '/');
  }

  return (
    <div className="fixed bottom-0 start-0 end-0 h-14 bg-background border-t border-border z-50 flex items-center">
      <div className="flex w-full h-full">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          return (
            <button
              type="button"
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className={[
                'flex-1 flex flex-col items-center justify-center h-full gap-0.5',
                'transition-colors',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              <Icon size={22} />
              <span className={['text-[10px]', active ? 'font-semibold' : 'font-normal'].join(' ')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
