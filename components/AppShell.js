import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import {
  Box,
  Text,
  Avatar,
  Menu,
  Tooltip,
  Divider,
  UnstyledButton,
  useMantineTheme,
  Group,
} from '@mantine/core';
import { useMediaQuery, useDebouncedValue } from '@mantine/hooks';
import { Spotlight, spotlight } from '@mantine/spotlight';
import {
  IconLayoutDashboard,
  IconUsers,
  IconHeartHandshake,
  IconUserPlus,
  IconCategory,
  IconSettings,
  IconHistory,
  IconSearch,
  IconLogout,
  IconUser,
  IconPin,
  IconPinFilled,
} from '@tabler/icons-react';
import ColorSchemeToggle from './ColorSchemeToggle';
import BottomTabs from './BottomTabs';

const RAIL_WIDTH = 56;
const EXPANDED_WIDTH = 200;

const mainNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { href: '/customers', label: 'Customers', icon: IconUsers },
  { href: '/partners', label: 'Partners', icon: IconHeartHandshake },
];

const adminNavItems = [
  { href: '/admin/users', label: 'Users', icon: IconUserPlus },
  { href: '/admin/service-catalog', label: 'Service Catalog', icon: IconCategory },
  { href: '/admin/settings', label: 'Settings', icon: IconSettings },
  { href: '/admin/audit-log', label: 'Audit Log', icon: IconHistory },
];

function NavItem({ href, label, icon: Icon, expanded, brandColor, theme }) {
  const router = useRouter();
  const active = router.pathname === href || router.pathname.startsWith(href + '/');

  const button = (
    <UnstyledButton
      onClick={() => router.push(href)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 12px',
        borderRadius: 6,
        background: active
          ? `color-mix(in srgb, ${brandColor} 15%, transparent)`
          : 'transparent',
        color: active ? brandColor : theme.colors.dark[2],
        transition: 'background 150ms ease',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = theme.colors.dark[7];
      }}
      onMouseLeave={(e) => {
        if (!active)
          e.currentTarget.style.background = 'transparent';
      }}
    >
      <Icon size={20} style={{ flexShrink: 0, color: active ? brandColor : 'inherit' }} />
      {expanded && (
        <Text size="sm" fw={active ? 600 : 400} style={{ whiteSpace: 'nowrap', color: 'inherit' }}>
          {label}
        </Text>
      )}
    </UnstyledButton>
  );

  return (
    <Tooltip label={label} position="right" withArrow disabled={expanded}>
      {button}
    </Tooltip>
  );
}

export default function AppShell({ children, title }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const theme = useMantineTheme();
  const isDesktop = useMediaQuery(`(min-width: ${theme.breakpoints.md})`, true);

  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-pinned');
    if (stored === 'true') setPinned(true);
  }, []);

  const togglePin = () => {
    setPinned((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-pinned', String(next));
      return next;
    });
  };

  const [spotlightQuery, setSpotlightQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(spotlightQuery, 300);
  const [spotlightActions, setSpotlightActions] = useState([]);

  const brandColor = theme.colors.brand?.[5] ?? theme.colors.violet[5];
  const isAdmin = session?.user?.role === 'ADMIN';
  const expanded = pinned || hovered;
  const sidebarWidth = expanded ? EXPANDED_WIDTH : RAIL_WIDTH;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && session?.user?.firstLogin) {
      router.replace('/profile');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSpotlightActions([]);
      return;
    }

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data) => {
        const actions = [];

        if (data.customers?.length > 0) {
          data.customers.forEach((c) => {
            actions.push({
              id: `customer-${c.id}`,
              label: c.name,
              description: c.clientCode ?? 'Customer',
              group: 'Customers',
              onClick: () => router.push(`/customers/${c.id}`),
            });
          });
        }

        if (data.partners?.length > 0) {
          data.partners.forEach((p) => {
            actions.push({
              id: `partner-${p.id}`,
              label: p.name,
              description: 'Partner',
              group: 'Partners',
              onClick: () => router.push(`/partners/${p.id}`),
            });
          });
        }

        if (data.services?.length > 0) {
          data.services.forEach((s) => {
            actions.push({
              id: `service-${s.id}`,
              label: s.name,
              description: s.type ?? 'Service',
              group: 'Services',
              onClick: () => router.push(`/services/${s.id}`),
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

  return (
    <Box style={{ display: 'flex', minHeight: '100vh', background: 'var(--mantine-color-body)' }}>
      <Spotlight
        actions={spotlightActions}
        query={spotlightQuery}
        onQueryChange={setSpotlightQuery}
        searchProps={{ placeholder: 'Search customers, partners, services...' }}
        nothingFound="No results"
        shortcut={null}
      />

      {/* Desktop sidebar */}
      {isDesktop && (
        <Box
          onMouseEnter={() => !pinned && setHovered(true)}
          onMouseLeave={() => !pinned && setHovered(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: sidebarWidth,
            background: 'var(--mantine-color-dark-9)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            transition: 'width 200ms ease',
            overflow: 'hidden',
          }}
        >
          {/* Logo mark */}
          <Box
            style={{
              height: 52,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <img
              src="/fanek-logo.png"
              alt="Fanek"
              style={{ width: 32, height: 32, flexShrink: 0 }}
            />
            {expanded && (
              <Text size="sm" fw={700} style={{ color: theme.colors.dark[0], whiteSpace: 'nowrap' }}>
                Fanek
              </Text>
            )}
          </Box>

          {/* Main nav */}
          <Box style={{ flex: 1, padding: '8px 8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
            {mainNavItems.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                expanded={expanded}
                brandColor={brandColor}
                theme={theme}
              />
            ))}

            {isAdmin && (
              <>
                <Divider my="xs" color={theme.colors.dark[5]} />
                {expanded && (
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: '#5c5f66',
                      padding: '6px 14px 2px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Administration
                  </Text>
                )}
                {adminNavItems.map((item) => (
                  <NavItem
                    key={item.href}
                    {...item}
                    expanded={expanded}
                    brandColor={brandColor}
                    theme={theme}
                  />
                ))}
              </>
            )}
          </Box>

          {/* Bottom: pin toggle + avatar */}
          <Box style={{ padding: '8px', flexShrink: 0 }}>
            {expanded && (
              <Tooltip label={pinned ? 'Unpin sidebar' : 'Pin sidebar'} position="right" withArrow>
                <UnstyledButton
                  onClick={togglePin}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    color: theme.colors.dark[3],
                  }}
                >
                  {pinned ? <IconPinFilled size={18} /> : <IconPin size={18} />}
                  <Text size="xs" style={{ whiteSpace: 'nowrap' }}>
                    {pinned ? 'Unpin' : 'Pin sidebar'}
                  </Text>
                </UnstyledButton>
              </Tooltip>
            )}
            <Menu position="right-end" withArrow offset={8}>
              <Menu.Target>
                <Tooltip label={session?.user?.name ?? 'Account'} position="right" disabled={expanded} withArrow>
                  <UnstyledButton
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                    }}
                  >
                    <Avatar size={32} style={{ flexShrink: 0, background: brandColor, fontSize: 14 }}>
                      {userInitial}
                    </Avatar>
                    {expanded && (
                      <Text size="sm" style={{ color: theme.colors.dark[1], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session?.user?.name}
                      </Text>
                    )}
                  </UnstyledButton>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconUser size={16} />}
                  onClick={() => router.push('/profile')}
                >
                  Profile
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconLogout size={16} />}
                  color="red"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Box>
        </Box>
      )}

      {/* Top bar */}
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: isDesktop ? (pinned ? EXPANDED_WIDTH : RAIL_WIDTH) : 0,
          right: 0,
          height: 52,
          background: 'var(--mantine-color-body)',
          borderBottom: '1px solid var(--mantine-color-default-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
          zIndex: 99,
          transition: isDesktop ? 'left 200ms ease' : undefined,
        }}
      >
        {/* Page title */}
        <Text size="18px" fw={600} style={{ flex: 1, color: 'var(--mantine-color-text)' }}>
          {title}
        </Text>

        {/* Search trigger */}
        <UnstyledButton
          onClick={() => spotlight.open()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 6,
            background: 'var(--mantine-color-default)',
            border: '1px solid var(--mantine-color-default-border)',
            color: 'var(--mantine-color-dimmed)',
            minWidth: 180,
          }}
        >
          <IconSearch size={16} />
          <Text size="sm">Search...</Text>
        </UnstyledButton>

        <ColorSchemeToggle />
      </Box>

      {/* Content area */}
      <Box
        component="main"
        style={{
          flex: 1,
          marginLeft: isDesktop ? (pinned ? EXPANDED_WIDTH : RAIL_WIDTH) : 0,
          marginTop: 52,
          padding: isDesktop ? 24 : 16,
          paddingBottom: isDesktop ? 24 : 72,
          minWidth: 0,
          transition: isDesktop ? 'margin-left 200ms ease' : undefined,
        }}
      >
        {children}
      </Box>

      {/* Mobile bottom tabs */}
      {!isDesktop && <BottomTabs />}
    </Box>
  );
}
