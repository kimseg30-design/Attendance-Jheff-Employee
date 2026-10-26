import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { DatePicker } from '@/shared/ui/date-picker';
import { getDashboard } from '@/zite/api';
import { Skeleton } from '@/shared/ui/skeleton';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, CalendarX, Clock, Coffee, HandCoins, Plane, Users, Wallet } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/zite/auth';
import PageHeader from '../components/PageHeader';
import { peso } from '../utils/format';

function Stat({ icon: Icon, label, value, sub, iconBg = 'bg-primary/10', iconColor = 'text-primary' }) {
    return (<div className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 shadow-sm hover:border-primary/20 transition-colors">
      <div className={`rounded-lg p-2.5 ${iconBg} ${iconColor}`}><Icon className="h-5 w-5"/></div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="num mt-0.5 truncate text-xl font-bold">{value}</div>
        {sub && <div className="truncate text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>);
}

export default function DashboardPage() {
    const { user } = useAuth();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    const [date, setDate] = useState(today);
    const { data, isLoading } = useQuery({ queryKey: ['dashboard', date], queryFn: () => getDashboard({ date }), placeholderData: keepPreviousData });
    const isToday = date === today;
    const pick = (d) => {
        if (!d)
            return setDate(today);
        const v = format(d, 'yyyy-MM-dd');
        if (v > today) {
            toast.error('Future dates are not available');
            return;
        }
        setDate(v);
    };
    return (<div>
      <PageHeader title={`Magandang araw${user?.firstName ? `, ${user.firstName}` : ''}!`} description={`${isToday ? '' : 'Viewing '}${format(parseISO(date), 'EEEE, MMMM d, yyyy')}`} actions={<>
          <div className="w-44"><DatePicker value={parseISO(date)} onChange={pick}/></div>
          <Button variant="outline" disabled={isToday} onClick={() => setDate(today)}>Today</Button>
        </>}/>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !data ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[84px] rounded-xl"/>) : <>
          <Stat icon={Users} label="Active employees" value={String(data.activeEmployees)} iconBg="bg-blue-500/10" iconColor="text-blue-600 dark:text-blue-400"/>
          <Stat icon={CalendarCheck} label={isToday ? 'Present today' : 'Present'} value={String(data.presentToday)} sub={isToday ? undefined : format(parseISO(date), 'MMM d, yyyy')} iconBg="bg-emerald-500/10" iconColor="text-emerald-600 dark:text-emerald-400"/>
          <Stat icon={Clock} label={isToday ? 'Halfday today' : 'Halfday'} value={String(data.halfdayToday ?? 0)} sub={isToday ? undefined : format(parseISO(date), 'MMM d, yyyy')} iconBg="bg-amber-500/10" iconColor="text-amber-600 dark:text-amber-400"/>
          <Stat icon={Coffee} label={isToday ? 'Rest day today' : 'Rest day'} value={String(data.restDayToday ?? 0)} sub={isToday ? undefined : format(parseISO(date), 'MMM d, yyyy')} iconBg="bg-purple-500/10" iconColor="text-purple-600 dark:text-purple-400"/>
          <Stat icon={CalendarX} label={isToday ? 'Absent today' : 'Absent'} value={String(data.absentToday)} sub={isToday ? undefined : format(parseISO(date), 'MMM d, yyyy')} iconBg="bg-rose-500/10" iconColor="text-rose-600 dark:text-rose-400"/>
          <Stat icon={Plane} label="Pending leaves" value={String(data.pendingLeaves)} iconBg="bg-sky-500/10" iconColor="text-sky-600 dark:text-sky-400"/>
          <Stat icon={HandCoins} label="Cash Advance" value={peso(data.outstandingCashAdvance ?? data.outstandingLoans)} sub="Outstanding balance" iconBg="bg-teal-500/10" iconColor="text-teal-600 dark:text-teal-400"/>
          <Stat icon={Wallet} label="Last net payroll" value={peso(data.lastPayrollTotal)} sub={data.lastPayrollLabel ?? 'No payroll yet'} iconBg="bg-indigo-500/10" iconColor="text-indigo-600 dark:text-indigo-400"/>
        </>}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Attendance — 14 days to {format(parseISO(date), 'MMM d')}</h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"/>Present</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500"/>Halfday</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-500"/>Rest Day</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500"/>Absent</span>
            </div>
          </div>
          <div className="h-64">
            {isLoading ? <Skeleton className="h-full"/> : (<ResponsiveContainer width="100%" height="100%">
                <BarChart data={(data?.attendanceByDay ?? []).map((d) => ({ ...d, label: format(parseISO(d.date), 'MMM d') }))}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))"/>
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false}/>
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} width={28}/>
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="present" name="Present" stackId="a" fill="#10b981"/>
                  <Bar dataKey="halfday" name="Halfday" stackId="a" fill="#f59e0b"/>
                  <Bar dataKey="restDay" name="Rest Day" stackId="a" fill="#a855f7"/>
                  <Bar dataKey="absent" name="Absent" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>)}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-bold">Headcount by department</h3>
          {isLoading ? <Skeleton className="h-64"/> : (<div className="space-y-3">
              {(data?.byDepartment ?? []).map((d) => (<div key={d.name}>
                  <div className="mb-1 flex justify-between text-sm"><span className="truncate">{d.name}</span><span className="num font-semibold">{d.count}</span></div>
                  <div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-[hsl(var(--chart-2))]" style={{ width: `${(d.count / Math.max(1, data?.activeEmployees ?? 1)) * 100}%` }}/></div>
                </div>))}
              {!data?.byDepartment.length && <p className="text-sm text-muted-foreground">No employees yet.</p>}
            </div>)}
        </div>
      </div>
    </div>);
}
