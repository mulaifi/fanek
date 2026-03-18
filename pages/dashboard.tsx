import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { Users, HeartHandshake, Layers } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { getAuthOptions } from '@/lib/auth/options';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import AppShell from '@/components/AppShell';
import { statusColors } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
}

function StatCard({ label, value, icon: Icon, iconClassName }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">
              {label}
            </span>
            <span className="text-4xl font-semibold leading-none">
              {value ?? (
                <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" />
              )}
            </span>
          </div>
          <Icon className={cn('h-9 w-9 opacity-70', iconClassName)} />
        </div>
      </CardContent>
    </Card>
  );
}

interface DashboardStats {
  totalCustomers: number;
  totalServices: number;
  totalPartners: number;
  customersByStatus: { status: string; count: number }[];
  servicesByType: { name: string; count: number }[];
  recentCustomers: {
    id: string;
    name: string;
    clientCode?: string | null;
    status: string;
    updatedAt: string;
  }[];
}

type RecentCustomer = DashboardStats['recentCustomers'][number];

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

  const recentCustomerColumns: ColumnDef<RecentCustomer>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      enableSorting: true,
    },
    {
      accessorKey: 'clientCode',
      header: 'Client Code',
      cell: ({ row }) => row.original.clientCode || '-',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge className={cn('border-0', statusColors[row.original.status] || '')}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: 'Last Updated',
      cell: ({ row }) => dayjs(row.original.updatedAt).format('DD MMM YYYY'),
    },
  ];

  return (
    <AppShell title="Dashboard">
      {loading ? (
        <div className="flex items-center justify-center mt-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total Customers"
              value={stats?.totalCustomers}
              icon={Users}
              iconClassName="text-primary"
            />
            <StatCard
              label="Total Services"
              value={stats?.totalServices}
              icon={Layers}
              iconClassName="text-violet-500"
            />
            <StatCard
              label="Total Partners"
              value={stats?.totalPartners}
              icon={HeartHandshake}
              iconClassName="text-green-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="font-semibold mb-4">Customers by Status</p>
                {!stats?.customersByStatus?.length ? (
                  <p className="text-muted-foreground text-sm">No data available</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {stats.customersByStatus.map((s) => (
                      <div key={s.status} className="flex justify-between items-center">
                        <Badge className={cn('border-0', statusColors[s.status] || '')}>
                          {s.status}
                        </Badge>
                        <span className="text-sm font-semibold">{s.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="font-semibold mb-4">Services by Type</p>
                {!servicesByTypeData.length ? (
                  <p className="text-muted-foreground text-sm">No data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={servicesByTypeData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip />
                      <Bar dataKey="Count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              <p className="font-semibold mb-4">Recently Updated Customers</p>
              <DataTable
                columns={recentCustomerColumns}
                data={stats?.recentCustomers || []}
                emptyMessage="No customers yet"
                onRowClick={(row) => router.push(`/customers/${row.id}`)}
              />
            </CardContent>
          </Card>
        </div>
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
