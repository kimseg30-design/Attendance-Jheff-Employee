// Thin Supabase (PostgREST) client with in-memory fallback store
// Keeps camelCase fields, link fields as [id] arrays, findAll/findOne/create/update/delete/bulkCreate.
import './loadEnv.js';
import { ZiteError } from '../zite/backend.js';
import { memoryDb, computeMockDashboard } from './memoryStore.js';

const LINKS = { employee: 'employee_id', department: 'department_id' };
const COLUMNS = {
    departments: ['departmentName', 'description'],
    employees: ['fullName', 'employeeNo', 'position', 'department', 'dailyRate', 'employmentStatus', 'dateHired', 'tin', 'sssNo', 'philHealthNo', 'pagIbigNo', 'leaveCredits', 'active', 'noOfDaysWork'],
    attendance: ['workDate', 'employee', 'timeIn', 'timeOut', 'status', 'dayType', 'lateMinutes', 'overtimeHours', 'overtimePayMode', 'overtimeAmount', 'otherBenefit', 'nightDiffHours', 'remarks'],
    leaves: ['leaveReason', 'employee', 'leaveType', 'startDate', 'endDate', 'days', 'status'],
    cashAdvances: ['description', 'employee', 'type', 'amount', 'deductionPerCutoff', 'balance', 'dateGranted', 'status'],
    payslips: ['periodLabel', 'employee', 'periodStart', 'periodEnd', 'daysWorked', 'daysAbsent', 'basicPay', 'overtimePay', 'otherBenefits', 'nightDiffPay', 'holidayPay', 'lateDeduction', 'grossPay', 'sss', 'philHealth', 'pagIbig', 'withholdingTax', 'loanDeductions', 'cashAdvanceDeduction', 'sinkingContributionDeduction', 'netPay', 'status', 'deductionDetails'],
};
const NUMERIC = /Rate|Credits|Minutes|Hours|Amount|Benefit|Benefits|^days|Days|Pay$|Deduction$|^amount$|^balance$|^sss$|^philHealth$|^pagIbig$|Tax$|Deductions$|PerCutoff$/;
const snake = (s) => LINKS[s] ?? s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const tableName = (t) => snake(t);

function toRow(table, rec) {
    const cols = COLUMNS[table] || Object.keys(rec);
    const row = {};
    for (const key of cols) {
        if (!(key in rec))
            continue;
        let v = rec[key];
        if (Array.isArray(v))
            v = v[0] ?? null;
        if (v instanceof Date)
            v = v.toISOString().slice(0, 10);
        if (v === '' || v === undefined)
            v = null;
        if (v !== null && NUMERIC.test(key))
            v = Number(v);
        if (key === 'active' && typeof v === 'string')
            v = v === 'true';
        row[snake(key)] = v;
    }
    return row;
}

function fromRow(row) {
    const rec = {};
    for (const [k, v] of Object.entries(row)) {
        if (k.endsWith('_id'))
            rec[k.slice(0, -3)] = v ? [v] : [];
        else
            rec[camel(k)] = typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && k !== 'time_in' && k !== 'time_out' ? Number(v) : v;
    }
    return rec;
}

// Convert an in-memory camelCase record to PostgREST-like snake_case row
function itemToDbRow(item) {
    const row = {};
    for (const [k, v] of Object.entries(item)) {
        const sKey = snake(k);
        if (Array.isArray(v)) {
            row[sKey.endsWith('_id') ? sKey : sKey + '_id'] = v[0] ?? null;
        } else {
            row[sKey] = v;
        }
    }
    return row;
}

// Handle in-memory database queries when Supabase is not connected
function handleMemoryRequest(path, init = {}) {
    const url = new URL(`http://localhost${path}`);
    const pathname = url.pathname;
    const method = init.method || 'GET';

    // RPC calls
    if (pathname.includes('/rpc/get_dashboard')) {
        return computeMockDashboard();
    }

    // Extract table from /rest/v1/<table_name>
    const match = pathname.match(/\/rest\/v1\/([^/?#]+)/);
    if (!match) return [];
    const tblName = match[1];

    // Find table in memoryDb
    let memoryKey = tblName;
    if (tblName === 'cash_advances') memoryKey = 'cashAdvances';
    if (!memoryDb[memoryKey]) memoryDb[memoryKey] = [];

    if (method === 'GET') {
        let items = [...memoryDb[memoryKey]];

        // Apply filters from searchParams
        for (const [key, value] of url.searchParams.entries()) {
            if (['select', 'order', 'limit', 'offset'].includes(key)) continue;

            // Handle op.val syntax (e.g. id=eq.123 or work_date=gte.2024-01-01)
            const dotIdx = value.indexOf('.');
            const op = dotIdx > 0 ? value.slice(0, dotIdx) : 'eq';
            const targetVal = dotIdx > 0 ? decodeURIComponent(value.slice(dotIdx + 1)) : decodeURIComponent(value);

            const propCamel = camel(key);
            const propSnake = snake(key);

            items = items.filter((item) => {
                let itemVal = item[propCamel] ?? item[propSnake];
                if (Array.isArray(itemVal)) itemVal = itemVal[0];
                if (itemVal === undefined || itemVal === null) return false;

                const strItemVal = String(itemVal);
                if (op === 'eq') return strItemVal.toLowerCase() === targetVal.toLowerCase();
                if (op === 'gte') return strItemVal >= targetVal;
                if (op === 'lte') return strItemVal <= targetVal;
                if (op === 'gt') return strItemVal > targetVal;
                if (op === 'lt') return strItemVal < targetVal;
                if (op === 'neq') return strItemVal !== targetVal;
                return true;
            });
        }

        // Apply ordering
        const orderParam = url.searchParams.get('order');
        if (orderParam) {
            const [orderCol, orderDir] = orderParam.split('.');
            const isDesc = orderDir === 'desc';
            const propCamel = camel(orderCol);
            const propSnake = snake(orderCol);
            items.sort((a, b) => {
                const valA = a[propCamel] ?? a[propSnake] ?? '';
                const valB = b[propCamel] ?? b[propSnake] ?? '';
                if (valA < valB) return isDesc ? 1 : -1;
                if (valA > valB) return isDesc ? -1 : 1;
                return 0;
            });
        }

        // Apply limit
        const limit = Number(url.searchParams.get('limit') || 2000);
        return items.slice(0, limit).map(itemToDbRow);
    }

    if (method === 'POST') {
        const body = init.body ? JSON.parse(init.body) : {};
        const records = Array.isArray(body) ? body : [body];
        const inserted = [];

        for (const r of records) {
            const id = r.id || crypto.randomUUID();
            const createdAt = new Date().toISOString();
            // Store internally in camelCase form
            const item = { ...fromRow(r), id, createdAt };
            memoryDb[memoryKey].push(item);
            inserted.push(itemToDbRow(item));
        }

        return inserted;
    }

    if (method === 'PATCH') {
        const body = init.body ? JSON.parse(init.body) : {};
        const idFilter = url.searchParams.get('id');
        const targetId = idFilter?.startsWith('eq.') ? idFilter.slice(3) : idFilter;

        for (let i = 0; i < memoryDb[memoryKey].length; i++) {
            if (String(memoryDb[memoryKey][i].id) === String(targetId)) {
                memoryDb[memoryKey][i] = {
                    ...memoryDb[memoryKey][i],
                    ...fromRow(body),
                };
            }
        }
        return [];
    }

    if (method === 'DELETE') {
        const idFilter = url.searchParams.get('id');
        const targetId = idFilter?.startsWith('eq.') ? idFilter.slice(3) : idFilter;

        if (targetId) {
            memoryDb[memoryKey] = memoryDb[memoryKey].filter((i) => String(i.id) !== String(targetId));
        }
        return [];
    }

    return [];
}

const DEFAULT_SUPABASE_URL = 'https://xurvumenaszahorrxhxf.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0uYtc2gANKbcM2trdrO8zA_DINcfSiZ';

function cleanConfigValue(val, fallback) {
    if (!val) return fallback;
    const str = String(val).trim();
    if (
        str === '' ||
        str.includes('your-project') ||
        str.includes('placeholder') ||
        str.includes('example')
    ) {
        return fallback;
    }
    return str;
}

function normalizeSupabaseUrl(url) {
    if (!url) return '';
    try {
        return new URL(url).origin;
    } catch {
        return String(url).replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    }
}

function isValidSupabaseConfig(url, key) {
    if (!url || !key) return false;
    const str = String(url).trim().toLowerCase();
    if (
        str === '' ||
        str.includes('placeholder') ||
        str.includes('your-project') ||
        str.includes('example') ||
        !str.startsWith('http')
    ) {
        return false;
    }
    return true;
}

export async function request(path, init = {}) {
    const rawUrl = normalizeSupabaseUrl(cleanConfigValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, DEFAULT_SUPABASE_URL));
    const key = cleanConfigValue(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_PUBLISHABLE_KEY);
    const hasConfig = isValidSupabaseConfig(rawUrl, key);

    if (!hasConfig) {
        return handleMemoryRequest(path, init);
    }

    try {
        const base = new URL(rawUrl).origin;
        const res = await fetch(`${base}${path}`, {
            ...init,
            signal: AbortSignal.timeout(2000),
            headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers },
        });
        const text = await res.text();
        if (!res.ok) {
            console.warn(`[Supabase] Request ${init.method || 'GET'} ${path} failed (${res.status}), using mock fallback.`);
            return handleMemoryRequest(path, init);
        }
        return text ? JSON.parse(text) : null;
    } catch (e) {
        console.warn(`[Supabase] Network error for ${path}: ${e.message}, using mock fallback.`);
        return handleMemoryRequest(path, init);
    }
}

function filterQuery(filters = {}) {
    const parts = [];
    for (const [k, v] of Object.entries(filters)) {
        const col = snake(k);
        if (v && typeof v === 'object')
            for (const [op, val] of Object.entries(v))
                parts.push(`${col}=${op}.${encodeURIComponent(String(val))}`);
        else
            parts.push(`${col}=eq.${encodeURIComponent(String(v))}`);
    }
    return parts.join('&');
}

export function supabaseTable(table) {
    const t = tableName(table);
    return {
        async findAll({ filters, limit = 2000 } = {}) {
            const q = filterQuery(filters);
            const rows = await request(`/rest/v1/${t}?select=*&order=created_at.desc&limit=${limit}${q ? '&' + q : ''}`);
            return { records: (rows || []).map(fromRow), hasMore: (rows || []).length === limit };
        },
        async findOne({ id }) {
            const rows = await request(`/rest/v1/${t}?select=*&id=eq.${encodeURIComponent(id)}`);
            return rows && rows[0] ? fromRow(rows[0]) : undefined;
        },
        async create({ record }) {
            const rows = await request(`/rest/v1/${t}`, { method: 'POST', body: JSON.stringify(toRow(table, record)) });
            const item = Array.isArray(rows) ? rows[0] : rows;
            return item ? fromRow(item) : record;
        },
        async update({ id, record }) {
            await request(`/rest/v1/${t}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(toRow(table, record)) });
            return { id };
        },
        async delete({ id }) {
            await request(`/rest/v1/${t}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
            return { success: true, id };
        },
        async bulkCreate({ records }) {
            if (!records.length)
                return { success: true, records: [] };
            const rows = await request(`/rest/v1/${t}`, { method: 'POST', body: JSON.stringify(records.map((r) => toRow(table, r))) });
            const list = Array.isArray(rows) ? rows : [rows];
            return { success: true, records: list.map(fromRow) };
        },
    };
}

export const rpc = (fn, args = {}) => request(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

export const db = {
    departments: supabaseTable('departments'),
    employees: supabaseTable('employees'),
    attendance: supabaseTable('attendance'),
    leaves: supabaseTable('leaves'),
    cashAdvances: supabaseTable('cashAdvances'),
    payslips: supabaseTable('payslips'),
};
