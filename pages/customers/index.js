import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import { useSession } from 'next-auth/react';
import { getAuthOptions } from '@/lib/auth/options';
import {
  Avatar,
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
import { statusColors } from '@/lib/theme';
import { DEFAULT_CUSTOMER_STATUSES } from '@/lib/constants';

const PAGE_SIZE = 25;

export default function CustomersIndexPage() {
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
  const [statusFilter, setStatusFilter] = useState('Active');
  const [statuses, setStatuses] = useState(DEFAULT_CUSTOMER_STATUSES);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.customerStatuses?.length) setStatuses(data.customerStatuses);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sort: sortStatus.columnAccessor,
      order: sortStatus.direction,
    });
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);

    fetch(`/api/customers?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setRecords(data.data || []);
        setTotalRecords(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, sortStatus, statusFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      setPage(1);
      setSearch(searchInput);
    }
  }

  function handleStatusChange(value) {
    setPage(1);
    setStatusFilter(value || '');
  }

  const statusSelectData = [
    { value: '', label: 'All statuses' },
    ...statuses.map((s) => ({ value: s, label: s })),
  ];

  const columns = [
    {
      accessor: 'avatar',
      title: '',
      width: 48,
      render: (row) => (
        <Avatar radius="sm" bg="dark.6" size="sm">
          {row.name?.charAt(0)?.toUpperCase() || '?'}
        </Avatar>
      ),
    },
    {
      accessor: 'name',
      title: 'Name',
      sortable: true,
      render: (row) => (
        <Stack gap={2}>
          <Text size="sm" fw={500}>
            {row.name}
          </Text>
          {row.clientCode && (
            <Text size="xs" c="dimmed">
              {row.clientCode}
            </Text>
          )}
        </Stack>
      ),
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
      accessor: 'services',
      title: 'Services',
      render: (row) => row._count?.services ?? 0,
    },
    {
      accessor: 'updatedAt',
      title: 'Last Updated',
      sortable: true,
      render: (row) => dayjs(row.updatedAt).format('DD MMM YYYY'),
    },
  ];

  return (
    <AppShell title="Customers">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <TextInput
              placeholder="Name or code..."
              leftSection={<IconSearch size={16} />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              w={220}
            />
            <Select
              placeholder="All statuses"
              data={statusSelectData}
              value={statusFilter}
              onChange={handleStatusChange}
              w={160}
              clearable
            />
          </Group>
          <Group gap="xs">
            {canCreate && (
              <Button
                leftSection={<IconPlus size={16} />}
                color="brand"
                onClick={() => router.push('/customers/new')}
              >
                New customer
              </Button>
            )}
            <Button
              variant="subtle"
              leftSection={<IconDownload size={16} />}
              component="a"
              href="/api/customers/export"
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
          onRowClick={({ record }) => router.push(`/customers/${record.id}`)}
          noRecordsText="No customers found"
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
