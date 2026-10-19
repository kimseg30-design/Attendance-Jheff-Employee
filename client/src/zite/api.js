// Calls the Node.js backend at /api/<name> with the signed-in user's token.
import { supabase, isSupabaseConfigured } from './supabaseClient';

async function call(name, input) {
  let token = 'demo-token';
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
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input ?? {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const bulkLogAttendance = (input) => call('bulkLogAttendance', input);
export const deleteRecord = (input) => call('deleteRecord', input);
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

export const api = { bulkLogAttendance, deleteRecord, generatePayroll, getDashboard, getMyRole, getSystemHealth, inviteUser, listInvites, listRecords, listUsers, releasePayslips, revokeInvite, saveRecord, setPayslipDeduction, setUserRole, sfClearData, sfDeclareBalance, sfDelete, sfGetAudit, sfGetData, sfSave, syncDraftPayrollAttendance };
