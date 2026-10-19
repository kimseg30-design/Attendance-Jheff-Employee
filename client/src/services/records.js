import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listRecords, saveRecord, deleteRecord } from '@/zite/api';
import { toast } from 'sonner';
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
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['records'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
        onError: (e) => toast.error(e.message || 'Could not save'),
    });
}
export function useDeleteRecord(table) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => deleteRecord({ table, id }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['records'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            toast.success('Deleted');
        },
        onError: (e) => toast.error(e.message || 'Could not delete'),
    });
}
/** id → display name lookup for linked tables */
export function useNameMap(table) {
    const { data = [] } = useRecords(table);
    const key = table === 'employees' ? 'fullName' : 'departmentName';
    return {
        list: data,
        map: Object.fromEntries(data.map((r) => [r.id, r[key]])),
    };
}
