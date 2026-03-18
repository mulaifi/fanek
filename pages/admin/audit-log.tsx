import { useState, useEffect, useCallback } from 'react';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth/options';
import {
  Alert,
  Badge,
  Code,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import AppShell from '@/components/AppShell';

const ACTION_COLORS = {
  CREATE: 'green',
  UPDATE: 'yellow',
  DELETE: 'red',
};

const RESOURCES = ['customer', 'service', 'partner', 'user', 'settings', 'serviceType'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE'];

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cursors, setCursors] = useState([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);

  const [filterAction, setFilterAction] = useState(null);
  const [filterResource, setFilterResource] = useState(null);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const [expandedRecordIds, setExpandedRecordIds] = useState([]);

  const buildUrl = useCallback(
    (cursor) => {
      const params = new URLSearchParams();
      if (filterAction) params.set('action', filterAction);
      if (filterResource) params.set('resource', filterResource);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      if (cursor) params.set('cursor', cursor);
      return `/api/admin/audit-log?${params.toString()}`;
    },
    [filterAction, filterResource, filterFrom, filterTo]
  );

  const loadPage = useCallback(
    async (cursor) => {
      setLoading(true);
      setError('');
      const res = await fetch(buildUrl(cursor));
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        setLogs(data.data || []);
        setNextCursor(data.nextCursor || null);
      } else {
        setError(data.error || 'Failed to load audit log');
      }
    },
    [buildUrl]
  );

  useEffect(() => {
    setCursors([null]);
    setCurrentPage(0);
    setExpandedRecordIds([]);
    loadPage(null);
  }, [loadPage]);

  function handlePageChange(page) {
    if (page > currentPage) {
      if (!nextCursor) return;
      const newCursors = [...cursors, nextCursor];
      setCursors(newCursors);
      setCurrentPage(page);
      loadPage(nextCursor);
    } else if (page < currentPage) {
      setCurrentPage(page);
      loadPage(cursors[page]);
    }
  }

  return (
    <AppShell title="Audit Log">
      {error && <Alert color="red" mb="md">{error}</Alert>}

      <Group mb="md" gap="sm" wrap="wrap">
        <Select
          placeholder="Action: All"
          clearable
          value={filterAction}
          onChange={setFilterAction}
          data={ACTIONS.map((a) => ({ value: a, label: a }))}
          style={{ width: 150 }}
        />
        <Select
          placeholder="Resource: All"
          clearable
          value={filterResource}
          onChange={setFilterResource}
          data={RESOURCES.map((r) => ({ value: r, label: r }))}
          style={{ width: 160 }}
        />
        <TextInput
          type="date"
          placeholder="From"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          style={{ width: 160 }}
        />
        <TextInput
          type="date"
          placeholder="To"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          style={{ width: 160 }}
        />
      </Group>

      <DataTable
        records={logs}
        fetching={loading}
        minHeight={200}
        page={currentPage + 1}
        onPageChange={(p) => handlePageChange(p - 1)}
        recordsPerPage={PAGE_SIZE}
        totalRecords={nextCursor ? (currentPage + 2) * PAGE_SIZE : (currentPage + 1) * PAGE_SIZE}
        columns={[
          {
            accessor: 'createdAt',
            title: 'Timestamp',
            render: (log) => (
              <Text size="xs" style={{ whiteSpace: 'nowrap' }}>
                {new Date(log.createdAt).toLocaleString()}
              </Text>
            ),
          },
          {
            accessor: 'user',
            title: 'User',
            render: (log) => (
              <Stack gap={0}>
                <Text size="sm">{log.user?.name || '-'}</Text>
                <Text size="xs" c="dimmed">{log.user?.email}</Text>
              </Stack>
            ),
          },
          {
            accessor: 'action',
            title: 'Action',
            render: (log) => (
              <Badge variant="light" color={ACTION_COLORS[log.action] || 'gray'}>
                {log.action}
              </Badge>
            ),
          },
          { accessor: 'resource', title: 'Resource' },
          {
            accessor: 'resourceId',
            title: 'Resource ID',
            render: (log) => (
              <Text size="xs" ff="monospace">
                {log.resourceId ? `${log.resourceId.substring(0, 12)}...` : '-'}
              </Text>
            ),
          },
        ]}
        rowExpansion={{
          allowMultiple: false,
          expandedRecordIds,
          onRecordIdsChange: setExpandedRecordIds,
          collapseProps: { transitionDuration: 150 },
          content: ({ record }) =>
            record.details ? (
              <Code block p="md" style={{ borderRadius: 0, fontSize: '0.75rem' }}>
                {JSON.stringify(record.details, null, 2)}
              </Code>
            ) : (
              <Text size="sm" c="dimmed" p="md">No details available.</Text>
            ),
        }}
        noRecordsText="No audit log entries found"
      />
    </AppShell>
  );
}

export async function getServerSideProps(context) {
  const options = await getAuthOptions();
  const session = await getServerSession(context.req, context.res, options);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  if (session.user?.role !== 'ADMIN') {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }
  return { props: {} };
}
