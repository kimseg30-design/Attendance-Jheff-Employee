import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, X } from 'lucide-react';
import { listInvites, revokeInvite } from '@/zite/api';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
const roleLabel = (r) => (r.startsWith('Editor') ? `Editor (${r.split('|')[1]?.replace('cashAdvances', 'Cash Advances').replace('attendance', 'Attendance').replace(',', ', ') || 'no modules'})` : r);
export default function PendingInvites() {
    const qc = useQueryClient();
    const { data } = useQuery({ queryKey: ['invites'], queryFn: () => listInvites({}) });
    const revoke = useMutation({
        mutationFn: (id) => revokeInvite({ id }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['invites'] }); toast.success('Invite cancelled'); },
        onError: (e) => toast.error(e.message || 'Could not cancel invite'),
    });
    if (!data?.invites.length)
        return null;
    return (<div className="mb-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-muted-foreground"/>Waiting for first sign-in</div>
      <Card className="divide-y">
        {data.invites.map((i) => (<div key={i.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="truncate font-medium">{i.email}</div>
              <Badge variant="secondary" className="mt-1">{roleLabel(i.role)}</Badge>
            </div>
            <Button variant="ghost" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(i.id)} aria-label={`Cancel invite for ${i.email}`}>
              <X className="mr-1 h-4 w-4"/>Cancel
            </Button>
          </div>))}
      </Card>
    </div>);
}
