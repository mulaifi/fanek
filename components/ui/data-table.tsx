import * as React from 'react';
import {
  ColumnDef,
  SortingState,
  OnChangeFn,
  Row,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getExpandedRowModel,
  ExpandedState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  pageCount?: number;
  pageIndex?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  getRowCanExpand?: (row: Row<TData>) => boolean;
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactNode;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SKELETON_ROW_COUNT = 5;

export function DataTable<TData, TValue>({
  columns,
  data,
  sorting,
  onSortingChange,
  pageCount,
  pageIndex = 0,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No records found',
  getRowCanExpand,
  renderSubComponent,
}: DataTableProps<TData, TValue>) {
  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  // Only one row expanded at a time: when expanded changes, enforce single-row constraint
  const handleExpandedChange: OnChangeFn<ExpandedState> = (updater) => {
    setExpanded((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // If more than one row is expanded, keep only the newly added one
      const prevKeys = Object.keys(prev).filter((k) => (prev as Record<string, boolean>)[k]);
      const nextKeys = Object.keys(next as Record<string, boolean>).filter(
        (k) => (next as Record<string, boolean>)[k]
      );
      if (nextKeys.length > 1) {
        const newKey = nextKeys.find((k) => !prevKeys.includes(k));
        return newKey ? { [newKey]: true } : {};
      }
      return next;
    });
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: sorting ?? [],
      expanded,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onSortingChange,
    onExpandedChange: handleExpandedChange,
    getRowCanExpand,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: pageCount ?? -1,
  });

  const hasExpansion = !!getRowCanExpand && !!renderSubComponent;
  const totalColumns = columns.length + (hasExpansion ? 1 : 0);
  const currentPage = pageIndex + 1;
  const totalPages = pageCount ?? 1;
  const canGoPrev = currentPage > 1;
  const canGoNext = pageCount != null ? currentPage < pageCount : false;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {hasExpansion && <TableHead className="w-10" />}
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          className="flex items-center gap-1 font-medium hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDir === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sortDir === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {hasExpansion && (
                    <TableCell>
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                  )}
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    className={cn(
                      onRowClick && 'cursor-pointer hover:bg-muted/50',
                      row.getIsExpanded() && 'bg-muted/30'
                    )}
                    onClick={() => {
                      if (hasExpansion && row.getCanExpand()) {
                        row.toggleExpanded();
                      }
                      onRowClick?.(row.original);
                    }}
                  >
                    {hasExpansion && (
                      <TableCell className="w-10">
                        {row.getCanExpand() ? (
                          row.getIsExpanded() ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )
                        ) : null}
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {hasExpansion && row.getIsExpanded() && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={totalColumns} className="p-0">
                        {renderSubComponent!({ row })}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange?.(Number(v))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(pageIndex - 1)}
            disabled={!canGoPrev || isLoading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(pageIndex + 1)}
            disabled={!canGoNext || isLoading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
