import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Loader2 } from 'lucide-react';
import FieldInput from './FieldInput';
import { firstId } from '../utils/format';
function toForm(fields, rec) {
    return Object.fromEntries(fields.map((f) => {
        const v = rec?.[f.key];
        if (f.type === 'link')
            return [f.key, firstId(v) ?? ''];
        if (f.type === 'checkbox')
            return [f.key, v ?? f.defaultValue ?? false];
        return [f.key, v ?? f.defaultValue ?? ''];
    }));
}
export default function RecordDialog({ open, onOpenChange, title, fields, initial, saving, onSubmit }) {
    const [values, setValues] = useState({});
    const [errors, setErrors] = useState({});
    useEffect(() => {
        if (open) {
            setValues(toForm(fields, initial));
            setErrors({});
        }
    }, [open, initial, fields]);
    const validate = (v) => {
        const e = {};
        for (const f of fields) {
            if (f.required && (v[f.key] === '' || v[f.key] == null))
                e[f.key] = `${f.label} is required`;
            if (f.type === 'number' && v[f.key] !== '' && Number(v[f.key]) < 0)
                e[f.key] = 'Must be 0 or more';
            if (f.type === 'time' && v[f.key] && !/^\d{2}:\d{2}$/.test(v[f.key]))
                e[f.key] = 'Use HH:MM';
        }
        return e;
    };
    const isValid = Object.keys(validate(values)).length === 0;
    const submit = () => {
        const e = validate(values);
        setErrors(e);
        if (Object.keys(e).length)
            return;
        const out = {};
        for (const f of fields) {
            const v = values[f.key];
            if (f.type === 'number')
                out[f.key] = v === '' ? null : Number(v);
            else if (f.type === 'link')
                out[f.key] = v ? [v] : [];
            else
                out[f.key] = v === '' ? null : v;
        }
        onSubmit(out);
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          {fields.map((f) => (<FieldInput key={f.key} field={f} value={values[f.key]} error={errors[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}/>))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !isValid}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
