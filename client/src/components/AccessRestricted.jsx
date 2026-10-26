import { Link } from 'react-router-dom';
import { ShieldAlert, Lock, CheckCircle2, CalendarClock, HandCoins, Home, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { useAuth } from '@/zite/auth';
import { useRole } from '../services/role';

export default function AccessRestricted({ moduleName = 'This Section', requiredRole = 'Administrator' }) {
  const { user } = useAuth();
  const { role, permissions, hasModule } = useRole();

  const formattedRole = role === 'Editor' 
    ? `Editor (${permissions.length ? permissions.map(p => p === 'cashAdvances' ? 'Cash Advances' : 'Attendance').join(', ') : 'No modules'})`
    : role;

  return (
    <div className="mx-auto max-w-3xl py-8 px-4">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Access Restricted</h1>
            <Badge variant="destructive" className="gap-1 font-semibold text-xs">
              <Lock className="h-3 w-3" />
              {requiredRole} Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            You do not have sufficient permissions to access <strong className="text-foreground">{moduleName}</strong>.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Account & Role info */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Your Current Access Profile
            </CardTitle>
            <CardDescription className="text-xs">
              Permissions enforced by Sahod role-based access control (RBAC)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-1.5 border-b text-xs">
              <span className="text-muted-foreground">Signed in as:</span>
              <span className="font-semibold text-foreground truncate max-w-[180px]">{user?.email || 'Unknown'}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b text-xs">
              <span className="text-muted-foreground">System Role:</span>
              <Badge variant="secondary" className="font-semibold">{role}</Badge>
            </div>
            <div className="py-1.5 text-xs">
              <span className="text-muted-foreground block mb-1.5">Permitted Modules:</span>
              {role === 'Editor' ? (
                <div className="space-y-1">
                  {hasModule('attendance') && (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Attendance (DTR & Daily Time Records)
                    </div>
                  )}
                  {hasModule('cashAdvances') && (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Cash Advances & Loans
                    </div>
                  )}
                  {!hasModule('attendance') && !hasModule('cashAdvances') && (
                    <span className="text-muted-foreground italic">None assigned</span>
                  )}
                </div>
              ) : role === 'Viewer' ? (
                <span className="text-muted-foreground">All modules (Read-only mode)</span>
              ) : (
                <span className="text-muted-foreground">Standard access</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick jump to allowed modules */}
        <Card className="border-border/80 shadow-xs bg-muted/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Where You Can Go
            </CardTitle>
            <CardDescription className="text-xs">
              Quickly switch to modules permitted for your role
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-between h-10 border-border/80 bg-card hover:bg-accent">
              <Link to="/">
                <span className="flex items-center gap-2 text-xs font-semibold">
                  <Home className="h-4 w-4 text-primary" />
                  My Workspace Dashboard
                </span>
                <ArrowRight className="h-3.5 w-3.5 opacity-60" />
              </Link>
            </Button>

            {hasModule('attendance') && (
              <Button asChild variant="outline" className="w-full justify-between h-10 border-border/80 bg-card hover:bg-accent">
                <Link to="/attendance">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <CalendarClock className="h-4 w-4 text-blue-600" />
                    Attendance Records
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                </Link>
              </Button>
            )}

            {hasModule('cashAdvances') && (
              <Button asChild variant="outline" className="w-full justify-between h-10 border-border/80 bg-card hover:bg-accent">
                <Link to="/advances">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <HandCoins className="h-4 w-4 text-emerald-600" />
                    Cash Advances & Loans
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 rounded-lg border border-border/60 bg-card p-4 text-xs text-muted-foreground flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            Need access to <strong>{moduleName}</strong>? Contact an administrator at <strong className="text-foreground">kimsegarra410@gmail.com</strong> to grant permission.
          </span>
        </div>
      </div>
    </div>
  );
}
