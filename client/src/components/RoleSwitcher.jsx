import { Shield, Eye, CalendarClock, HandCoins, ChevronDown, Check, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Badge } from '@/shared/ui/badge';
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
  const { role } = useRole();
  const simulatedCode = (typeof window !== 'undefined' && localStorage.getItem('sahod_simulated_role')) || '';
  const isSimulating = Boolean(simulatedCode && simulatedCode !== 'Admin');

  const switchRoleMode = (roleCode) => {
    if (typeof window === 'undefined') return;
    // Always remove any stale demo emails
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

  const currentMode = ROLE_MODES.find((m) => m.roleCode === simulatedCode) || ROLE_MODES[0];
  const Icon = currentMode.icon || Shield;

  return (
    <div className="flex items-center gap-1.5">
      {isSimulating ? (
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
      ) : null}

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
    </div>
  );
}
