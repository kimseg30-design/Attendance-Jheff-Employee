import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, X, Copy, ExternalLink, Link2, Check } from 'lucide-react';
import { useState } from 'react';
import { listInvites, revokeInvite } from '@/zite/api';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

const roleLabel = (r) => (r.startsWith('Editor') ? `Editor (${r.split('|')[1]?.replace('cashAdvances', 'Cash Advances').replace('attendance', 'Attendance').replace(',', ', ') || 'no modules'})` : r);

export default function PendingInvites() {
    const qc = useQueryClient();
    const { data } = useQuery({ queryKey: ['invites'], queryFn: () => listInvites({}) });
    const [copiedId, setCopiedId] = useState(null);

    const revoke = useMutation({
        mutationFn: (id) => revokeInvite({ id }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['invites'] }); toast.success('Invite cancelled'); },
        onError: (e) => toast.error(e.message || 'Could not cancel invite'),
    });

    const copyInviteLink = (invite) => {
        const url = `${window.location.origin}/login?email=${encodeURIComponent(invite.email)}&invite=true`;
        navigator.clipboard.writeText(url);
        setCopiedId(invite.id);
        toast.success(`Invite link copied for ${invite.email}! Send this link to the user.`);
        setTimeout(() => setCopiedId(null), 2500);
    };

    if (!data?.invites.length)
        return null;

    return (<div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground"/>Waiting for first sign-in ({data.invites.length})
        </div>
        <span className="text-xs text-muted-foreground">Share the invite link so they can access their assigned modules</span>
      </div>
      <Card className="divide-y">
        {data.invites.map((i) => {
          const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/login?email=${encodeURIComponent(i.email)}&invite=true`;
          const isCopied = copiedId === i.id;
          return (
            <div key={i.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm">{i.email}</span>
                  <Badge variant="secondary">{roleLabel(i.role)}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground font-mono truncate bg-muted/40 p-1.5 rounded max-w-lg">
                  <Link2 className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{inviteUrl}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 gap-1 text-xs" 
                  onClick={() => copyInviteLink(i)}
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {isCopied ? 'Copied' : 'Copy Link'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={() => window.open(inviteUrl, '_blank')}
                  title="Test invite link in a new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs text-destructive hover:bg-destructive/10" 
                  disabled={revoke.isPending} 
                  onClick={() => revoke.mutate(i.id)} 
                  aria-label={`Cancel invite for ${i.email}`}
                >
                  <X className="mr-1 h-3.5 w-3.5"/>Cancel
                </Button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>);
}
