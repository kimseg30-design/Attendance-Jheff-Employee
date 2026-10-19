import { db } from './supabase';
export const TABLES = ['departments', 'employees', 'attendance', 'leaves', 'cashAdvances', 'payslips'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tableClient(name) {
    return db[name];
}
