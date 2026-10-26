import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { UserPlus, Copy, Check, ExternalLink, Mail, CheckCircle2 } from 'lucide-react';
import { inviteUser } from '@/zite/api';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Checkbox } from '@/shared/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

const emailSchema = z.string().trim().email();

export default function AddUserDialog() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('Viewer');
    const [perms, setPerms] = useState(['attendance']);
    const [touched, setTouched] = useState(false);
    const [createdInvite, setCreatedInvite] = useState(null);
    const [copied, setCopied] = useState(false);

    const emailOk = emailSchema.safeParse(email).success;
    const valid = emailOk && (role !== 'Editor' || perms.length > 0);

    const add = useMutation({
        mutationFn: () => inviteUser({ email: email.trim(), role, permissions: role === 'Editor' ? perms : [] }),
        onSuccess: async () => {
            const trimmedEmail = email.trim();
            const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/login?email=${encodeURIComponent(trimmedEmail)}&invite=true`;
            setCreatedInvite({ email: trimmedEmail, role, link: inviteUrl });
            await Promise.all([qc.invalidateQueries({ queryKey: ['users'] }), qc.invalidateQueries({ queryKey: ['invites'] })]);
            try {
                navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                toast.success(`Invite link generated & copied to clipboard!`);
            } catch {
                toast.success(`Invite link ready for ${trimmedEmail}`);
            }
        },
        onError: (e) => toast.error(e.message || 'Could not add user'),
    });

    const toggle = (p, on) => setPerms((cur) => (on ? [...new Set([...cur, p])] : cur.filter((x) => x !== p)));

    const handleCopy = () => {
        if (!createdInvite?.link) return;
        navigator.clipboard.writeText(createdInvite.link);
        setCopied(true);
        toast.success('Invitation link copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleClose = () => {
        setOpen(false);
        setCreatedInvite(null);
        setEmail('');
        setRole('Viewer');
        setPerms(['attendance']);
        setTouched(false);
        setCopied(false);
    };

    return (<>
      <Button onClick={() => { setCreatedInvite(null); setOpen(true); }}><UserPlus className="mr-2 h-4 w-4"/>Add user</Button>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); else setOpen(true); }}>
        <DialogContent className="sm:max-w-md">
          {createdInvite ? (
            <div className="space-y-4 py-2">
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-1">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <DialogTitle className="text-lg">Invitation Link Ready</DialogTitle>
                <DialogDescription>
                  Share this direct link with <b>{createdInvite.email}</b> so they can access their <b>{createdInvite.role}</b> account:
                </DialogDescription>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Input
                    readOnly
                    value={createdInvite.link}
                    className="font-mono text-xs bg-muted/50 select-all"
                    onClick={(e) => e.target.select()}
                  />
                  <Button type="button" size="sm" onClick={handleCopy} className="shrink-0 gap-1.5">
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5 text-muted-foreground">
                <p className="font-semibold text-foreground">How they access:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>When they open this link, the app automatically pre-fills their email.</li>
                  <li>They can click <b>"Accept Invitation & Access App"</b> for instant entry.</li>
                  <li>Their role (<b>{createdInvite.role}</b>) is activated on their first login.</li>
                </ul>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                <a
                  href={`mailto:${createdInvite.email}?subject=Invitation%20to%20Sahod%20Payroll%20System&body=Hello,%0D%0A%0D%0AYou%20have%20been%20invited%20to%20access%20the%20Sahod%20Payroll%20System%20as%20a%20${encodeURIComponent(createdInvite.role)}.%0D%0A%0D%0AClick%20this%20link%20to%20open%20the%20app%20and%20sign%20in:%0D%0A${encodeURIComponent(createdInvite.link)}`}
                  className="w-full sm:w-auto"
                >
                  <Button type="button" variant="outline" className="w-full gap-1.5 text-xs">
                    <Mail className="h-3.5 w-3.5" /> Email Link
                  </Button>
                </a>
                <Button type="button" onClick={handleClose} className="w-full sm:flex-1">
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Add user & Generate Invite Link</DialogTitle>
                <DialogDescription>Create an account invite. A direct access link will be generated for them to join.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) add.mutate(); }}>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input id="invite-email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} autoFocus/>
                  {touched && !emailOk && <p className="text-xs text-destructive">Enter a valid email address.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin — Full access</SelectItem>
                      <SelectItem value="Viewer">Viewer — View only</SelectItem>
                      <SelectItem value="Editor">Editor — Selected modules</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {role === 'Editor' && (<div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={perms.includes('attendance')} onCheckedChange={(v) => toggle('attendance', !!v)}/>Attendance</label>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={perms.includes('cashAdvances')} onCheckedChange={(v) => toggle('cashAdvances', !!v)}/>Cash Advances</label>
                    {!perms.length && <p className="text-xs text-destructive sm:col-span-2">Pick at least one module.</p>}
                  </div>)}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
                  <Button type="submit" disabled={!valid || add.isPending}>{add.isPending ? 'Inviting…' : 'Add user & Get Link'}</Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>);
}
