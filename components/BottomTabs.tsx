import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
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

const mainTabs: NavTab[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/partners', label: 'Partners', icon: Handshake },
];

const adminTab: NavTab = { href: '/admin/users', label: 'Admin', icon: Settings };

export default function BottomTabs() {
  const router = useRouter();
  const { data: session } = useSession();

  const isAdmin = session?.user?.role === 'ADMIN';
  const tabs = isAdmin ? [...mainTabs, adminTab] : mainTabs;

  function isActive(href: string): boolean {
    return router.pathname === href || router.pathname.startsWith(href + '/');
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-14 bg-background border-t border-border z-50 flex items-center">
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
