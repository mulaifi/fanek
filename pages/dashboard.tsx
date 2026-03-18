import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import type { TablerIcon } from '@tabler/icons-react';
import { getAuthOptions } from '@/lib/auth/options';
import {
  Badge,
  Center,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { BarChart } from '@mantine/charts';
import { DataTable } from 'mantine-datatable';
import {
  IconUsers,
  IconHeartHandshake,
  IconCategory,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import AppShell from '@/components/AppShell';
import { statusColors, chartColors } from '@/lib/theme';

interface StatCardProps {
  label: string;
  value?: number | null;
  icon: TablerIcon;
  color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <Paper p="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Text size="xs" tt="uppercase" c="dimmed" fw={600}>
            {label}
          </Text>
          <Text size="2rem" fw={600} lh={1}>
            {value ?? <Loader size="sm" />}
          </Text>
        </Stack>
        <Icon size={36} color={color} opacity={0.7} />
      </Group>
    </Paper>
  );
}

interface DashboardStats {
  totalCustomers: number;
  totalServices: number;
  totalPartners: number;
  customersByStatus: { status: string; count: number }[];
  servicesByType: { name: string; count: number }[];
  recentCustomers: { id: string; name: string; clientCode?: string | null; status: string; updatedAt: string }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const servicesByTypeData = (stats?.servicesByType || []).map((s) => ({
    name: s.name,
    Count: s.count,
  }));

  type RecentCustomer = DashboardStats['recentCustomers'][number];
  const recentCustomerColumns: import('mantine-datatable').DataTableColumn<RecentCustomer>[] = [
    {
      accessor: 'name',
      title: 'Name',
      sortable: true,
    },
    {
      accessor: 'clientCode',
      title: 'Client Code',
      render: (row) => row.clientCode || '-',
    },
    {
      accessor: 'status',
      title: 'Status',
      render: (row) => (
        <Badge color={statusColors[row.status] || 'gray'}>
          {row.status}
        </Badge>
      ),
    },
    {
      accessor: 'updatedAt',
      title: 'Last Updated',
      render: (row) => dayjs(row.updatedAt).format('DD MMM YYYY'),
    },
  ];

  return (
    <AppShell title="Dashboard">
      {loading ? (
        <Center mt="xl">
          <Loader />
        </Center>
      ) : (
        <Stack gap="xl">
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <StatCard
              label="Total Customers"
              value={stats?.totalCustomers}
              icon={IconUsers}
              color="var(--mantine-color-brand-5)"
            />
            <StatCard
              label="Total Services"
              value={stats?.totalServices}
              icon={IconCategory}
              color="var(--mantine-color-violet-5)"
            />
            <StatCard
              label="Total Partners"
              value={stats?.totalPartners}
              icon={IconHeartHandshake}
              color="var(--mantine-color-green-6)"
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Paper p="lg">
              <Text fw={600} mb="md">
                Customers by Status
              </Text>
              {!stats?.customersByStatus?.length ? (
                <Text c="dimmed" size="sm">
                  No data available
                </Text>
              ) : (
                <Stack gap="xs">
                  {stats.customersByStatus.map((s) => (
                    <Group key={s.status} justify="space-between">
                      <Badge color={statusColors[s.status] || 'gray'}>
                        {s.status}
                      </Badge>
                      <Text size="sm" fw={600}>
                        {s.count}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Paper>

            <Paper p="lg">
              <Text fw={600} mb="md">
                Services by Type
              </Text>
              {!servicesByTypeData.length ? (
                <Text c="dimmed" size="sm">
                  No data available
                </Text>
              ) : (
                <BarChart
                  data={servicesByTypeData}
                  dataKey="name"
                  series={[{ name: 'Count', color: chartColors.dark[0] }]}
                  h={300}
                  gridAxis="y"
                  tickLine="y"
                />
              )}
            </Paper>
          </SimpleGrid>

          <Paper p="lg">
            <Text fw={600} mb="md">
              Recently Updated Customers
            </Text>
            <DataTable
              records={stats?.recentCustomers || []}
              columns={recentCustomerColumns}
              verticalSpacing="md"
              highlightOnHover
              onRowClick={({ record }) => router.push(`/customers/${record.id}`)}
              noRecordsText="No customers yet"
              withTableBorder={false}
            />
          </Paper>
        </Stack>
      )}
    </AppShell>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
}
