import { useState, useEffect, useCallback } from 'react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
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

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'yellow',
  DELETE: 'red',
};

const RESOURCES = ['customer', 'service', 'partner', 'user', 'settings', 'serviceType'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE'];

const PAGE_SIZE = 20;

interface AuditLogEntry {
  id: string;
  createdAt: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: unknown;
  user?: { name?: string | null; email?: string | null } | null;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterResource, setFilterResource] = useState<string | null>(null);
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');

  const [expandedRecordIds, setExpandedRecordIds] = useState<string[]>([]);

  const buildUrl = useCallback(
    (cursor: string | null) => {
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
    async (cursor: string | null) => {
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

  function handlePageChange(page: number) {
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
          expanded: { recordIds: expandedRecordIds, onRecordIdsChange: setExpandedRecordIds },
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

export async function getServerSideProps(context: GetServerSidePropsContext) {
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
