import CheckingAccess from './CheckingAccess';
import AccessRestricted from './AccessRestricted';
import { useRole } from '../services/role';

export default function AdminOnlyGate({ moduleName, children }) {
  const { isAdmin, isLoading } = useRole();

  if (isLoading) {
    return <CheckingAccess />;
  }

  if (!isAdmin) {
    return <AccessRestricted moduleName={moduleName || 'This Module'} requiredRole="Administrator" />;
  }

  return <>{children}</>;
}
