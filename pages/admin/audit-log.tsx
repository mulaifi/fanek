import { useState, useEffect, useCallback } from 'react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { getAuthOptions } from '@/lib/auth/options';
import type { ColumnDef, Row } from '@tanstack/react-table';
import AppShell from '@/components/AppShell';
import { DataTable } from '@/components/ui/data-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ACTION_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CREATE: 'default',
  UPDATE: 'outline',
  DELETE: 'destructive',
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

  const [filterAction, setFilterAction] = useState<string>('');
  const [filterResource, setFilterResource] = useState<string>('');
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');

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
    loadPage(null);
  }, [loadPage]);

  function handlePageChange(pageIndex: number) {
    if (pageIndex > currentPage) {
      if (!nextCursor) return;
      const newCursors = [...cursors, nextCursor];
      setCursors(newCursors);
      setCurrentPage(pageIndex);
      loadPage(nextCursor);
    } else if (pageIndex < currentPage) {
      setCurrentPage(pageIndex);
      loadPage(cursors[pageIndex]);
    }
  }

  // Calculate total page count for DataTable
  const totalRecords = nextCursor
    ? (currentPage + 2) * PAGE_SIZE
    : (currentPage + 1) * PAGE_SIZE;
  const pageCount = Math.ceil(totalRecords / PAGE_SIZE);

  const columns: ColumnDef<AuditLogEntry>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Timestamp',
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'user',
      header: 'User',
      cell: ({ row }) => (
        <div className="flex flex-col gap-0">
          <span className="text-sm">{row.original.user?.name || '-'}</span>
          <span className="text-xs text-muted-foreground">{row.original.user?.email}</span>
        </div>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <Badge variant={ACTION_BADGE_VARIANT[row.original.action] || 'secondary'}>
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: 'resource',
      header: 'Resource',
    },
    {
      accessorKey: 'resourceId',
      header: 'Resource ID',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.resourceId
            ? row.original.resourceId.length > 12
              ? `${row.original.resourceId.substring(0, 12)}...`
              : row.original.resourceId
            : '-'}
        </span>
      ),
    },
  ];

  function renderSubComponent({ row }: { row: Row<AuditLogEntry> }) {
    if (!row.original.details) {
      return (
        <p className="text-sm text-muted-foreground p-4">No details available.</p>
      );
    }
    return (
      <pre className="font-mono bg-muted p-3 rounded text-sm overflow-auto whitespace-pre-wrap">
        {JSON.stringify(row.original.details, null, 2)}
      </pre>
    );
  }

  return (
    <AppShell title="Audit Log">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Action</Label>
          <Select
            value={filterAction || '_all'}
            onValueChange={(v) => setFilterAction(v === '_all' ? '' : v)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All actions</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Resource</Label>
          <Select
            value={filterResource || '_all'}
            onValueChange={(v) => setFilterResource(v === '_all' ? '' : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All resources</SelectItem>
              {RESOURCES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="filter-from"
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="filter-to"
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        isLoading={loading}
        emptyMessage="No audit log entries found"
        pageCount={pageCount}
        pageIndex={currentPage}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        getRowCanExpand={() => true}
        renderSubComponent={renderSubComponent}
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
