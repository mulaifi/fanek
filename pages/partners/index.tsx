import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import { useSession } from 'next-auth/react';
import { getAuthOptions } from '@/lib/auth/options';
import {
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconSearch, IconPlus, IconDownload } from '@tabler/icons-react';
import dayjs from 'dayjs';
import AppShell from '@/components/AppShell';

const PAGE_SIZE = 25;
const PARTNER_TYPES = ['Reseller', 'Distributor', 'Technology', 'Service', 'Referral', 'Other'];

const TYPE_COLORS = {
  Reseller: 'blue',
  Distributor: 'cyan',
  Technology: 'violet',
  Service: 'teal',
  Referral: 'orange',
  Other: 'gray',
};

export default function PartnersIndexPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const canCreate = ['ADMIN', 'EDITOR'].includes(session?.user?.role);

  const [records, setRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortStatus, setSortStatus] = useState({ columnAccessor: 'updatedAt', direction: 'desc' });

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sort: sortStatus.columnAccessor,
      order: sortStatus.direction,
    });
    if (typeFilter) params.set('type', typeFilter);
    if (search) params.set('search', search);

    fetch(`/api/partners?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setRecords(data.data || []);
        setTotalRecords(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, sortStatus, typeFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      setPage(1);
      setSearch(searchInput);
    }
  }

  const typeSelectData = [
    { value: '', label: 'All types' },
    ...PARTNER_TYPES.map((t) => ({ value: t, label: t })),
  ];

  const columns = [
    {
      accessor: 'name',
      title: 'Name',
      sortable: true,
      render: (row) => (
        <Text size="sm" fw={500}>
          {row.name}
        </Text>
      ),
    },
    {
      accessor: 'type',
      title: 'Type',
      render: (row) =>
        row.type ? (
          <Badge color={TYPE_COLORS[row.type] || 'gray'}>{row.type}</Badge>
        ) : (
          <Text size="sm" c="dimmed">-</Text>
        ),
    },
    {
      accessor: 'notes',
      title: 'Notes',
      render: (row) => (
        <Text size="sm" c="dimmed" lineClamp={1}>
          {row.notes || '-'}
        </Text>
      ),
    },
    {
      accessor: 'updatedAt',
      title: 'Last Updated',
      sortable: true,
      render: (row) => dayjs(row.updatedAt).format('DD MMM YYYY'),
    },
  ];

  return (
    <AppShell title="Partners">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <TextInput
              placeholder="Partner name..."
              leftSection={<IconSearch size={16} />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              w={220}
            />
            <Select
              placeholder="All types"
              data={typeSelectData}
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v || ''); setPage(1); }}
              w={160}
              clearable
            />
          </Group>
          <Group gap="xs">
            {canCreate && (
              <Button
                leftSection={<IconPlus size={16} />}
                color="brand"
                onClick={() => router.push('/partners/new')}
              >
                New partner
              </Button>
            )}
            <Button
              variant="subtle"
              leftSection={<IconDownload size={16} />}
              component="a"
              href="/api/partners/export"
            >
              Export CSV
            </Button>
          </Group>
        </Group>

        <DataTable
          records={records}
          columns={columns}
          fetching={loading}
          totalRecords={totalRecords}
          recordsPerPage={PAGE_SIZE}
          page={page}
          onPageChange={setPage}
          sortStatus={sortStatus}
          onSortStatusChange={(s) => { setSortStatus(s); setPage(1); }}
          verticalSpacing="md"
          highlightOnHover
          onRowClick={({ record }) => router.push(`/partners/${record.id}`)}
          noRecordsText="No partners found"
        />
      </Stack>
    </AppShell>
  );
}

export async function getServerSideProps(context) {
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
}
