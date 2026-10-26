// Calls the Node.js backend at /api/<name> with the signed-in user's token.
import { supabase, isSupabaseConfigured } from './supabaseClient';

async function call(name, input) {
  let token = 'demo-token';
  const headers = { 'Content-Type': 'application/json' };

  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        token = data.session.access_token;
      }
    } catch {
      // fallback to demo token
    }
  }

  headers['Authorization'] = `Bearer ${token}`;

  if (typeof window !== 'undefined') {
    const simulatedRole = localStorage.getItem('sahod_simulated_role');
    if (simulatedRole) {
      headers['X-Simulated-Role'] = simulatedRole;
    }
    const demoEmail = localStorage.getItem('sahod_demo_email');
    if (demoEmail && (demoEmail.endsWith('@example.com') || demoEmail.includes('dummy'))) {
      localStorage.removeItem('sahod_demo_email');
    } else if (demoEmail) {
      headers['Authorization'] = 'Bearer demo-token';
      headers['X-User-Email'] = demoEmail;
    } else if (token === 'demo-token') {
      headers['X-User-Email'] = 'kimsegarra410@gmail.com';
    }
  }

  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input ?? {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const bulkLogAttendance = (input) => call('bulkLogAttendance', input);
export const deleteRecord = (input) => call('deleteRecord', input);
export const generateBirTaxReport = (input) => call('generateBirTaxReport', input);
export const generatePayroll = (input) => call('generatePayroll', input);
export const getDashboard = (input) => call('getDashboard', input);
export const getMyRole = (input) => call('getMyRole', input);
export const getSystemHealth = (input) => call('getSystemHealth', input);
export const inviteUser = (input) => call('inviteUser', input);
export const listInvites = (input) => call('listInvites', input);
export const listRecords = (input) => call('listRecords', input);
export const listUsers = (input) => call('listUsers', input);
export const releasePayslips = (input) => call('releasePayslips', input);
export const revokeInvite = (input) => call('revokeInvite', input);
export const saveRecord = (input) => call('saveRecord', input);
export const setPayslipDeduction = (input) => call('setPayslipDeduction', input);
export const setUserRole = (input) => call('setUserRole', input);
export const sfClearData = (input) => call('sfClearData', input);
export const sfDeclareBalance = (input) => call('sfDeclareBalance', input);
export const sfDelete = (input) => call('sfDelete', input);
export const sfGetAudit = (input) => call('sfGetAudit', input);
export const sfGetData = (input) => call('sfGetData', input);
export const sfSave = (input) => call('sfSave', input);
export const syncDraftPayrollAttendance = (input) => call('syncDraftPayrollAttendance', input);

export const api = { bulkLogAttendance, deleteRecord, generateBirTaxReport, generatePayroll, getDashboard, getMyRole, getSystemHealth, inviteUser, listInvites, listRecords, listUsers, releasePayslips, revokeInvite, saveRecord, setPayslipDeduction, setUserRole, sfClearData, sfDeclareBalance, sfDelete, sfGetAudit, sfGetData, sfSave, syncDraftPayrollAttendance };
export default api;
