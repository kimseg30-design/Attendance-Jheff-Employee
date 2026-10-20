import { useQuery } from '@tanstack/react-query';
import { getMyRole } from '@/zite/api';
import { useAuth } from '@/zite/auth';

export function useRole(userProp) {
    const auth = useAuth();
    const user = userProp || auth.user;

    const { data, isLoading } = useQuery({
        queryKey: ['myRole', user?.id, user?.email],
        queryFn: async () => {
            try {
                return await getMyRole({});
            } catch (err) {
                console.warn('[useRole] getMyRole error:', err);
                return { role: 'None', permissions: [] };
            }
        },
        enabled: Boolean(user || !auth.isLoading),
        staleTime: 10_000,
        refetchOnWindowFocus: true,
    });

    const role = data?.role ?? 'None';
    const permissions = data?.permissions ?? [];

    return {
        role,
        permissions,
        isAdmin: role === 'Admin',
        isViewer: role === 'Viewer',
        isEditor: role === 'Editor',
        canEditTable: (table) => {
            if (role === 'Admin') return true;
            if (role === 'Viewer') return false;
            if (role === 'Editor') {
                if (table === 'attendance') return permissions.includes('attendance');
                if (table === 'cashAdvances') return permissions.includes('cashAdvances');
            }
            return false;
        },
        hasModule: (permission) => {
            if (role === 'Admin') return true;
            if (role === 'Viewer') return true;
            if (role === 'Editor') return permissions.includes(permission);
            return false;
        },
        isLoading: auth.isLoading || isLoading,
    };
}
