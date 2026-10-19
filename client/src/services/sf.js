import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sfGetData, sfSave, sfDelete, sfDeclareBalance } from '@/zite/api';
import { toast } from 'sonner';
import { calcLoan, phToday } from '../lib/loanCalc';
export function useSf() {
    const q = useQuery({ queryKey: ['sf'], queryFn: () => sfGetData({}) });
    const data = q.data;
    const calcs = useMemo(() => {
        if (!data)
            return [];
        const today = phToday();
        return data.loans.map((l) => calcLoan(l, data.payments, today));
    }, [data]);
    const memberName = useMemo(() => Object.fromEntries((data?.members ?? []).map((m) => [m.id, m.fullName])), [data]);
    return {
        isLoading: q.isLoading, error: q.error,
        members: (data?.members ?? []), contributions: (data?.contributions ?? []),
        loans: (data?.loans ?? []), payments: (data?.payments ?? []), declarations: (data?.declarations ?? []),
        settings: (data?.settings ?? {}), calcs, memberName,
    };
}
function useInvalidate() {
    const qc = useQueryClient();
    return () => { qc.invalidateQueries({ queryKey: ['sf'] }); qc.invalidateQueries({ queryKey: ['sfAudit'] }); };
}
export function useSfSave() {
    const inv = useInvalidate();
    return useMutation({ mutationFn: (a) => sfSave(a), onSuccess: inv, onError: (e) => toast.error(e.message || 'Could not save') });
}
export function useSfDelete() {
    const inv = useInvalidate();
    return useMutation({ mutationFn: (a) => sfDelete(a), onSuccess: () => { inv(); toast.success('Deleted'); }, onError: (e) => toast.error(e.message || 'Could not delete') });
}
export function useSfDeclare() {
    const inv = useInvalidate();
    return useMutation({ mutationFn: sfDeclareBalance, onSuccess: () => { inv(); toast.success('Balance declared'); }, onError: (e) => toast.error(e.message) });
}
