import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
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
    const emailOk = emailSchema.safeParse(email).success;
    const valid = emailOk && (role !== 'Editor' || perms.length > 0);
    const add = useMutation({
        mutationFn: () => inviteUser({ email: email.trim(), role, permissions: role === 'Editor' ? perms : [] }),
        onSuccess: async () => {
            await Promise.all([qc.invalidateQueries({ queryKey: ['users'] }), qc.invalidateQueries({ queryKey: ['invites'] })]);
            toast.success(`${email.trim()} can now sign in with their email or Google.`);
            setOpen(false);
            setEmail('');
            setRole('Viewer');
            setPerms(['attendance']);
            setTouched(false);
        },
        onError: (e) => toast.error(e.message || 'Could not add user'),
    });
    const toggle = (p, on) => setPerms((cur) => (on ? [...new Set([...cur, p])] : cur.filter((x) => x !== p)));
    return (<>
      <Button onClick={() => setOpen(true)}><UserPlus className="mr-2 h-4 w-4"/>Add user</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>They'll be able to sign in to the app with this email (magic link or Google).</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid)
        add.mutate(); }}>
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!valid || add.isPending}>{add.isPending ? 'Adding…' : 'Add user'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>);
}
