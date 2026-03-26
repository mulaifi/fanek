import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import { useSession } from 'next-auth/react';
import type { GetServerSidePropsContext } from 'next';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { getAuthOptions } from '@/lib/auth/options';
import { Search, Plus, Download } from 'lucide-react';
import { useTranslations, useFormatter } from 'next-intl';
import AppShell from '@/components/AppShell';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { statusColors } from '@/lib/theme';
import { DEFAULT_CUSTOMER_STATUSES } from '@/lib/constants';
import { toast } from 'sonner';

const PAGE_SIZE = 25;

interface CustomerRow {
  id: string;
  name: string;
  clientCode?: string | null;
  status: string;
  updatedAt: string;
  _count?: { services: number };
}

export default function CustomersIndexPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations();
  const format = useFormatter();
  const canCreate = ['ADMIN', 'EDITOR'].includes(session?.user?.role ?? '');

  const [records, setRecords] = useState<CustomerRow[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);

  const [searchInput, setSearchInput] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [statuses, setStatuses] = useState<readonly string[]>(DEFAULT_CUSTOMER_STATUSES);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((data) => {
        if (data.customerStatuses?.length) setStatuses(data.customerStatuses);
      })
      .catch(() => {
        toast.error(t('common.networkError'));
      });
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    const sortCol = sorting[0]?.id ?? 'updatedAt';
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc';
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sort: sortCol,
      order: sortDir,
    });
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);

    fetch(`/api/customers?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((data) => {
        setRecords(data.data || []);
        setTotalRecords(data.total || 0);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toast.error(t('common.networkError'));
      });
  }, [page, sorting, statusFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      setPage(1);
      setSearch(searchInput);
    }
  }

  function handleStatusChange(value: string) {
    setPage(1);
    setStatusFilter(value === '__all__' ? '' : value);
  }

  const pageCount = Math.ceil(totalRecords / PAGE_SIZE);

  const columns: ColumnDef<CustomerRow>[] = [
    {
      accessorKey: 'avatar',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex h-7 w-7 items-center justify-center rounded bg-muted text-xs font-semibold uppercase">
          {row.original.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: t('common.name'),
      enableSorting: true,
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{row.original.name}</span>
          {row.original.clientCode && (
            <span className="text-xs text-muted-foreground">{row.original.clientCode}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: t('common.status'),
      enableSorting: false,
      cell: ({ row }) => (
        <Badge className={`border-0 ${statusColors[row.original.status] || 'bg-gray-100 text-gray-600'}`}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'services',
      header: t('customers.services'),
      enableSorting: false,
      cell: ({ row }) => row.original._count?.services ?? 0,
    },
    {
      accessorKey: 'updatedAt',
      header: t('customers.lastUpdated'),
      enableSorting: true,
      cell: ({ row }) =>
        format.dateTime(new Date(row.original.updatedAt), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
    },
  ];

  return (
    <AppShell title={t('customers.title')}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="relative w-[220px]">
              <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('customers.searchPlaceholder')}
                className="ps-8"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <Select
              value={statusFilter || '__all__'}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('customers.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('customers.allStatuses')}</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <Button onClick={() => router.push('/customers/new')}>
                <Plus className="h-4 w-4 me-1" />
                {t('customers.newCustomer')}
              </Button>
            )}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/customers/export"
              className={buttonVariants({ variant: 'outline' })}
            >
              <Download className="h-4 w-4 me-1" />
              {t('customers.exportCsv')}
            </a>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={records}
          sorting={sorting}
          onSortingChange={(updater) => {
            const next = typeof updater === 'function' ? updater(sorting) : updater;
            setSorting(next);
            setPage(1);
          }}
          pageCount={pageCount}
          pageIndex={page - 1}
          pageSize={PAGE_SIZE}
          onPageChange={(idx) => setPage(idx + 1)}
          isLoading={loading}
          emptyMessage={t('customers.noCustomers')}
          onRowClick={(row) => router.push(`/customers/${row.id}`)}
        />
      </div>
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
