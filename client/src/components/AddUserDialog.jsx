import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { UserPlus, CheckCircle2 } from 'lucide-react';
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

    const emailOk = emailSchema.safeParse(email).success;
    const valid = emailOk && (role !== 'Editor' || perms.length > 0);

    const add = useMutation({
        mutationFn: () => inviteUser({ email: email.trim(), role, permissions: role === 'Editor' ? perms : [] }),
        onSuccess: async (result) => {
            const trimmedEmail = email.trim();
            setCreatedInvite({ email: trimmedEmail, role, invited: result.invited });
            await Promise.all([qc.invalidateQueries({ queryKey: ['users'] }), qc.invalidateQueries({ queryKey: ['invites'] })]);
            toast.success(result.invited ? `Supabase invitation email sent to ${trimmedEmail}.` : `Access role updated for ${trimmedEmail}.`);
        },
        onError: (e) => toast.error(e.message || 'Could not add user'),
    });

    const toggle = (p, on) => setPerms((cur) => (on ? [...new Set([...cur, p])] : cur.filter((x) => x !== p)));

    const handleClose = () => {
        setOpen(false);
        setCreatedInvite(null);
        setEmail('');
        setRole('Viewer');
        setPerms(['attendance']);
        setTouched(false);
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
                <DialogTitle className="text-lg">{createdInvite.invited ? 'Invitation Email Sent' : 'Access Updated'}</DialogTitle>
                <DialogDescription>
                  {createdInvite.invited
                    ? <>Supabase sent an account invitation to <b>{createdInvite.email}</b>. Their <b>{createdInvite.role}</b> access is assigned after sign in.</>
                    : <><b>{createdInvite.email}</b> already has an account. Their access is now <b>{createdInvite.role}</b>.</>}
                </DialogDescription>
              </div>
              {createdInvite.invited && <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5 text-muted-foreground">
                <p className="font-semibold text-foreground">Next step</p>
                <p>They must open the Supabase invitation email and complete sign in with that account.</p>
              </div>}
              <DialogFooter>
                <Button type="button" onClick={handleClose} className="w-full">Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Invite user</DialogTitle>
                <DialogDescription>Supabase sends an account invitation. Access requires signing in with that account.</DialogDescription>
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
                  <Button type="submit" disabled={!valid || add.isPending}>{add.isPending ? 'Inviting…' : 'Send invitation'}</Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>);
}
