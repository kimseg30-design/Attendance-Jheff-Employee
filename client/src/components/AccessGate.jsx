import CheckingAccess from './CheckingAccess';
import { useAuth, logout } from '@/zite/auth';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useRole } from '../services/role';
export default function AccessGate({ children }) {
    const { user } = useAuth();
    const { role, permissions, isLoading } = useRole(user);
    if (isLoading)
        return <CheckingAccess />;
    if (role === 'Admin' || role === 'Viewer' || (role === 'Editor' && permissions.length > 0))
        return <>{children}</>;
    return (<div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-primary"/>
        <h1 className="text-lg font-bold">Waiting for access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You're signed in as <span className="font-medium text-foreground">{user?.email}</span>, but an admin hasn't approved your account yet.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => logout()}>Sign out</Button>
      </div>
    </div>);
}
