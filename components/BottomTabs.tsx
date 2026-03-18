import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Box, Text, UnstyledButton, useMantineTheme } from '@mantine/core';
import {
  IconLayoutDashboard,
  IconUsers,
  IconHeartHandshake,
  IconSettings,
  type TablerIcon,
} from '@tabler/icons-react';

interface NavTab {
  href: string;
  label: string;
  icon: TablerIcon;
}

const mainTabs: NavTab[] = [
  { href: '/dashboard', label: 'Home', icon: IconLayoutDashboard },
  { href: '/customers', label: 'Customers', icon: IconUsers },
  { href: '/partners', label: 'Partners', icon: IconHeartHandshake },
];

const adminTab: NavTab = { href: '/admin/users', label: 'Admin', icon: IconSettings };

export default function BottomTabs() {
  const router = useRouter();
  const { data: session } = useSession();
  const theme = useMantineTheme();

  const isAdmin = session?.user?.role === 'ADMIN';
  const tabs = isAdmin ? [...mainTabs, adminTab] : mainTabs;

  function isActive(href: string): boolean {
    return router.pathname === href || router.pathname.startsWith(href + '/');
  }

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: 'var(--mantine-color-body)',
        borderTop: '1px solid var(--mantine-color-default-border)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Box style={{ display: 'flex', width: '100%', height: '100%' }}>
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          return (
            <UnstyledButton
              key={tab.href}
              onClick={() => router.push(tab.href)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 2,
                color: active ? theme.colors.brand?.[5] ?? theme.colors.violet[5] : 'var(--mantine-color-dimmed)',
              }}
            >
              <Icon size={22} />
              <Text size="10px" fw={active ? 600 : 400}>
                {tab.label}
              </Text>
            </UnstyledButton>
          );
        })}
      </Box>
    </Box>
  );
}
