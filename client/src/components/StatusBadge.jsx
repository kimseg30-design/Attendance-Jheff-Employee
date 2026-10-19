import { cn } from '@/shared/lib/utils';
const TONES = {
    success: 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
    warning: 'bg-accent text-accent-foreground',
    danger: 'bg-destructive/10 text-destructive',
    info: 'bg-primary/10 text-primary',
    muted: 'bg-muted text-muted-foreground',
};
const MAP = {
    Present: 'success', Halfday: 'info', Employed: 'success', Approved: 'success', Released: 'success', Paid: 'success', Regular: 'success',
    Pending: 'warning', Draft: 'warning', Probationary: 'warning', Active: 'warning',
    'Special Non-Working': 'warning', 'Cash Advance': 'warning',
    Absent: 'danger', Rejected: 'danger', 'Regular Holiday': 'danger', 'Sick Leave': 'danger',
    'Paid Leave': 'info', Contractual: 'info', 'Vacation Leave': 'info', 'SSS Loan': 'info', 'Rest Day': 'info',
};
export default function StatusBadge({ value }) {
    if (!value)
        return <span className="text-muted-foreground">—</span>;
    return (<span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[MAP[value] ?? 'muted'])}>
      {value}
    </span>);
}
