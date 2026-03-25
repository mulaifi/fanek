import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import { useSession } from 'next-auth/react';
import type { GetServerSidePropsContext } from 'next';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { getAuthOptions } from '@/lib/auth/options';
import { Search, Plus, Download } from 'lucide-react';
import { useTranslations, useFormatter } from 'next-intl';
import { toast } from 'sonner';
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

const PAGE_SIZE = 25;
const PARTNER_TYPES = ['Reseller', 'Distributor', 'Technology', 'Service', 'Referral', 'Other'];

const TYPE_COLORS: Record<string, string> = {
  Reseller: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Distributor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  Technology: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  Service: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  Referral: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  Other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

interface PartnerRow {
  id: string;
  name: string;
  type?: string | null;
  notes?: string | null;
  updatedAt: string;
}

export default function PartnersIndexPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations();
  const format = useFormatter();
  const canCreate = ['ADMIN', 'EDITOR'].includes(session?.user?.role ?? '');

  const [records, setRecords] = useState<PartnerRow[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);

  const [searchInput, setSearchInput] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

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
    if (typeFilter) params.set('type', typeFilter);
    if (search) params.set('search', search);

    fetch(`/api/partners?${params}`)
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
        toast.error('Failed to load partners');
      });
  }, [page, sorting, typeFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      setPage(1);
      setSearch(searchInput);
    }
  }

  function handleTypeChange(value: string) {
    setTypeFilter(value === '__all__' ? '' : value);
    setPage(1);
  }

  const pageCount = Math.ceil(totalRecords / PAGE_SIZE);

  const columns: ColumnDef<PartnerRow>[] = [
    {
      accessorKey: 'name',
      header: t('common.name'),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'type',
      header: t('common.type'),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.type ? (
          <Badge className={`border-0 ${TYPE_COLORS[row.original.type] || 'bg-gray-100 text-gray-600'}`}>
            {row.original.type}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: 'notes',
      header: t('partners.notes'),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-1">
          {row.original.notes || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: t('common.updatedAt'),
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
    <AppShell title={t('partners.title')}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="relative w-[220px]">
              <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('partners.searchPlaceholder')}
                className="ps-8"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <Select
              value={typeFilter || '__all__'}
              onValueChange={handleTypeChange}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('partners.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('partners.allTypes')}</SelectItem>
                {PARTNER_TYPES.map((pt) => (
                  <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <Button onClick={() => router.push('/partners/new')}>
                <Plus className="h-4 w-4 me-1" />
                {t('partners.newPartner')}
              </Button>
            )}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/partners/export"
              className={buttonVariants({ variant: 'outline' })}
            >
              <Download className="h-4 w-4 me-1" />
              {t('partners.exportCsv')}
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
          emptyMessage={t('partners.noPartners')}
          onRowClick={(row) => router.push(`/partners/${row.id}`)}
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
