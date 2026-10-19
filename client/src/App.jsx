import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/shared/ui/sonner';
import { lazy, Suspense, useEffect } from 'react';
import { useAuth, loginWithRedirect } from '@/zite/auth';
import AccessGate from './components/AccessGate';
import ModuleAccessGate from './components/ModuleAccessGate';
import EditorHome from './components/EditorHome';
import Layout from './components/Layout';
import AppErrorBoundary from './components/AppErrorBoundary';
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const PayrollPage = lazy(() => import('./pages/PayrollPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const LeavesPage = lazy(() => import('./pages/LeavesPage'));
const CashAdvancesPage = lazy(() => import('./pages/CashAdvancesPage'));
const PayrollLoansPage = lazy(() => import('./pages/PayrollLoansPage'));
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SfDashboardPage = lazy(() => import('./pages/sinking/SfDashboardPage'));
const SfLoansPage = lazy(() => import('./pages/sinking/SfLoansPage'));
const SfInterestReconciliationPage = lazy(() => import('./pages/sinking/SfInterestReconciliationPage'));
const SfLoanDetailPage = lazy(() => import('./pages/sinking/SfLoanDetailPage'));
const SfAddLoanPage = lazy(() => import('./pages/sinking/SfAddLoanPage'));
const SfMembersPage = lazy(() => import('./pages/sinking/SfMembersPage'));
const SfContributionsPage = lazy(() => import('./pages/sinking/SfContributionsPage'));
const SfAuditPage = lazy(() => import('./pages/sinking/SfAuditPage'));
const SfSettingsPage = lazy(() => import('./pages/sinking/SfSettingsPage'));
const queryClient = new QueryClient({ defaultOptions: { queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // A rate-limited request must not be retried automatically: retries amplify bursts.
            retry: (failureCount, error) => {
                const message = error instanceof Error ? error.message : String(error);
                if (/too many requests|rate limit/i.test(message))
                    return false;
                return failureCount < 1;
            },
        } } });
export default function App() {
    const { user, isLoading } = useAuth();
    useEffect(() => { if (!isLoading && !user)
        loginWithRedirect(); }, [isLoading, user]);
    if (isLoading || !user)
        return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
    return (<QueryClientProvider client={queryClient}>
      <AccessGate>
        <BrowserRouter>
          <AppErrorBoundary>
          <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading section…</div>}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<EditorHome />}/>
                <Route path="/attendance" element={<ModuleAccessGate permission="attendance"><AttendancePage /></ModuleAccessGate>}/>
                <Route path="/payroll" element={<PayrollPage />}/>
                <Route path="/reports" element={<ReportsPage />}/>
                <Route path="/employees" element={<EmployeesPage />}/>
                <Route path="/leaves" element={<LeavesPage />}/>
                <Route path="/advances" element={<ModuleAccessGate permission="cashAdvances"><CashAdvancesPage mode="cash"/></ModuleAccessGate>}/>
                <Route path="/loans" element={<PayrollLoansPage />}/>
                <Route path="/departments" element={<DepartmentsPage />}/>
                <Route path="/users" element={<UsersPage />}/>
                <Route path="/sinking-fund" element={<SfDashboardPage />}/>
                <Route path="/sinking-fund/loans" element={<SfLoansPage />}/>
                <Route path="/sinking-fund/interest-reconciliation" element={<SfInterestReconciliationPage />}/>
                <Route path="/sinking-fund/loans/:id" element={<SfLoanDetailPage />}/>
                <Route path="/sinking-fund/add-loan" element={<SfAddLoanPage />}/>
                <Route path="/sinking-fund/members" element={<SfMembersPage />}/>
                <Route path="/sinking-fund/contributions" element={<SfContributionsPage />}/>
                <Route path="/sinking-fund/audit" element={<SfAuditPage />}/>
                <Route path="/sinking-fund/settings" element={<SfSettingsPage />}/>
                <Route path="*" element={<EditorHome />}/>
              </Route>
            </Routes>
          </Suspense>
          </AppErrorBoundary>
        </BrowserRouter>
      </AccessGate>
      <Toaster />
    </QueryClientProvider>);
}
