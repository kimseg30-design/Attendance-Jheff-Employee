import CheckingAccess from './CheckingAccess';
import AccessRestricted from './AccessRestricted';
import { useRole } from '../services/role';

export default function ModuleAccessGate({ permission, moduleName, children }) {
    const { role, hasModule, isLoading } = useRole();
    if (isLoading)
        return <CheckingAccess />;
    if (role === 'Editor' && !hasModule(permission)) {
        const name = moduleName || (permission === 'attendance' ? 'Attendance' : permission === 'cashAdvances' ? 'Cash Advances' : permission);
        return <AccessRestricted moduleName={name} requiredRole={`Editor with ${name} permission`} />;
    }
    return <>{children}</>;
}
