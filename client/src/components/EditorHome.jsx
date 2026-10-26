import { Suspense } from 'react';
import lazyWithRetry from '../utils/lazyWithRetry';
import { Link } from 'react-router-dom';
import { CalendarClock, HandCoins, Shield, Lock, CheckCircle2, ArrowRight, Eye, Mail, Info } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { useAuth } from '@/zite/auth';
import { useRole } from '../services/role';

const DashboardPage = lazyWithRetry(() => import('../pages/DashboardPage'));

const RESTRICTED_MODULES = [
  { name: 'Payroll & Payslips', desc: 'Cutoff computation, SSS/PhilHealth/Pag-IBIG calculations, and payslip releasing', path: '/payroll' },
  { name: 'Reports & BIR Forms', desc: 'BIR 2316 tax schedules, TRAIN law deductions, and annual summaries', path: '/reports' },
  { name: 'Employees Masterfile', desc: 'Employee salary profiles, departments, and government registration IDs', path: '/employees' },
  { name: 'Sinking Fund & Loans', desc: 'Capital contributions, member shares, loan interest, and dividend tracking', path: '/sinking-fund' },
  { name: 'Users & Permissions', desc: 'Invite staff, manage roles (Admin/Editor/Viewer), and security logs', path: '/users' },
];

export default function EditorHome() {
  const { user } = useAuth();
  const { role, hasModule, isLoading, isViewer } = useRole();

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Checking access…</div>;
  }

  // If Editor role, show the dedicated Role Access Workspace
  if (role === 'Editor') {
    const hasAttendance = hasModule('attendance');
    const hasAdvances = hasModule('cashAdvances');

    return (
      <div className="space-y-6">
        {/* Welcome & Role Card */}
        <div className="rounded-xl border bg-card p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600 text-white hover:bg-blue-600 font-semibold text-xs">
                  Editor Workspace
                </Badge>
                <span className="text-xs text-muted-foreground">Role Access Active</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                Welcome, {user?.name || user?.email?.split('@')[0] || 'Editor'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed in as <strong className="text-foreground">{user?.email}</strong>. Below is your authorized workspace with permitted operational modules.
              </p>
            </div>
          </div>
        </div>

        {/* Permitted Modules */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Your Authorized Modules
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {hasAttendance && (
              <Card className="border-border/80 shadow-xs hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                      <CalendarClock className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-[11px]">
                      Full Access
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-bold mt-2">Attendance Management</CardTitle>
                  <CardDescription className="text-xs">
                    Log employee daily time entries, monitor tardiness, compute overtime, and assign regular/special holiday statuses.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full justify-between h-9 text-xs font-semibold">
                    <Link to="/attendance">
                      Open Attendance Records
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {hasAdvances && (
              <Card className="border-border/80 shadow-xs hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                      <HandCoins className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-[11px]">
                      Full Access
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-bold mt-2">Cash Advances & Loans</CardTitle>
                  <CardDescription className="text-xs">
                    Issue employee advances, track deductions per cutoff, monitor remaining balances, and maintain cash records.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full justify-between h-9 text-xs font-semibold">
                    <Link to="/advances">
                      Open Cash Advances
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {!hasAttendance && !hasAdvances && (
              <Card className="col-span-2 border-border/80 p-6 text-center text-muted-foreground text-sm">
                No active operational modules are currently assigned to your Editor account. Please contact an administrator.
              </Card>
            )}
          </div>
        </div>

        {/* Restricted Modules Section */}
        <div className="rounded-xl border border-border/80 bg-muted/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Restricted Modules (Administrator Only)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            The following system areas are reserved for Administrators to safeguard financial computation, tax compliance, and user roles:
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {RESTRICTED_MODULES.map((m) => (
              <Link
                key={m.name}
                to={m.path}
                className="group flex flex-col justify-between rounded-lg border border-border/60 bg-card p-3 transition-colors hover:border-border hover:bg-accent/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      {m.name}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      <Lock className="mr-1 h-2.5 w-2.5" />
                      Locked
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                    {m.desc}
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-medium text-primary flex items-center gap-1">
                  Click to view access details <ArrowRight className="h-2.5 w-2.5" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Need higher access privileges?
            </span>
            <span className="font-medium text-foreground">Contact: kimsegarra410@gmail.com</span>
          </div>
        </div>
      </div>
    );
  }

  // Viewer mode banner over standard dashboard
  return (
    <div className="space-y-4">
      {isViewer && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
          <Eye className="h-4 w-4 shrink-0 text-blue-600" />
          <span>
            <strong>Viewer Role Active:</strong> You have read-only visibility across all dashboard metrics and reports. Adding, editing, and releasing records is restricted to Editors and Administrators.
          </span>
        </div>
      )}
      <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading dashboard…</div>}>
        <DashboardPage />
      </Suspense>
    </div>
  );
}
