import bulkLogAttendance from './api/bulkLogAttendance.js';
import deleteRecord from './api/deleteRecord.js';
import generatePayroll from './api/generatePayroll.js';
import getDashboard from './api/getDashboard.js';
import getMyRole from './api/getMyRole.js';
import getSystemHealth from './api/getSystemHealth.js';
import inviteUser from './api/inviteUser.js';
import listInvites from './api/listInvites.js';
import listRecords from './api/listRecords.js';
import listUsers from './api/listUsers.js';
import releasePayslips from './api/releasePayslips.js';
import revokeInvite from './api/revokeInvite.js';
import saveRecord from './api/saveRecord.js';
import setPayslipDeduction from './api/setPayslipDeduction.js';
import setUserRole from './api/setUserRole.js';
import sfClearData from './api/sfClearData.js';
import sfDeclareBalance from './api/sfDeclareBalance.js';
import sfDelete from './api/sfDelete.js';
import sfGetAudit from './api/sfGetAudit.js';
import sfGetData from './api/sfGetData.js';
import sfSave from './api/sfSave.js';
import syncDraftPayrollAttendance from './api/syncDraftPayrollAttendance.js';

export const endpoints = {
  bulkLogAttendance,
  deleteRecord,
  generatePayroll,
  getDashboard,
  getMyRole,
  getSystemHealth,
  inviteUser,
  listInvites,
  listRecords,
  listUsers,
  releasePayslips,
  revokeInvite,
  saveRecord,
  setPayslipDeduction,
  setUserRole,
  sfClearData,
  sfDeclareBalance,
  sfDelete,
  sfGetAudit,
  sfGetData,
  sfSave,
  syncDraftPayrollAttendance,
};
