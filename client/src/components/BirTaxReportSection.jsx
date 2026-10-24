import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Printer,
  Copy,
  Clock,
  ShieldCheck,
  TrendingUp,
  Users,
  Coins,
  ArrowRight,
  Info,
  CalendarDays,
  FileCheck2,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateBirTaxReport } from '@/zite/api';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';
import { Label } from '@/shared/ui/label';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { peso, fmtDate } from '../utils/format';

const SAMPLE_CSV = `Employee Name,Basic Pay,Overtime,Holiday,Night Diff,De Minimis,Bonus,SSS,PhilHealth,PagIBIG,Withholding Tax,MWE
Juan dela Cruz,15000,1200,800,300,1000,0,750,375,100,0,true
Maria Santos,28000,3500,1500,800,2000,0,1400,700,200,1850.50,false
Antonio Luna,45000,0,0,0,3000,15000,1750,1125,200,5230.25,false
Elena Ramos,16770,800,0,0,1000,0,838.50,419.25,100,0,true
Rodrigo Garcia,32000,2000,1200,500,2500,0,1600,800,200,2420.00,false`;

export default function BirTaxReportSection({ payslips = [], employees = {} }) {
  const [dataSource, setDataSource] = useState('system'); // 'system' or 'custom'
  const [periodFilter, setPeriodFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customCsv, setCustomCsv] = useState('');
  const [reportResult, setReportResult] = useState(null);

  // Initial query for BIR deadlines and live system dates
  const { data: initialData, isLoading: initialLoading } = useQuery({
    queryKey: ['birTaxReportInitial'],
    queryFn: () => generateBirTaxReport({ periodLabel: 'Current Overview' }),
    staleTime: 60_000,
  });

  const activeData = reportResult || initialData;
  const deadlines = activeData?.deadlines || [];
  const metrics = activeData?.metrics || null;
  const aiAnalysis = activeData?.aiAnalysis || '';

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      let payload = {};
      if (dataSource === 'custom') {
        if (!customCsv.trim()) {
          throw new Error('Please enter or paste your employee payroll CSV data.');
        }
        payload = { customPayrollText: customCsv, periodLabel: 'Uploaded Custom Payroll Data' };
      } else {
        let label = 'All Recorded Payroll Periods';
        if (periodFilter === 'current_month') {
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          payload = { from: `${y}-${m}-01`, to: `${y}-${m}-31`, periodLabel: `${now.toLocaleString('en-PH', { month: 'long', year: 'numeric' })} Payroll` };
        } else if (periodFilter === 'last_month') {
          const now = new Date();
          now.setMonth(now.getMonth() - 1);
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          payload = { from: `${y}-${m}-01`, to: `${y}-${m}-31`, periodLabel: `${now.toLocaleString('en-PH', { month: 'long', year: 'numeric' })} Payroll` };
        } else if (periodFilter === 'custom') {
          payload = { from: fromDate || undefined, to: toDate || undefined, periodLabel: `${fromDate || 'Start'} to ${toDate || 'Present'}` };
        } else {
          payload = { periodLabel: 'Consolidated Payroll Records' };
        }
      }

      return await generateBirTaxReport(payload);
    },
    onSuccess: (data) => {
      setReportResult(data);
      toast.success('AI BIR Tax & Compliance Report successfully generated!');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to generate BIR tax report');
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    if (!metrics) return;
    const text = `BUREAU OF INTERNAL REVENUE (BIR) TAX SUMMARY REPORT
Coverage: ${reportResult?.periodLabel || 'Consolidated Payroll'}
Generated: ${new Date().toLocaleString()}

1. EXECUTIVE SUMMARY:
- Total Gross Compensation: ${peso(metrics.totalGrossCompensation)}
- Total Non-Taxable / Exempt Compensation: ${peso(metrics.totalNonTaxableExempt)}
- Total Taxable Compensation: ${peso(metrics.totalTaxableCompensation)}
- Total Tax Withheld: ${peso(metrics.totalTaxWithheld)}

2. EMPLOYEE CATEGORIZATION:
- Minimum Wage Earners (MWEs, 100% Tax Exempt): ${metrics.mweBreakdown?.count || 0} employees (${peso(metrics.mweBreakdown?.totalCompensation || 0)})
- Regular Earners: ${metrics.regularEarners?.count || 0} employees

3. UPCOMING BIR DEADLINES:
${deadlines.map((d) => `* ${d.form}: Due on ${d.effectiveDate} (${d.daysRemaining} days remaining)${d.wasShifted ? ` [Shifted: ${d.shiftReason}]` : ''}`).join('\n')}

4. BIR FORM 1601-C DRAFT DATA:
- Line 14 (Total Compensation): ${peso(metrics.totalGrossCompensation)}
- Line 15 (Non-Taxable Compensation): ${peso(metrics.totalNonTaxableExempt)}
- Line 16 (Taxable Compensation): ${peso(metrics.totalTaxableCompensation)}
- Line 17 (Tax Required Withheld): ${peso(metrics.totalTaxWithheld)}${metrics.noBenefitsWarning ? `\n\n5. NO-BENEFITS COMPLIANCE WARNING:\n* ${metrics.noBenefitsWarning.messageTl}\n* ${metrics.noBenefitsWarning.messageEn}` : ''}`;

    navigator.clipboard.writeText(text);
    toast.success('Summary copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Dynamic System Time & BIR Deadlines Banner */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                  BIR
                </span>
                <CardTitle className="text-lg">Dynamic System Time & BIR Statutory Deadlines</CardTitle>
                <Badge variant="outline" className="text-xs bg-background/80">
                  Philippine Tax Calendar (TRAIN Law)
                </Badge>
              </div>
              <CardDescription className="mt-1 text-xs">
                System Time:{' '}
                <b className="text-foreground">
                  {activeData?.systemTime?.currentFormattedDate || new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </b>{' '}
                · Automatic weekend and Philippine national holiday shifting applied
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateReportMutation.mutate()}
              disabled={generateReportMutation.isPending}
              className="gap-1.5 text-xs shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generateReportMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh Calendar & Data
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deadlines.map((d, idx) => {
              const isUrgent = d.daysRemaining <= 7;
              const isWarning = d.daysRemaining <= 20 && !isUrgent;
              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-3.5 transition-all ${
                    isUrgent
                      ? 'border-destructive/40 bg-destructive/10'
                      : isWarning
                      ? 'border-amber-500/40 bg-amber-500/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                        {d.frequency} Return
                      </Badge>
                      <h4 className="mt-1 font-semibold text-sm text-foreground">{d.form}</h4>
                    </div>
                    <Badge
                      className={`text-[11px] font-bold ${
                        isUrgent
                          ? 'bg-destructive text-destructive-foreground'
                          : isWarning
                          ? 'bg-amber-600 text-white'
                          : 'bg-primary/90 text-primary-foreground'
                      }`}
                    >
                      {d.daysRemaining > 0 ? `${d.daysRemaining} days left` : 'Due Today / Past'}
                    </Badge>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground line-clamp-1" title={d.title}>
                    {d.title}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                    <span className="text-muted-foreground">Effective Due Date:</span>
                    <span className="font-bold text-foreground">
                      {fmtDate(d.effectiveDate)} ({d.dayName?.slice(0, 3)})
                    </span>
                  </div>

                  {d.wasShifted && (
                    <div className="mt-2 rounded-md bg-amber-500/15 dark:bg-amber-950/40 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        Shifted from {d.originalDate}: {d.shiftReason} falls on a non-working day. Next business day rule applied.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actionable Alert Box for BIR Penalties */}
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-destructive">
                  Actionable Compliance Alert: Avoid BIR Surcharges & Interest Penalties
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  Remit employee withholding taxes on or before the indicated effective deadlines via <b>eFPS</b> or{' '}
                  <b>Authorized Agent Banks (AABs)</b>. Late returns or remittance attract a mandatory{' '}
                  <b className="text-foreground">25% surcharge</b>, <b className="text-foreground">12% legal interest per annum</b>{' '}
                  (under Tax Reform for Acceleration and Inclusion - RA 10963), plus compromise penalties based on BIR schedules.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Control Panel: Data Source & AI Generation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Philippine Tax Accountant & Payroll Specialist
              </CardTitle>
              <CardDescription className="text-xs">
                Analyze live employee payroll numbers, verify Minimum Wage Earner (MWE) tax exemptions, audit De Minimis & bonus thresholds, and draft BIR forms.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={dataSource} onValueChange={setDataSource} className="w-full">
            <TabsList className="grid w-full sm:w-auto grid-cols-2 mb-4">
              <TabsTrigger value="system" className="text-xs">
                Active System Payroll Data ({payslips.length} payslips recorded)
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-xs">
                Upload / Input Custom Payroll CSV
              </TabsTrigger>
            </TabsList>

            <TabsContent value="system" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Period Preset</Label>
                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Available Payroll Records</SelectItem>
                      <SelectItem value="current_month">Current Month Payroll</SelectItem>
                      <SelectItem value="last_month">Previous Month Payroll</SelectItem>
                      <SelectItem value="custom">Custom Date Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {periodFilter === 'custom' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">From Date</Label>
                      <Input
                        type="date"
                        className="h-9 text-xs"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">To Date</Label>
                      <Input
                        type="date"
                        className="h-9 text-xs"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Paste Employee Payroll Data (CSV Format)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-primary"
                  onClick={() => setCustomCsv(SAMPLE_CSV)}
                >
                  Load Sample Philippine Payroll Data
                </Button>
              </div>
              <Textarea
                rows={5}
                className="font-mono text-xs"
                placeholder="Employee Name,Basic Pay,Overtime,Holiday,Night Diff,De Minimis,Bonus,SSS,PhilHealth,PagIBIG,Withholding Tax,MWE"
                value={customCsv}
                onChange={(e) => setCustomCsv(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Headers recognized: Employee Name, Basic Pay, Overtime, Holiday, Night Diff, De Minimis, Bonus, SSS, PhilHealth, PagIBIG, Withholding Tax, MWE (true/false).
              </p>
            </TabsContent>
          </Tabs>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
            <Button
              onClick={() => generateReportMutation.mutate()}
              disabled={generateReportMutation.isPending}
              className="gap-2 shadow-xs"
            >
              <Sparkles className="h-4 w-4" />
              {generateReportMutation.isPending ? 'Analyzing with Philippine Tax Rules…' : 'Generate Comprehensive BIR Tax Report'}
            </Button>
            {metrics && (
              <>
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
                  <Printer className="h-3.5 w-3.5" />
                  Print / Save PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCopySummary} className="gap-1.5 text-xs">
                  <Copy className="h-3.5 w-3.5" />
                  Copy Summary
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated Report Output */}
      {metrics && (
        <div className="space-y-6">
          {/* Conditional No-Benefits Warning Note */}
          {metrics.noBenefitsWarning?.triggered && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                      Paalala / No-Benefits Compliance Warning (Zero SSS/PhilHealth/Pag-IBIG)
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-background border-amber-500/40 text-amber-700 dark:text-amber-300">
                      Flexible Benefits Mode Active
                    </Badge>
                  </div>
                  <p className="text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                    {metrics.noBenefitsWarning.messageTl}
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed text-[11px]">
                    <span className="font-semibold">English:</span> {metrics.noBenefitsWarning.messageEn}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 1. Executive Summary Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                1. Executive Summary (BIR Compensation & Tax Withheld)
              </h3>
              <Badge variant="outline" className="text-xs">
                {metrics.employeeCount} Employees Included
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4 bg-card shadow-xs">
                <span className="text-xs font-medium text-muted-foreground">Total Gross Compensation</span>
                <div className="mt-1 text-2xl font-extrabold text-foreground">{peso(metrics.totalGrossCompensation)}</div>
                <span className="text-[11px] text-muted-foreground">All basic, overtime, holiday & benefits</span>
              </Card>

              <Card className="p-4 bg-card shadow-xs">
                <span className="text-xs font-medium text-muted-foreground">Total Non-Taxable / Exempt</span>
                <div className="mt-1 text-2xl font-extrabold text-emerald-600">{peso(metrics.totalNonTaxableExempt)}</div>
                <span className="text-[11px] text-muted-foreground">
                  MWE earnings + SSS/PH/HDMF + De Minimis
                </span>
              </Card>

              <Card className="p-4 bg-card shadow-xs">
                <span className="text-xs font-medium text-muted-foreground">Total Taxable Compensation</span>
                <div className="mt-1 text-2xl font-extrabold text-primary">{peso(metrics.totalTaxableCompensation)}</div>
                <span className="text-[11px] text-muted-foreground">Subject to TRAIN withholding tax table</span>
              </Card>

              <Card className="p-4 bg-card shadow-xs">
                <span className="text-xs font-medium text-muted-foreground">Total Tax Withheld</span>
                <div className="mt-1 text-2xl font-extrabold text-destructive">{peso(metrics.totalTaxWithheld)}</div>
                <span className="text-[11px] text-muted-foreground">Amount to remit via Form 1601-C</span>
              </Card>
            </div>
          </div>

          {/* 2. BIR Form Readiness Breakdown */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Monthly Form 1601-C Draft Readiness */}
            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">
                      Monthly BIR Form 1601-C Draft Readiness
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Ready for Filing</Badge>
                </div>
                <CardDescription className="text-xs">
                  Line items directly mapped to the Bureau of Internal Revenue Form 1601-C return.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y text-xs">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Part II, Item 14: Total Amount of Compensation</span>
                    <span className="font-mono font-bold text-foreground">{peso(metrics.totalGrossCompensation)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Part II, Item 15: Total Non-Taxable Compensation</span>
                    <span className="font-mono font-bold text-emerald-600">{peso(metrics.totalNonTaxableExempt)}</span>
                  </div>
                  <div className="pl-4 py-1 text-[11px] text-muted-foreground flex justify-between">
                    <span>
                      ↳ Mandatory Contributions (SSS, PhilHealth, Pag-IBIG):
                      {!metrics.statutoryContributions?.hasContributions && (
                        <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          (Zero provided · Gross used as taxable base)
                        </span>
                      )}
                    </span>
                    <span>{peso(metrics.statutoryContributions?.total || 0)}</span>
                  </div>
                  <div className="pl-4 py-1 text-[11px] text-muted-foreground flex justify-between">
                    <span>↳ MWE Exempt Compensation (RA 9504):</span>
                    <span>{peso(metrics.mweBreakdown?.totalCompensation || 0)}</span>
                  </div>
                  <div className="pl-4 py-1 text-[11px] text-muted-foreground flex justify-between">
                    <span>↳ De Minimis Non-Taxable Allowances:</span>
                    <span>{peso(metrics.deMinimisAndBonuses?.totalDeMinimis || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 bg-muted/20 px-1 font-semibold">
                    <span>Part II, Item 16: Taxable Compensation (Item 14 less Item 15)</span>
                    <span className="font-mono font-bold text-primary">{peso(metrics.totalTaxableCompensation)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 bg-primary/5 px-1 font-bold text-sm">
                    <span>Part II, Item 17: Tax Required to be Withheld</span>
                    <span className="font-mono text-destructive">{peso(metrics.totalTaxWithheld)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Next Filing Due Date:</span>
                    <span className="font-medium text-foreground">{deadlines[0]?.effectiveDate} ({deadlines[0]?.dayName})</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employee Categorization & Bonus 90k Tracker */}
            <div className="space-y-6">
              <Card className="shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <CardTitle className="text-sm font-semibold">
                        Minimum Wage Earner (MWE) Exemption (RA 9504)
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-600/30">
                      100% Tax Exempt
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Statutory exemption for basic pay, overtime, night shift differential, and holiday pay.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 p-2.5">
                    <div>
                      <div className="font-semibold text-emerald-900 dark:text-emerald-200">
                        {metrics.mweBreakdown?.count || 0} Minimum Wage Earner(s)
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Total Exempt Earnings: {peso(metrics.mweBreakdown?.totalCompensation || 0)}
                      </div>
                    </div>
                    <Badge className="bg-emerald-600 text-white text-[11px]">₱0.00 Tax Withheld</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className="rounded border p-2">
                      <div>Exempt Basic Pay:</div>
                      <b className="text-foreground">{peso(metrics.mweBreakdown?.basicPay || 0)}</b>
                    </div>
                    <div className="rounded border p-2">
                      <div>Exempt Overtime:</div>
                      <b className="text-foreground">{peso(metrics.mweBreakdown?.overtimePay || 0)}</b>
                    </div>
                    <div className="rounded border p-2">
                      <div>Exempt Holiday Pay:</div>
                      <b className="text-foreground">{peso(metrics.mweBreakdown?.holidayPay || 0)}</b>
                    </div>
                    <div className="rounded border p-2">
                      <div>Exempt Night Diff:</div>
                      <b className="text-foreground">{peso(metrics.mweBreakdown?.nightDiffPay || 0)}</b>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* De Minimis & 90,000 Bonus Limit */}
              <Card className="shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <CardTitle className="text-sm font-semibold">
                        De Minimis & ₱90,000 Bonus Threshold
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px]">TRAIN Law Sec. 32</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">De Minimis Allowances (Non-Taxable):</span>
                    <span className="font-semibold text-foreground">{peso(metrics.deMinimisAndBonuses?.totalDeMinimis || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">13th Month & Other Bonuses:</span>
                    <span className="font-semibold text-foreground">{peso(metrics.deMinimisAndBonuses?.totalBonuses || 0)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Statutory Exemption Cap:</span>
                    <span className="font-semibold text-emerald-600">₱90,000.00 per employee / year</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Excess Bonus Subject to Withholding:</span>
                    <span className={`font-bold ${metrics.deMinimisAndBonuses?.excessBonusTaxable > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {peso(metrics.deMinimisAndBonuses?.excessBonusTaxable || 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 3. Annual 1604-C & Quarterly Returns Readiness */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Quarterly Returns (BIR Form 1601-EQ / 1603Q)
                </CardTitle>
                <CardDescription className="text-xs">
                  Projections for quarterly withholding tax returns.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Upcoming Quarterly Period:</span>
                  <span className="font-semibold text-foreground">{deadlines[1]?.periodCovered}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Statutory Filing Deadline:</span>
                  <span className="font-medium text-foreground">{deadlines[1]?.effectiveDate} ({deadlines[1]?.daysRemaining} days left)</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Projected Taxable Compensation:</span>
                  <span className="font-mono font-bold text-foreground">{peso(metrics.totalTaxableCompensation)}</span>
                </div>
                <div className="flex justify-between pt-1 font-semibold">
                  <span className="text-muted-foreground">Cumulative Withholding Tax:</span>
                  <span className="font-mono text-destructive">{peso(metrics.totalTaxWithheld)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-primary" />
                  Annual Form 1604-C (Alphalist) & Form 2316 Tracking
                </CardTitle>
                <CardDescription className="text-xs">
                  Year-end consolidation for BIR Alphalist and Certificates of Compensation.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Annual Filing Deadline:</span>
                  <span className="font-semibold text-foreground">{deadlines[2]?.effectiveDate} (Alphalist Submission)</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Form 2316 Issuance to Employees:</span>
                  <span className="font-medium text-foreground">On or before January 31 of following year</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Registered Active Employees:</span>
                  <span className="font-bold text-foreground">{metrics.employeeCount} certificates required</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Substituted Filing Eligibility:</span>
                  <span className="text-emerald-600 font-medium">Eligible for single-employer qualified staff</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. AI Specialist Comprehensive Audit & Analysis */}
          {aiAnalysis && (
            <Card className="border-primary/30 shadow-md">
              <CardHeader className="border-b bg-muted/30 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">
                        AI Philippine Tax Accountant Detailed Compliance Audit
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Authoritative legal review based on the latest BIR Revenue Regulations & TRAIN Law.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-primary/90 text-primary-foreground text-xs">
                    Gemini 3.8 Flash Verified
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed space-y-3 whitespace-pre-wrap font-sans">
                  {aiAnalysis}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
