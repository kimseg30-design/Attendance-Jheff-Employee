import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listRecords, saveRecord, deleteRecord } from '@/zite/api';
import { toast } from 'sonner';

function invalidateRecordData(qc, table, { deleting = false } = {}) {
    const keys = [['records', table], ['dashboard']];

    // Attendance and leave writes also update employee leave credits.
    if (table === 'attendance' || table === 'leaves') keys.push(['records', 'employees']);

    // Deleting a released payslip reverses cash-advance and Sinking Fund ledgers.
    if (table === 'payslips' && deleting) {
        keys.push(['records', 'cashAdvances'], ['sf'], ['sfAudit']);
    }

    // Employee deletion may cascade into attendance, leave, and payslip rows.
    if (table === 'employees' && deleting) keys.push(['records']);

    return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function useRecords(table) {
    return useQuery({
        queryKey: ['records', table],
        queryFn: async () => (await listRecords({ table })).records,
    });
}
export function useSaveRecord(table) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (args) => saveRecord({ table, ...args }),
        onSuccess: () => invalidateRecordData(qc, table),
        onError: (e) => toast.error(e.message || 'Could not save'),
    });
}
export function useDeleteRecord(table) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => deleteRecord({ table, id }),
        onSuccess: () => {
            invalidateRecordData(qc, table, { deleting: true });
            toast.success('Deleted');
        },
        onError: (e) => toast.error(e.message || 'Could not delete'),
    });
}
/** id → display name lookup for linked tables */
const EMPTY_RECORDS = Object.freeze([]);
export function useNameMap(table) {
    const { data } = useRecords(table);
    const list = data ?? EMPTY_RECORDS;
    const key = table === 'employees' ? 'fullName' : 'departmentName';
    const map = useMemo(() => Object.fromEntries(list.map((r) => [r.id, r[key]])), [list, key]);
    return {
        list,
        map,
    };
}
