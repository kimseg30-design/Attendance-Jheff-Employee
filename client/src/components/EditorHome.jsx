import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '../services/role';
// Keep the chart-heavy dashboard out of the initial application bundle.
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
export default function EditorHome() {
    const { role, hasModule, isLoading } = useRole();
    if (isLoading)
        return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Checking access…</div>;
    if (role === 'Editor') {
        if (hasModule('attendance'))
            return <Navigate to="/attendance" replace/>;
        if (hasModule('cashAdvances'))
            return <Navigate to="/advances" replace/>;
    }
    return <DashboardPage />;
}
