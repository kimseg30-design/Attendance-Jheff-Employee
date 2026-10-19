import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sfGetAudit } from '@/zite/api';
import { Search } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import PageHeader from '../../components/PageHeader';
const fmt = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
export default function SfAuditPage() {
    const { data, isLoading } = useQuery({ queryKey: ['sfAudit'], queryFn: () => sfGetAudit({}) });
    const [q, setQ] = useState('');
    const rows = (data?.entries ?? []).filter((e) => `${e.action} ${e.details} ${e.actor}`.toLowerCase().includes(q.toLowerCase()));
    return (<div>
      <PageHeader title="Audit Log" description="Permanent record of every change to the Sinking Fund. Entries can't be edited or deleted."/>
      <div className="relative mb-4 w-72"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-8" placeholder="Search actions, people, details…" value={q} onChange={(e) => setQ(e.target.value)}/></div>
      <div className="rounded-xl border bg-card shadow-sm">
        {isLoading ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12"/>)}</div> : rows.map((e) => (<div key={e.id} className="flex flex-col gap-1 border-b p-4 text-sm last:border-0 sm:flex-row sm:items-start sm:gap-4">
            <div className="w-44 shrink-0 text-xs text-muted-foreground">{fmt.format(new Date(e.createdAt))} PHT</div>
            <div className="min-w-0 flex-1"><Badge variant={/deleted/i.test(e.action) ? 'destructive' : 'secondary'}>{e.action}</Badge><div className="mt-1 break-words">{e.details}</div></div>
            <div className="shrink-0 text-xs text-muted-foreground">{e.actor}</div>
          </div>))}
        {!isLoading && !rows.length && <p className="p-10 text-center text-sm text-muted-foreground">No audit entries yet.</p>}
      </div>
    </div>);
}
