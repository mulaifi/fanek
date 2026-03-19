import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useDebounce } from 'use-debounce';
import { useTranslations, useLocale } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  Handshake,
  UserPlus,
  LayoutGrid,
  Settings,
  History,
  Search,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { getDirection, type Locale } from '@/lib/i18n';
import BottomTabs from './BottomTabs';

const RAIL_WIDTH = 56;
const EXPANDED_WIDTH = 240;

interface NavItemDef {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface AppShellProps {
  children: React.ReactNode;
  title: string;
}

interface SpotlightAction {
  id: string;
  label: string;
  description: string;
  group: string;
  onClick: () => void;
}

function useIsDesktop(): boolean {
  // Default to true to match SSR output; updated after mount to avoid hydration mismatch
  const [isDesktop, setIsDesktop] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mql.matches);
    setMounted(true);

    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Before mount, return true (matches SSR) to prevent hydration mismatch
  if (!mounted) return true;
  return isDesktop;
}

interface NavItemProps extends NavItemDef {
  expanded: boolean;
  dir: 'ltr' | 'rtl';
}

function NavItem({ href, label, icon: Icon, expanded, dir }: NavItemProps) {
  const router = useRouter();
  const active = router.pathname === href || router.pathname.startsWith(href + '/');

  const button = (
    <button
      onClick={() => router.push(href)}
      className={[
        'flex items-center gap-3 w-full px-3 py-2.5 rounded-md transition-colors text-start overflow-hidden',
        active
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      ].join(' ')}
    >
      <Icon size={20} className="shrink-0" />
      {expanded && (
        <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">
          {label}
        </span>
      )}
    </button>
  );

  if (expanded) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={dir === 'rtl' ? 'left' : 'right'}>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function AppShell({ children, title }: AppShellProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dir = getDirection(locale as Locale);
  const router = useRouter();
  const { data: session, status } = useSession();
  const isDesktop = useIsDesktop();

  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('sidebar-expanded');
    return stored === null ? true : stored === 'true';
  });

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-expanded', String(next));
      return next;
    });
  };

  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotlightQuery, setSpotlightQuery] = useState('');
  const [debouncedQuery] = useDebounce(spotlightQuery, 300);
  const [spotlightActions, setSpotlightActions] = useState<SpotlightAction[]>([]);

  const isAdmin = session?.user?.role === 'ADMIN';
  const sidebarWidth = expanded ? EXPANDED_WIDTH : RAIL_WIDTH;

  const mainNavItems: NavItemDef[] = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/customers', label: t('nav.customers'), icon: Users },
    { href: '/partners', label: t('nav.partners'), icon: Handshake },
  ];

  const adminNavItems: NavItemDef[] = [
    { href: '/admin/users', label: t('nav.users'), icon: UserPlus },
    { href: '/admin/service-catalog', label: t('nav.serviceCatalog'), icon: LayoutGrid },
    { href: '/admin/settings', label: t('nav.settings'), icon: Settings },
    { href: '/admin/audit-log', label: t('nav.auditLog'), icon: History },
  ];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && session?.user?.firstLogin) {
      router.replace('/profile');
    }
  }, [status, session, router]);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSpotlightOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSpotlightActions([]);
      return;
    }

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data) => {
        const actions: SpotlightAction[] = [];

        const customers = data.customers as Array<{ id: string; name: string; clientCode?: string }> | undefined;
        const partners = data.partners as Array<{ id: string; name: string }> | undefined;
        const services = data.services as Array<{ id: string; name: string; type?: string }> | undefined;

        if (customers && customers.length > 0) {
          customers.forEach((c) => {
            actions.push({
              id: `customer-${c.id}`,
              label: c.name,
              description: c.clientCode ?? 'Customer',
              group: 'Customers',
              onClick: () => {
                router.push(`/customers/${c.id}`);
                setSpotlightOpen(false);
              },
            });
          });
        }

        if (partners && partners.length > 0) {
          partners.forEach((p) => {
            actions.push({
              id: `partner-${p.id}`,
              label: p.name,
              description: 'Partner',
              group: 'Partners',
              onClick: () => {
                router.push(`/partners/${p.id}`);
                setSpotlightOpen(false);
              },
            });
          });
        }

        if (services && services.length > 0) {
          services.forEach((s) => {
            actions.push({
              id: `service-${s.id}`,
              label: s.name,
              description: s.type ?? 'Service',
              group: 'Services',
              onClick: () => {
                router.push(`/services/${s.id}`);
                setSpotlightOpen(false);
              },
            });
          });
        }

        setSpotlightActions(actions);
      })
      .catch(() => {});
  }, [debouncedQuery, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return null;
  }

  const userInitial = session?.user?.name?.charAt(0)?.toUpperCase() ?? '?';

  // Group actions by group label
  const groupedActions = spotlightActions.reduce<Record<string, SpotlightAction[]>>((acc, action) => {
    if (!acc[action.group]) acc[action.group] = [];
    acc[action.group].push(action);
    return acc;
  }, {});

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">

        {/* Spotlight search dialog */}
        <CommandDialog
          open={spotlightOpen}
          onOpenChange={(open) => {
            setSpotlightOpen(open);
            if (!open) setSpotlightQuery('');
          }}
          title="Search"
          description="Search customers, partners, and services"
          showCloseButton={false}
        >
          <CommandInput
            placeholder={t('nav.search')}
            value={spotlightQuery}
            onValueChange={setSpotlightQuery}
          />
          <CommandList>
            {spotlightQuery.length >= 2 && spotlightActions.length === 0 && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {spotlightQuery.length < 2 && (
              <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
            )}
            {Object.entries(groupedActions).map(([group, actions]) => (
              <CommandGroup key={group} heading={group}>
                {actions.map((action) => (
                  <CommandItem
                    key={action.id}
                    onSelect={action.onClick}
                  >
                    <div className="flex flex-col">
                      <span>{action.label}</span>
                      <span className="text-xs text-muted-foreground">{action.description}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </CommandDialog>

        {/* Desktop sidebar */}
        {isDesktop && (
          <div
            style={{
              width: sidebarWidth,
              transition: 'width 200ms ease',
            }}
            className="fixed top-0 start-0 bottom-0 z-[100] flex flex-col overflow-hidden bg-sidebar border-e border-sidebar-border"
          >
            {/* Logo */}
            <div className="flex items-center px-3 gap-3 shrink-0" style={{ height: expanded ? 80 : 52 }}>
              <img
                src="/fanek-logo.svg"
                alt={t('nav.appName')}
                style={{ width: expanded ? 64 : 32, height: expanded ? 64 : 32, flexShrink: 0, transition: 'width 200ms ease, height 200ms ease' }}
              />
              {expanded && (
                <span className="text-lg font-bold text-sidebar-foreground whitespace-nowrap">
                  {t('nav.appName')}
                </span>
              )}
            </div>

            {/* Main nav */}
            <div className="flex-1 px-2 pt-2 overflow-y-auto overflow-x-hidden">
              {mainNavItems.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  expanded={expanded}
                  dir={dir}
                />
              ))}

              {isAdmin && (
                <>
                  <Separator className="my-2" />
                  {expanded && (
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3.5 py-1 whitespace-nowrap">
                      {t('nav.administration')}
                    </span>
                  )}
                  {adminNavItems.map((item) => (
                    <NavItem
                      key={item.href}
                      {...item}
                      expanded={expanded}
                      dir={dir}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Bottom: toggle + avatar */}
            <div className="p-2 shrink-0">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors">
                        <Avatar className="size-8 shrink-0 bg-primary text-primary-foreground">
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                            {userInitial}
                          </AvatarFallback>
                        </Avatar>
                        {expanded && (
                          <span className="text-sm text-sidebar-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                            {session?.user?.name}
                          </span>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  {!expanded && (
                    <TooltipContent side={dir === 'rtl' ? 'left' : 'right'}>
                      {session?.user?.name ?? 'Account'}
                    </TooltipContent>
                  )}
                </Tooltip>
                <DropdownMenuContent side={dir === 'rtl' ? 'left' : 'right'} align="end" sideOffset={8}>
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <User size={16} />
                    {t('nav.profile')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                  >
                    <LogOut size={16} />
                    {t('nav.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`https://github.com/mulaifi/fanek/tree/main/docs/${locale}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('nav.help')}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <HelpCircle size={18} className="shrink-0" />
                    {expanded && (
                      <span className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">{t('nav.help')}</span>
                    )}
                  </a>
                </TooltipTrigger>
                {!expanded && (
                  <TooltipContent side={dir === 'rtl' ? 'left' : 'right'}>
                    {t('nav.help')}
                  </TooltipContent>
                )}
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleExpanded}
                    className="flex items-center justify-center gap-3 w-full px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    {expanded ? (
                      <>
                        <PanelLeftClose size={18} className="shrink-0" />
                        <span className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">{t('nav.collapseSidebar')}</span>
                      </>
                    ) : (
                      <PanelLeftOpen size={18} className="shrink-0" />
                    )}
                  </button>
                </TooltipTrigger>
                {!expanded && (
                  <TooltipContent side={dir === 'rtl' ? 'left' : 'right'}>
                    {t('nav.expandSidebar')}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div
          style={{
            insetInlineStart: isDesktop ? (expanded ? EXPANDED_WIDTH : RAIL_WIDTH) : 0,
            transition: isDesktop ? 'inset-inline-start 200ms ease' : undefined,
          }}
          className="fixed top-0 end-0 h-[52px] z-[99] flex items-center gap-3 px-4 bg-background border-b border-border"
        >
          {/* Page title */}
          <span className="flex-1 text-[18px] font-semibold text-foreground">
            {title}
          </span>

          {/* Search trigger */}
          <button
            onClick={() => setSpotlightOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted border border-border text-muted-foreground min-w-[180px] hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Search size={16} />
            <span className="text-sm">{t('nav.search')}</span>
          </button>

          <LocaleSwitcher />
          <ColorSchemeToggle />
        </div>

        {/* Content area */}
        <main
          style={{
            marginInlineStart: isDesktop ? (expanded ? EXPANDED_WIDTH : RAIL_WIDTH) : 0,
            transition: isDesktop ? 'margin-inline-start 200ms ease' : undefined,
            paddingBottom: isDesktop ? 24 : 72,
          }}
          className="flex-1 mt-[52px] min-w-0 p-4 md:p-6"
        >
          {children}
        </main>

        {/* Mobile bottom tabs */}
        {!isDesktop && <BottomTabs />}
      </div>
    </TooltipProvider>
  );
}
