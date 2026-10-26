import CheckingAccess from './CheckingAccess';
import AccessRestricted from './AccessRestricted';
import { useRole } from '../services/role';

export function AdminOnlyGate({ moduleName, children }) {
  const { isAdmin, isLoading } = useRole();

  if (isLoading) {
    return <CheckingAccess />;
  }

  if (!isAdmin) {
    return <AccessRestricted moduleName={moduleName || 'This Section'} requiredRole="Administrator" />;
  }

  return <>{children}</>;
}

export function MemberOrEditorGate({ permission, moduleName, children }) {
  const { role, hasModule, isLoading } = useRole();

  if (isLoading) {
    return <CheckingAccess />;
  }

  if (role === 'Admin' || role === 'Viewer') {
    return <>{children}</>;
  }

  if (role === 'Editor') {
    if (permission && hasModule(permission)) {
      return <>{children}</>;
    }
    return <AccessRestricted moduleName={moduleName || 'This Section'} requiredRole="Administrator" />;
  }

  return <AccessRestricted moduleName={moduleName || 'This Section'} requiredRole="Administrator" />;
}
