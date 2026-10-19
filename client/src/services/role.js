import { useQuery } from '@tanstack/react-query';
import { getMyRole } from '@/zite/api';
const DEFAULT_ADMIN_EMAIL = 'kimsegarra4@gmail.com';

export function useRole(user) {
    const isDefaultAdmin = user?.email?.trim().toLowerCase() === DEFAULT_ADMIN_EMAIL;
    const hasPreApprovedAdminSession = typeof window !== 'undefined'
        && window.localStorage.getItem('sahod_admin_session') === 'true';
    const { data, isLoading } = useQuery({
        queryKey: ['myRole', user?.id, isDefaultAdmin, hasPreApprovedAdminSession],
        queryFn: () => isDefaultAdmin || hasPreApprovedAdminSession
            ? { role: 'Admin', permissions: [] }
            : getMyRole({}),
        enabled: Boolean(user),
        staleTime: 5 * 60_000,
    });
    const role = isDefaultAdmin || hasPreApprovedAdminSession ? 'Admin' : (data?.role ?? 'None');
    const permissions = data?.permissions ?? [];
    return {
        role,
        permissions,
        isAdmin: role === 'Admin',
        isEditor: role === 'Editor',
        canEditTable: (table) => role === 'Admin' || (role === 'Editor' && (table === 'attendance' ? permissions.includes('attendance') : table === 'cashAdvances' ? permissions.includes('cashAdvances') : false)),
        hasModule: (permission) => role === 'Admin' || role === 'Viewer' || (role === 'Editor' && permissions.includes(permission)),
        isLoading,
    };
}
