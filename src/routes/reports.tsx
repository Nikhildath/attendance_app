import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { MonthlyRateChart, DepartmentBarChart, WeeklyTrendChart } from "@/components/charts/Charts";
import { TrendingUp, Clock, CalendarCheck, Users, Download } from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import { statusMeta, type AttendanceStatus } from "@/lib/mock-data";
import { cn, isWeekend } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/lib/settings-context";
import { useAuth } from "@/lib/auth";
import { exportToCSV } from "@/lib/csv-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Attendly" },
      { name: "description", content: "Attendance trends, muster roll, payroll reports and performance metrics." },
    ],
  }),
  component: ReportsPage,
});

type Tab = "overview" | "muster" | "payroll";

function ReportsPage() {
  const { settings } = useSettings();
  const { profile } = useAuth();
  const navigate = Route.useNavigate();

  useEffect(() => {
    if (profile && profile.role === "Employee") {
      navigate({ to: "/" });
    }
  }, [profile]);

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [muster, setMuster] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [stats, setStats] = useState({
    avgAttendance: "0%",
    onTimeRate: "0%",
    activeEmployees: 0,
    productivity: "0"
  });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [deptData, setDeptData] = useState<any[]>([]);

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currency = settings?.default_currency || "INR";

  useEffect(() => {
    async function load() {
      setLoading(true);
      
      // Fetch all profiles
      const { data: profiles } = await supabase.from("profiles").select("*");
      
      // Fetch current month attendance
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();
      
      const { data: attendance } = await supabase
          .from("attendance")
          .select("*")
          .gte("check_in", startOfMonth)
          .lt("check_in", endOfMonth);

      // Fetch leaves for this month
      const { data: leaves } = await supabase
          .from("leaves")
          .select("*")
          .eq("status", "Approved")
          .or(`from_date.lte.${endOfMonth},to_date.gte.${startOfMonth}`);

      // Fetch last 6 months for monthly rate
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString();
      const { data: historicalAttendance } = await supabase
          .from("attendance")
          .select("*")
          .gte("created_at", sixMonthsAgo);

      // Fetch Shifts and Schedule
      const { data: s } = await supabase.from("shifts").select("*");
      const { data: sch } = await supabase.from("shift_schedule").select("*");
      const { data: h } = await supabase.from("company_holidays").select("*");

      if (s) setShifts(s);
      if (sch) setSchedule(sch);
      if (h) setHolidays(h);

      if (profiles && attendance) {
        // Build Muster Roll
        const musterRoll = profiles.map(p => {
          const row = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const date = new Date(today.getFullYear(), today.getMonth(), day);
            const dayStr = date.toISOString().split('T')[0];
            const dow = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];

            const rec = attendance?.find(a => a.user_id === p.id && new Date(a.check_in || a.created_at).getDate() === day);
            if (rec) return rec.status as AttendanceStatus;
            
            const onLeave = leaves?.find(l => l.user_id === p.id && dayStr >= l.from_date && dayStr <= l.to_date);
            if (onLeave) return "leave" as AttendanceStatus;

            // Check for shifts on holidays
            const isH = h?.some(holiday => holiday.date === dayStr);
            const userSched = sch?.find(s => s.user_id === p.id);
            const shiftId = userSched?.[dow];
            const shift = s?.find(sh => sh.id === shiftId);

            if (isH) {
              if (shift?.work_on_holidays) return "absent" as AttendanceStatus;
              return "holiday" as AttendanceStatus;
            }

            if (isWeekend(date, settings?.weekend_type)) return "weekend" as AttendanceStatus;
            return "absent" as AttendanceStatus;
          });
          return { id: p.id, name: p.name, role: p.role, row };
        });
        setMuster(musterRoll);

        // Stats
        const totalPossible = profiles.length * daysInMonth;
        const totalPresent = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
        const onTime = attendance.filter(a => a.status === 'present').length;
        
        setStats({
          avgAttendance: totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(1) + "%" : "0%",
          onTimeRate: totalPresent > 0 ? ((onTime / totalPresent) * 100).toFixed(1) + "%" : "0%",
          activeEmployees: profiles.length,
          productivity: totalPossible > 0 ? Math.min(100, Math.round((totalPresent / totalPossible) * 110)).toString() : "0"
        });

        // Weekly Trend (Last 7 Days)
        const weekly = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dateIso = d.toISOString().split('T')[0];
            const dayAtt = attendance.filter(a => new Date(a.check_in || a.created_at).toDateString() === d.toDateString());
            
            const present = dayAtt.filter(a => a.status === 'present').length;
            const late = dayAtt.filter(a => a.status === 'late').length;
            const onLeaveCount = leaves?.filter(l => l.status === 'Approved' && dateIso >= l.from_date && dateIso <= l.to_date).length || 0;
            
            // Calculate absent: Total - (Present + Late + Leave)
            // Exclude weekends from absent calculation if desired, but here we just show daily trend
            const totalEmployees = profiles.length;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const absent = isWeekend ? 0 : Math.max(0, totalEmployees - (present + late + onLeaveCount));

            weekly.push({
                day: dateStr,
                present,
                late,
                absent
            });
        }
        setWeeklyData(weekly);

        // Monthly Rate (Last 6 Months)
        const monthly = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthStr = d.toLocaleString('default', { month: 'short' });
            const monthAtt = historicalAttendance?.filter(a => {
                const ad = new Date(a.created_at);
                return ad.getMonth() === d.getMonth() && ad.getFullYear() === d.getFullYear();
            }) || [];
            
            const daysInThatMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const possible = profiles.length * (daysInThatMonth - 8); // Roughly excluding weekends
            const actual = monthAtt.filter(a => a.status === 'present' || a.status === 'late').length;
            
            monthly.push({
                month: monthStr,
                rate: possible > 0 ? Math.min(100, Math.round((actual / possible) * 100)) : 0
            });
        }
        setMonthlyData(monthly);

        // Department Wise
        const depts = Array.from(new Set(profiles.map(p => p.dept || 'General')));
        const deptWise = depts.map(dept => {
            const deptProfiles = profiles.filter(p => (p.dept || 'General') === dept);
            const deptAtt = attendance.filter(a => deptProfiles.some(p => p.id === a.user_id));
            const possible = deptProfiles.length * daysInMonth;
            const actual = deptAtt.filter(a => a.status === 'present' || a.status === 'late').length;
            return {
                dept,
                rate: possible > 0 ? Math.min(100, Math.round((actual / possible) * 100)) : 0
            };
        });
        setDeptData(deptWise);
      }

      // Fetch Payslips
      const { data: slips } = await supabase.from("payslips").select("*, profiles(name)");
      if (slips) setPayslips(slips);

      setLoading(false);
    }
    load();
  }, [tab]);

  const handleExport = () => {
    if (tab === "overview") {
      toast.info("Export is available for Muster Roll and Payroll tabs.");
      return;
    }

    if (tab === "muster") {
      if (muster.length === 0) return toast.error("No muster data to export");
      const exportData = muster.map(m => {
        const rowData: any = { Name: m.name, Role: m.role };
        m.row.forEach((status: string, i: number) => {
          rowData[`Day ${i + 1}`] = status;
        });
        const p = m.row.filter((s: string) => s === "present").length;
        const a = m.row.filter((s: string) => s === "absent").length;
        rowData["Total Present"] = p;
        rowData["Total Absent"] = a;
        return rowData;
      });
      exportToCSV(exportData, "muster_roll_report");
      toast.success("Muster roll exported successfully");
    } else if (tab === "payroll") {
      if (payslips.length === 0) return toast.error("No payroll data to export");
      const exportData = payslips.map(p => ({
        Employee: p.profiles?.name,
        Month: p.month,
        Basic: p.basic_pay,
        HRA: p.hra,
        Allowances: p.allowances,
        Bonus: p.bonus,
        Overtime: p.overtime_pay,
        Fines: p.fines,
        Tax: p.tax,
        "Net Payable": p.net_payable,
        Status: p.status
      }));
      exportToCSV(exportData, "payroll_summary_report");
      toast.success("Payroll summary exported successfully");
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Attendance trends, muster roll and payroll reports"
        actions={
          <button 
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent transition-all active:scale-95"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        }
      />

      <div className="mb-8 flex overflow-x-auto pb-1 no-scrollbar md:inline-flex rounded-2xl border border-border/50 bg-muted/30 p-1.5 shadow-sm">
        {([["overview","Overview"],["muster","Muster Roll"],["payroll","Payroll"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn(
            "whitespace-nowrap rounded-xl px-6 py-2 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95",
            tab === k ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}>{l}</button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <StatCard label="Avg Attendance" value={stats.avgAttendance} icon={CalendarCheck} tone="success" />
            <StatCard label="On-Time Rate" value={stats.onTimeRate} icon={Clock} tone="info" />
            <StatCard label="Active Employees" value={stats.activeEmployees} icon={Users} tone="default" />
            <StatCard label="Productivity" value={stats.productivity} icon={TrendingUp} tone="warning" />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-elegant">
              <h2 className="text-xl font-black tracking-tight">Monthly Attendance Rate</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Company-wide attendance % per month</p>
              <div className="mt-6"><MonthlyRateChart data={monthlyData} /></div>
            </div>
            <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-elegant">
              <h2 className="text-xl font-black tracking-tight">Departmental Attendance</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Recent engagement levels by department</p>
              <div className="mt-6"><DepartmentBarChart data={deptData} /></div>
            </div>
          </div>
          <div className="mt-6 rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-elegant">
            <h2 className="text-xl font-black tracking-tight">Weekly Trend</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Present, late and absent counts across the week</p>
            <div className="mt-6">
              <WeeklyTrendChart data={weeklyData} />
            </div>
          </div>
        </>
      )}

      {tab === "muster" && (
        <div className="responsive-table-container transition-all hover:shadow-elegant">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b p-5 gap-4">
            <div>
              <h2 className="text-lg font-black tracking-tight">Muster Roll · {today.toLocaleString("en", { month: "long", year: "numeric" })}</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Daily attendance per employee</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] overflow-x-auto no-scrollbar pb-1">
              {(["present","late","absent","leave","holiday","weekend"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-muted-foreground uppercase tracking-tighter">
                  <span className={cn("h-2.5 w-2.5 rounded-sm", statusMeta[s].dot)} />
                  {statusMeta[s].label}
                </span>
              ))}
            </div>
          </div>
          <div className="scroll-hint">
            ← Swipe to view days →
          </div>
          <div className="scrollable-table">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/60 backdrop-blur-md px-4 py-4">Employee</th>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <th key={i} className="px-1 py-4 text-center">{i + 1}</th>
                  ))}
                  <th className="px-3 py-4 text-center">P</th>
                  <th className="px-3 py-4 text-center">A</th>
                  <th className="px-3 py-4 text-center">L</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                   <tr><td colSpan={daysInMonth + 4} className="py-20 text-center text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Loading report data...</td></tr>
                ) : muster.map((row) => {
                  const p = row.row.filter((s: string) => s === "present").length;
                  const a = row.row.filter((s: string) => s === "absent").length;
                  const l = row.row.filter((s: string) => s === "leave" || s === "late").length;
                  return (
                    <tr key={row.id} className="border-t hover:bg-accent/20 transition-colors">
                      <td className="sticky left-0 z-10 bg-card/80 backdrop-blur-md px-4 py-3 shadow-[5px_0_10px_-5px_rgba(0,0,0,0.05)]">
                        <div className="text-sm font-black tracking-tight">{row.name}</div>
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{row.role}</div>
                      </td>
                      {row.row.map((s: AttendanceStatus, i: number) => (
                        <td key={i} className="px-0.5 py-3">
                          <div className={cn("mx-auto h-5 w-5 rounded-md shadow-sm transition-transform hover:scale-110", statusMeta[s].dot)} title={statusMeta[s].label} />
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center font-black text-success bg-success/5">{p}</td>
                      <td className="px-3 py-3 text-center font-black text-destructive bg-destructive/5">{a}</td>
                      <td className="px-3 py-3 text-center font-black text-info bg-info/5">{l}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "payroll" && (
        <div className="responsive-table-container transition-all hover:shadow-elegant">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b p-5 gap-4">
            <div>
              <h2 className="text-lg font-black tracking-tight">Payroll Summary Report</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Net salary and deduction breakdown</p>
            </div>
            <button 
              onClick={() => exportToCSV(payslips.map(p => ({ Employee: p.profiles?.name, Month: p.month, Net: p.net_payable, Status: p.status })), "payroll_report")}
              className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-accent transition-all"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
          <div className="scroll-hint">
            ← Swipe to view payroll details →
          </div>
          <div className="scrollable-table">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">Employee</th>
                  <th className="px-4 py-4">Month</th>
                  <th className="px-4 py-4 text-right">Gross</th>
                  <th className="px-4 py-4 text-right text-destructive">Deductions</th>
                  <th className="px-4 py-4 text-right">Net Payable</th>
                  <th className="px-4 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-20 text-center text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Loading payroll data...</td></tr>
                ) : payslips.length === 0 ? (
                  <tr><td colSpan={6} className="py-20 text-center text-muted-foreground font-bold uppercase tracking-widest text-[10px]">No payroll records found.</td></tr>
                ) : payslips.map((p) => {
                  const gross = Number(p.basic_pay) + Number(p.hra) + Number(p.allowances) + Number(p.bonus) + Number(p.overtime_pay);
                  const ded = Number(p.fines) + Number(p.loan_deduction) + Number(p.tax);
                  return (
                    <tr key={p.id} className="border-t hover:bg-accent/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-black tracking-tight">{p.profiles?.name}</div>
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Payslip ID: {p.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-muted-foreground">{p.month}</td>
                      <td className="px-4 py-4 text-right font-medium">{currency} {gross.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right font-medium text-destructive">−{currency} {ded.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right font-black text-primary text-base">{currency} {p.net_payable.toLocaleString()}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest shadow-sm",
                          p.status === "Paid" ? "border-success/40 bg-success/10 text-success" :
                          p.status === "Processing" ? "border-info/40 bg-info/10 text-info" :
                          "border-warning/40 bg-warning/10 text-warning")}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
