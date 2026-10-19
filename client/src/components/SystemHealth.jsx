import { useQuery } from '@tanstack/react-query';
import { getSystemHealth } from '@/zite/api';
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { Badge } from '@/shared/ui/badge';
function CheckRow({ label, check }) {
    const Icon = check.status === 'ok' ? CheckCircle2 : check.status === 'warning' ? AlertTriangle : XCircle;
    const tone = check.status === 'ok' ? 'text-primary' : check.status === 'warning' ? 'text-amber-600' : 'text-destructive';
    return (<div className="flex items-start gap-3 rounded-lg border p-3">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`}/>
      <div><div className="text-sm font-semibold">{label}</div><div className="text-sm text-muted-foreground">{check.message}</div></div>
    </div>);
}
export default function SystemHealth() {
    const { data, isLoading, isFetching, refetch, error } = useQuery({ queryKey: ['systemHealth'], queryFn: () => getSystemHealth({}) });
    return (<Card className="mb-5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold"><Activity className="h-4 w-4 text-primary"/>System health</div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}/>Re-check
        </Button>
      </div>
      {isLoading ? <div className="grid gap-2 sm:grid-cols-2"><Skeleton className="h-16"/><Skeleton className="h-16"/></div>
            : error ? <p className="text-sm text-destructive">{error.message || 'Health check failed.'}</p>
                : data && (<>
            <div className="grid gap-2 sm:grid-cols-2">
              <CheckRow label="Database connection" check={data.database}/>
              <CheckRow label="Security lock-down" check={data.security}/>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Last 10 failed or blocked actions</div>
              <Badge variant={data.failuresLast24h ? 'destructive' : 'secondary'}>{data.failuresLast24h} in the last 24 hours</Badge>
            </div>
            <div className="mt-2 divide-y rounded-lg border">
              {data.failures.length === 0 && <p className="p-3 text-sm text-muted-foreground">No failed actions recorded.</p>}
              {data.failures.map((f) => (<div key={f.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="font-medium">{f.summary}</span>{f.endpoint && <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{f.endpoint}</code>}<Badge variant="secondary">{f.errorCode}</Badge></div>
                    <div className="truncate text-xs text-muted-foreground">{f.userEmail || 'Unknown user'} · {f.details}</div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">{f.occurredAt ? new Date(f.occurredAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : ''}</div>
                </div>))}
            </div>
          </>)}
    </Card>);
}
