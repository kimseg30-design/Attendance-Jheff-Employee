import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { Switch } from '@/shared/ui/switch';
import { DatePicker } from '@/shared/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { parseISO } from 'date-fns';
import { toISODate } from '../utils/format';
export default function FieldInput({ field: f, value, error, onChange }) {
    const v = (value ?? '');
    const wide = f.full || f.type === 'textarea';
    let control;
    if (f.type === 'textarea')
        control = <Textarea value={v} onChange={(e) => onChange(e.target.value)} rows={3}/>;
    else if (f.type === 'checkbox')
        control = <div className="flex h-9 items-center"><Switch checked={!!value} onCheckedChange={onChange}/></div>;
    else if (f.type === 'date')
        control = (<DatePicker value={v ? parseISO(String(v).slice(0, 10)) : undefined} onChange={(d) => onChange(d ? toISODate(d) : '')}/>);
    else if (f.type === 'select' || f.type === 'link') {
        const opts = f.type === 'select' ? (f.options ?? []).map((o) => ({ id: o, name: o })) : (f.linkOptions ?? []);
        control = (<Select value={v || undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={`Select ${f.label.toLowerCase()}`}/></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
      </Select>);
    }
    else
        control = (<Input type={f.type === 'number' ? 'number' : f.type === 'time' ? 'time' : 'text'} step="any" value={v} onChange={(e) => onChange(e.target.value)}/>);
    return (<div className={wide ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
      <Label className="text-xs font-semibold">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
      {control}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>);
}
