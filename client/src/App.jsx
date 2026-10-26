import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/shared/ui/sonner';
import { lazy, Suspense, useEffect } from 'react';
import { useAuth, loginWithRedirect } from '@/zite/auth';
import AccessGate from './components/AccessGate';
import { AdminOnlyGate, MemberOrEditorGate } from './components/RoleGate';
import EditorHome from './components/EditorHome';
import Layout from './components/Layout';
import AppErrorBoundary from './components/AppErrorBoundary';
import lazyWithRetry from './utils/lazyWithRetry';

const AttendancePage = lazyWithRetry(() => import('./pages/AttendancePage'));
const PayrollPage = lazyWithRetry(() => import('./pages/PayrollPage'));
const ReportsPage = lazyWithRetry(() => import('./pages/ReportsPage'));
const EmployeesPage = lazyWithRetry(() => import('./pages/EmployeesPage'));
const LeavesPage = lazyWithRetry(() => import('./pages/LeavesPage'));
const CashAdvancesPage = lazyWithRetry(() => import('./pages/CashAdvancesPage'));
const PayrollLoansPage = lazyWithRetry(() => import('./pages/PayrollLoansPage'));
const DepartmentsPage = lazyWithRetry(() => import('./pages/DepartmentsPage'));
const UsersPage = lazyWithRetry(() => import('./pages/UsersPage'));
const SfDashboardPage = lazyWithRetry(() => import('./pages/sinking/SfDashboardPage'));
const SfLoansPage = lazyWithRetry(() => import('./pages/sinking/SfLoansPage'));
const SfInterestReconciliationPage = lazyWithRetry(() => import('./pages/sinking/SfInterestReconciliationPage'));
const SfLoanDetailPage = lazyWithRetry(() => import('./pages/sinking/SfLoanDetailPage'));
const SfAddLoanPage = lazyWithRetry(() => import('./pages/sinking/SfAddLoanPage'));
const SfMembersPage = lazyWithRetry(() => import('./pages/sinking/SfMembersPage'));
const SfContributionsPage = lazyWithRetry(() => import('./pages/sinking/SfContributionsPage'));
const SfAuditPage = lazyWithRetry(() => import('./pages/sinking/SfAuditPage'));
const SfSettingsPage = lazyWithRetry(() => import('./pages/sinking/SfSettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (/too many requests|rate limit/i.test(message)) return false;
        return failureCount < 1;
      },
    },
  },
});

export default function App() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) loginWithRedirect();
  }, [isLoading, user]);

  if (isLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AccessGate>
        <BrowserRouter>
          <AppErrorBoundary>
            <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading section…</div>}>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<EditorHome />} />
                  <Route
                    path="/attendance"
                    element={
                      <MemberOrEditorGate permission="attendance" moduleName="Attendance">
                        <AttendancePage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/payroll"
                    element={
                      <MemberOrEditorGate moduleName="Payroll">
                        <PayrollPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <MemberOrEditorGate moduleName="Reports & Tax">
                        <ReportsPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/employees"
                    element={
                      <MemberOrEditorGate moduleName="Employees">
                        <EmployeesPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/leaves"
                    element={
                      <MemberOrEditorGate moduleName="Leaves">
                        <LeavesPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/advances"
                    element={
                      <MemberOrEditorGate permission="cashAdvances" moduleName="Cash Advances">
                        <CashAdvancesPage mode="cash" />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/loans"
                    element={
                      <MemberOrEditorGate moduleName="Loans">
                        <PayrollLoansPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/departments"
                    element={
                      <MemberOrEditorGate moduleName="Departments">
                        <DepartmentsPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/users"
                    element={
                      <AdminOnlyGate moduleName="Users & Role Management">
                        <UsersPage />
                      </AdminOnlyGate>
                    }
                  />
                  <Route
                    path="/sinking-fund"
                    element={
                      <MemberOrEditorGate moduleName="Sinking Fund">
                        <SfDashboardPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/sinking-fund/loans"
                    element={
                      <MemberOrEditorGate moduleName="Sinking Fund Loans">
                        <SfLoansPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/sinking-fund/interest-reconciliation"
                    element={
                      <AdminOnlyGate moduleName="Interest Reconciliation">
                        <SfInterestReconciliationPage />
                      </AdminOnlyGate>
                    }
                  />
                  <Route
                    path="/sinking-fund/loans/:id"
                    element={
                      <MemberOrEditorGate moduleName="Loan Details">
                        <SfLoanDetailPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/sinking-fund/add-loan"
                    element={
                      <AdminOnlyGate moduleName="Add Loan">
                        <SfAddLoanPage />
                      </AdminOnlyGate>
                    }
                  />
                  <Route
                    path="/sinking-fund/members"
                    element={
                      <MemberOrEditorGate moduleName="Sinking Fund Members">
                        <SfMembersPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/sinking-fund/contributions"
                    element={
                      <MemberOrEditorGate moduleName="Contributions">
                        <SfContributionsPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/sinking-fund/audit"
                    element={
                      <MemberOrEditorGate moduleName="Audit Log">
                        <SfAuditPage />
                      </MemberOrEditorGate>
                    }
                  />
                  <Route
                    path="/sinking-fund/settings"
                    element={
                      <AdminOnlyGate moduleName="Sinking Fund Settings">
                        <SfSettingsPage />
                      </AdminOnlyGate>
                    }
                  />
                  <Route path="*" element={<EditorHome />} />
                </Route>
              </Routes>
            </Suspense>
          </AppErrorBoundary>
        </BrowserRouter>
      </AccessGate>
      <Toaster />
    </QueryClientProvider>
  );
}
