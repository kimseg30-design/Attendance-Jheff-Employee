import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { DatePicker } from '@/shared/ui/date-picker';
import { getDashboard } from '@/zite/api';
import { Skeleton } from '@/shared/ui/skeleton';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, CalendarX, HandCoins, Plane, Users, Wallet } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/zite/auth';
import PageHeader from '../components/PageHeader';
import { peso } from '../utils/format';
function Stat({ icon: Icon, label, value, sub }) {
    return (<div className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5"/></div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="num mt-0.5 truncate text-xl font-bold">{value}</div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
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
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading || !data ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[84px] rounded-xl"/>) : <>
          <Stat icon={Users} label="Active employees" value={String(data.activeEmployees)}/>
          <Stat icon={CalendarCheck} label={isToday ? 'Present today' : 'Present'} value={String(data.presentToday)} sub={isToday ? undefined : format(parseISO(date), 'MMM d, yyyy')}/>
          <Stat icon={CalendarX} label={isToday ? 'Absent today' : 'Absent'} value={String(data.absentToday)} sub={isToday ? undefined : format(parseISO(date), 'MMM d, yyyy')}/>
          <Stat icon={Plane} label="Pending leaves" value={String(data.pendingLeaves)}/>
          <Stat icon={HandCoins} label="Outstanding loans" value={peso(data.outstandingLoans)}/>
          <Stat icon={Wallet} label="Last net payroll" value={peso(data.lastPayrollTotal)} sub={data.lastPayrollLabel ?? 'No payroll yet'}/>
        </>}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-sm font-bold">Attendance — 14 days to {format(parseISO(date), 'MMM d')}</h3>
          <div className="h-64">
            {isLoading ? <Skeleton className="h-full"/> : (<ResponsiveContainer>
                <BarChart data={(data?.attendanceByDay ?? []).map((d) => ({ ...d, label: format(parseISO(d.date), 'MMM d') }))}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))"/>
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false}/>
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} width={28}/>
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }}/>
                  <Bar dataKey="present" name="Present" stackId="a" fill="hsl(var(--chart-1))"/>
                  <Bar dataKey="absent" name="Absent" stackId="a" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]}/>
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
