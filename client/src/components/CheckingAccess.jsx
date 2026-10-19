import { logout } from '@/zite/auth';
import { LogOut } from 'lucide-react';
import { Button } from '@/shared/ui/button';
export default function CheckingAccess({ label = 'Checking access…' }) {
    return (<div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-sm text-muted-foreground">
      <span>{label}</span>
      <Button variant="ghost" size="sm" onClick={() => void logout()} aria-label="Log out">
        <LogOut className="mr-1.5 h-4 w-4"/>Log out
      </Button>
    </div>);
}
