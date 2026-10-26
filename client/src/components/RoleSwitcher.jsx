import { useState } from 'react';
import { Shield, Eye, CalendarClock, HandCoins, ChevronDown, Check, X, Lock, CheckCircle2, Info, Mail } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Badge } from '@/shared/ui/badge';
import { useAuth } from '@/zite/auth';
import { useRole } from '../services/role';

const ROLE_MODES = [
  {
    id: 'admin',
    name: 'Administrator',
    roleCode: 'Admin',
    displayRole: 'Admin',
    description: 'Full access to all modules, payroll, users & settings',
    icon: Shield,
    badgeColor: 'bg-primary text-primary-foreground',
  },
  {
    id: 'viewer',
    name: 'Viewer',
    roleCode: 'Viewer',
    displayRole: 'Viewer',
    description: 'Read-only view across all app modules',
    icon: Eye,
    badgeColor: 'bg-secondary text-secondary-foreground',
  },
  {
    id: 'editor-att',
    name: 'Editor · Attendance',
    roleCode: 'Editor|attendance',
    displayRole: 'Editor (Attendance)',
    description: 'Attendance only · Can log, edit & delete DTR records',
    icon: CalendarClock,
    badgeColor: 'bg-blue-600 text-white',
  },
  {
    id: 'editor-adv',
    name: 'Editor · Cash Advances',
    roleCode: 'Editor|cashAdvances',
    displayRole: 'Editor (Cash Advances)',
    description: 'Cash Advances only · Can add, edit & record loans',
    icon: HandCoins,
    badgeColor: 'bg-emerald-600 text-white',
  },
];

export default function RoleSwitcher() {
  const { user } = useAuth();
  const { role, permissions, isAdmin, hasModule } = useRole();
  const [infoOpen, setInfoOpen] = useState(false);

  const simulatedCode = (typeof window !== 'undefined' && localStorage.getItem('sahod_simulated_role')) || '';
  const isSimulating = Boolean(simulatedCode && simulatedCode !== 'Admin');

  const switchRoleMode = (roleCode) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('sahod_demo_email');

    if (!roleCode || roleCode === 'Admin') {
      localStorage.removeItem('sahod_simulated_role');
      window.location.assign('/');
      return;
    }

    localStorage.setItem('sahod_simulated_role', roleCode);
    if (roleCode === 'Editor|attendance') {
      window.location.assign('/attendance');
    } else if (roleCode === 'Editor|cashAdvances') {
      window.location.assign('/advances');
    } else {
      window.location.assign('/');
    }
  };

  // Check if current user is an actual system admin (or simulating)
  const isActualAdmin = isAdmin || isSimulating;

  const currentMode = ROLE_MODES.find((m) => m.roleCode === simulatedCode) || ROLE_MODES[0];
  const Icon = role === 'Viewer' ? Eye : role === 'Editor' ? CalendarClock : Shield;

  const displayLabel = role === 'Editor'
    ? `Editor (${permissions.map(p => p === 'cashAdvances' ? 'Advances' : 'Attendance').join(', ') || 'Restricted'})`
    : role === 'Viewer'
    ? 'Viewer (Read-Only)'
    : 'Administrator';

  return (
    <div className="flex items-center gap-1.5">
      {/* Simulation banner button if testing */}
      {isSimulating && (
        <div className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/60 pl-2.5 pr-1 py-0.5 text-xs">
          <span className="flex items-center gap-1 font-medium text-amber-900 dark:text-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Testing: <b>{currentMode.name}</b>
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-200/80 dark:hover:bg-amber-800"
            onClick={() => switchRoleMode('Admin')}
            title="Exit test mode and return to Administrator"
          >
            <X className="mr-1 h-3 w-3" />
            Exit
          </Button>
        </div>
      )}

      {/* If Administrator: dropdown allowing preview testing of other roles */}
      {isActualAdmin ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs font-medium border-border/80 shadow-xs"
              title="Preview or test app as different roles"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Role:</span>
              <span className="font-semibold">{role}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-xs">
              <div className="font-semibold text-foreground">Role Preview & Testing</div>
              <div className="text-[11px] font-normal text-muted-foreground">
                Test how menus, pages, and permissions behave for each role
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {ROLE_MODES.map((m) => {
              const MIcon = m.icon;
              const isSelected = (simulatedCode || 'Admin') === m.roleCode;
              return (
                <DropdownMenuItem
                  key={m.id}
                  className="flex items-start gap-2.5 p-2.5 cursor-pointer"
                  onClick={() => switchRoleMode(m.roleCode)}
                >
                  <div className="mt-0.5 rounded-md bg-muted p-1 text-foreground">
                    <MIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-xs">{m.name}</span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                        {m.displayRole}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                      {m.description}
                    </div>
                  </div>
                  {isSelected && <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        /* If non-admin (Invited Editor or Viewer): click opens their Access Profile dialog */
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs font-medium border-border/80 shadow-xs hover:border-primary/50"
          onClick={() => setInfoOpen(true)}
          title="Click to view your role and module access permissions"
        >
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline font-normal text-muted-foreground">Access:</span>
          <span className="font-semibold truncate max-w-[150px]">{displayLabel}</span>
          <Info className="h-3 w-3 opacity-60" />
        </Button>
      )}

      {/* Non-Admin Access & Permissions Dialog */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-primary" />
              Your Role & Access Permissions
            </DialogTitle>
            <DialogDescription className="text-xs">
              Here are the modules and actions your account is permitted to access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Email:</span>
                <span className="font-semibold text-foreground">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned Role:</span>
                <Badge variant={role === 'Editor' ? 'default' : 'secondary'} className="text-[10px]">
                  {role}
                </Badge>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Permitted Sections
              </h4>
              <div className="space-y-1.5 text-xs">
                {role === 'Editor' ? (
                  <>
                    {hasModule('attendance') && (
                      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40 p-2">
                        <CalendarClock className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-foreground">Attendance (DTR)</div>
                          <div className="text-[11px] text-muted-foreground">Record daily time, compute overtime, and set status</div>
                        </div>
                      </div>
                    )}
                    {hasModule('cashAdvances') && (
                      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40 p-2">
                        <HandCoins className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-foreground">Cash Advances</div>
                          <div className="text-[11px] text-muted-foreground">Issue employee cash advances and track repayments</div>
                        </div>
                      </div>
                    )}
                  </>
                ) : role === 'Viewer' ? (
                  <div className="rounded-md border p-2 text-muted-foreground">
                    All modules are accessible in <strong>Read-Only</strong> mode.
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Locked Sections (Administrator Only)
              </h4>
              <div className="rounded-md border bg-muted/20 p-2.5 text-[11px] space-y-1 text-muted-foreground">
                <div>• <strong>Payroll:</strong> Payslip generation and releasing</div>
                <div>• <strong>Reports:</strong> BIR 2316 tax schedules and TRAIN summaries</div>
                <div>• <strong>Sinking Fund:</strong> Member balances and loans</div>
                <div>• <strong>User Roles:</strong> Account access and invite management</div>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 p-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> Need more access?
              </span>
              <span className="font-semibold text-foreground">Contact: kimsegarra410@gmail.com</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
