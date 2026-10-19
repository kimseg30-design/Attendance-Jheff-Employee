import { format, parseISO } from 'date-fns';
const pesoFmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
export const peso = (n) => pesoFmt.format(Number(n) || 0);
export const firstId = (v) => (Array.isArray(v) ? v[0] : v || undefined);
export function fmtDate(v) {
    if (!v)
        return '—';
    try {
        return format(parseISO(String(v).slice(0, 10)), 'MMM d, yyyy');
    }
    catch {
        return String(v);
    }
}
export const toISODate = (d) => format(d, 'yyyy-MM-dd');
