import CheckingAccess from './CheckingAccess';
import { useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Building2, ClipboardList, FilePlus2, FileSpreadsheet, PiggyBank, Settings, UserRound, Coins, BarChart3, CalendarClock, ChevronsLeft, ChevronsRight, HandCoins, Landmark, LayoutDashboard, Menu, Plane, ShieldCheck, Users, Wallet, Scale } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Sheet, SheetContent } from '@/shared/ui/sheet';
import { cn } from '@/shared/lib/utils';
import { useRole } from '../services/role';
import { logout } from '@/zite/auth';
import { LogOut } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import RoleSwitcher from './RoleSwitcher';
const NAV = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/attendance', label: 'Attendance', icon: CalendarClock },
    { to: '/payroll', label: 'Payroll', icon: Wallet },
    { to: '/reports', label: 'Reports', icon: FileSpreadsheet },
    { to: '/employees', label: 'Employees', icon: Users },
    { to: '/leaves', label: 'Leaves', icon: Plane },
    { to: '/advances', label: 'Cash Advances', icon: HandCoins },
    { to: '/loans', label: 'Loans', icon: Landmark },
    { to: '/departments', label: 'Departments', icon: Building2 },
];
const SF_NAV = [
    { to: '/sinking-fund', label: 'Dashboard', icon: BarChart3, admin: false },
    { to: '/sinking-fund/loans', label: 'Loans', icon: PiggyBank, admin: false },
    { to: '/sinking-fund/interest-reconciliation', label: 'Interest Reconciliation', icon: Scale, admin: true },
    { to: '/sinking-fund/add-loan', label: 'Add Loan', icon: FilePlus2, admin: true },
    { to: '/sinking-fund/members', label: 'Members', icon: UserRound, admin: false },
    { to: '/sinking-fund/contributions', label: 'Contributions', icon: Coins, admin: false },
    { to: '/sinking-fund/audit', label: 'Audit Log', icon: ClipboardList, admin: false },
    { to: '/sinking-fund/settings', label: 'Settings', icon: Settings, admin: true },
];
function Nav({ collapsed, onNavigate }) {
    const { isAdmin, role, hasModule } = useRole();
    const items = role === 'Editor'
        ? [
            ...(hasModule('attendance') ? [NAV.find((n) => n.to === '/attendance')] : []),
            ...(hasModule('cashAdvances') ? [NAV.find((n) => n.to === '/advances')] : []),
        ]
        : isAdmin ? [...NAV, { to: '/users', label: 'Users & Roles', icon: ShieldCheck }] : NAV;
    const showSinkingFund = role !== 'Editor';
    return (<nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
      {items.map(({ to, label, icon: Icon }) => (<NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} title={collapsed ? label : undefined} className={({ isActive }) => cn('flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors', isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground', collapsed && 'justify-center px-0')}>
          {({ isActive }) => <><Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-sidebar-primary')}/>{!collapsed && label}</>}
        </NavLink>))}
      {showSinkingFund && (!collapsed ? <div className="px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-widest opacity-60">Sinking Fund</div> : <div className="mx-3 my-3 border-t border-sidebar-border"/>)}
      {showSinkingFund && SF_NAV.filter((n) => isAdmin || !n.admin).map(({ to, label, icon: Icon }) => (<NavLink key={to} to={to} end onClick={onNavigate} title={collapsed ? label : undefined} className={({ isActive }) => cn('flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors', isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground', collapsed && 'justify-center px-0')}>
          {({ isActive }) => <><Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-sidebar-primary')}/>{!collapsed && label}</>}
        </NavLink>))}
    </nav>);
}
function RoleTag() {
    const { role } = useRole();
    return role ? <span className="ml-1.5 rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold">{role}</span> : null;
}
function Brand({ collapsed }) {
    return (<div className={cn('flex h-16 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-extrabold text-sidebar-primary-foreground">₱</div>
      {!collapsed && <div className="leading-tight"><div className="text-sm font-bold text-sidebar-accent-foreground">Sahod</div><div className="text-[11px] opacity-70">Attendance & Payroll<RoleTag /></div></div>}
    </div>);
}
export default function Layout() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobile, setMobile] = useState(false);
    const { role, hasModule, isLoading } = useRole();
    const location = useLocation();
    if (isLoading)
        return <CheckingAccess />;
    if (role === 'Editor') {
        const allowed = (location.pathname === '/attendance' && hasModule('attendance')) || (location.pathname === '/advances' && hasModule('cashAdvances'));
        if (!allowed)
            return <Navigate to={hasModule('attendance') ? '/attendance' : '/advances'} replace/>;
    }
    return (<div className="flex min-h-screen">
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-all md:flex', collapsed ? 'w-16' : 'w-60')}>
        <Brand collapsed={collapsed}/>
        <Nav collapsed={collapsed}/>
        <div className="space-y-1 p-2">
          <Button variant="ghost" size="sm" className={cn('h-10 w-full text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground', collapsed ? 'justify-center px-0' : 'justify-start')} onClick={() => void logout()} aria-label="Log out">
            <LogOut className="h-4 w-4 shrink-0"/>{!collapsed && <span className="ml-2">Log out</span>}
          </Button>
          <button onClick={() => setCollapsed((c) => !c)} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-xs hover:bg-sidebar-accent/60">
            {collapsed ? <ChevronsRight className="h-4 w-4"/> : <><ChevronsLeft className="h-4 w-4"/>Collapse</>}
          </button>
        </div>
      </aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="flex h-full w-60 flex-col border-none bg-sidebar p-0 text-sidebar-foreground">
          <Brand />
          <Nav onNavigate={() => setMobile(false)}/>
          <div className="border-t border-sidebar-border p-3 space-y-2">
            <PWAInstallButton className="w-full justify-start bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90" />
            <Button variant="outline" className="h-11 w-full justify-start border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => void logout()} aria-label="Log out">
              <LogOut className="mr-2 h-4 w-4"/>Log out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b bg-card/95 px-3 backdrop-blur sm:px-4 md:px-8">
          <div className="flex min-w-0 items-center">
            <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => setMobile(true)} aria-label="Open navigation"><Menu className="h-5 w-5"/></Button>
            <span className="ml-2 truncate font-bold md:ml-0">Sahod</span>
          </div>
          <div className="flex items-center gap-2">
            <RoleSwitcher />
            <PWAInstallButton size="sm" variant="outline" className="h-8 text-xs font-semibold" />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 md:p-8"><Outlet /></main>
      </div>
    </div>);
}
