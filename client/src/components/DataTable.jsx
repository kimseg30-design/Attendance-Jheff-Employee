import { useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, } from '@tanstack/react-table';
import { Checkbox } from '@/shared/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { ArrowUpDown, ChevronLeft, ChevronRight, Inbox, Search } from 'lucide-react';
export default function DataTable({ columns: baseColumns, data, loading, toolbar, searchPlaceholder = 'Search…', selectionActions }) {
    const [sorting, setSorting] = useState([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [rowSelection, setRowSelection] = useState({});
    const columns = useMemo(() => !selectionActions ? baseColumns : [{
            id: 'select', enableSorting: false,
            header: ({ table }) => (<Checkbox aria-label="Select page" checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}/>),
            cell: ({ row }) => <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)}/>,
        }, ...baseColumns], [baseColumns, selectionActions]);
    const table = useReactTable({
        data, columns, state: { sorting, globalFilter, rowSelection },
        onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter, onRowSelectionChange: setRowSelection,
        getRowId: (r) => r.id, enableRowSelection: !!selectionActions,
        getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 12 } },
    });
    const rows = table.getRowModel().rows;
    const total = table.getFilteredRowModel().rows.length;
    const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
    const clear = () => setRowSelection({});
    return (<div className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={searchPlaceholder} className="h-9 pl-9"/>
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </div>
      {selectionActions && selectedRows.length > 0 && (<div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2">
          <span className="text-sm font-semibold text-primary">{selectedRows.length} selected</span>
          <div className="flex flex-wrap items-center gap-2">{selectionActions(selectedRows, clear)}</div>
          <Button variant="ghost" size="sm" className="ml-auto h-8" onClick={clear}>Clear</Button>
        </div>)}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (<TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                {hg.headers.map((h) => (<TableHead key={h.id} className="h-10 whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                    {h.column.getCanSort() ? (<button className="inline-flex items-center gap-1 hover:text-foreground" onClick={h.column.getToggleSortingHandler()}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <ArrowUpDown className="h-3 w-3 opacity-50"/>
                      </button>) : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>))}
              </TableRow>))}
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (<TableRow key={i}>{columns.map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full max-w-[140px]"/></TableCell>)}</TableRow>)) : rows.length === 0 ? (<TableRow><TableCell colSpan={columns.length} className="h-40 text-center text-muted-foreground">
                <Inbox className="mx-auto mb-2 h-6 w-6 opacity-50"/>No records found
              </TableCell></TableRow>) : rows.map((row) => (<TableRow key={row.id}>
                {row.getVisibleCells().map((c) => <TableCell key={c.id} className="h-12 whitespace-nowrap py-2">{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>)}
              </TableRow>))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between border-t px-3 py-2 text-sm text-muted-foreground">
        <span>{total} record{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <span>Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft className="h-4 w-4"/></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}><ChevronRight className="h-4 w-4"/></Button>
        </div>
      </div>
    </div>);
}
