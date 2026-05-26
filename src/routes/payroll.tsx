import { createFileRoute } from "@tanstack/react-router";
import { Wallet, TrendingUp, Download, FileText, AlertTriangle, Plus, Users, Save, Edit2, X, Clock, BadgeAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useSettings } from "@/lib/settings-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { exportToCSV } from "@/lib/csv-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — Attendly" },
      { name: "description", content: "Managed payroll with fines, allowances and overtime tracking." },
    ],
  }),
  component: PayrollPage,
});

function PayrollPage() {
  const { settings } = useSettings();
  const { profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role?.toLowerCase() === "admin";
  
  const today = new Date();
  const currentMonthStr = today.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  
  const [month, setMonth] = useState(currentMonthStr);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [otDetails, setOtDetails] = useState<any[]>([]);
  const [fineDetails, setFineDetails] = useState<any[]>([]);

  const currency = settings?.default_currency || "INR";
  const lateFine = settings?.late_fine_amount || 50;

  const monthOptions = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthOptions.push(d.toLocaleString('en-US', { month: 'short', year: 'numeric' }));
  }

  const loadData = async () => {
    if (!profile?.id && !authLoading) return;
    setLoading(true);

    // 1. Load Payslips for the selected month
    let query = supabase.from("payslips").select(`*, profiles(name)`).eq("month", month);
    if (!isAdmin) query = query.eq("user_id", profile?.id);
    const { data: pay } = await query;
    if (pay) setPayslips(pay);

    // 2. Load Attendance Data for Fines & OT — use check_in date range, not created_at
    const [year, monthIdx] = (() => {
      const d = new Date(month);
      return [d.getFullYear(), d.getMonth()];
    })();
    const start = new Date(year, monthIdx, 1).toISOString();
    const end = new Date(year, monthIdx + 1, 1).toISOString();

    let attQuery = supabase
      .from("attendance")
      .select("*, profiles(name)")
      .gte("check_in", start)
      .lt("check_in", end);
    if (!isAdmin) attQuery = attQuery.eq("user_id", profile?.id);

    const { data: att } = await attQuery;
    if (att) {
        const limit = (settings?.working_hours_per_day || 9) * 3600 * 1000;
        const ot = att.filter(r => r.check_in && r.check_out && (new Date(r.check_out).getTime() - new Date(r.check_in).getTime() > limit));
        setOtDetails(ot);
        const fines = att.filter(r => r.status === "late");
        setFineDetails(fines);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [month, profile, isAdmin, settings, authLoading]);

  const handleRunPayroll = async () => {
    if (!isAdmin) return toast.error("Only admins can run payroll.");
    
    setLoading(true);
    toast.info("Analyzing attendance and processing payroll...");

    // 1. Get all employees
    const { data: employees, error: empError } = await supabase.from("profiles").select("id, name");
    if (empError) {
        setLoading(false);
        return toast.error("Failed to fetch employees");
    }

    // 2. Fetch existing payslips for this month to avoid duplicates and allow updates
    const { data: existingPayslips } = await supabase.from("payslips").select("*").eq("month", month);
    const existingMap = new Map(existingPayslips?.map(p => [p.user_id, p]) || []);
    
    // 3. Fetch all attendance for the selected month to calculate fines & OT
    const [year, monthIdx] = (() => {
      const d = new Date(month);
      return [d.getFullYear(), d.getMonth()];
    })();
    const start = new Date(year, monthIdx, 1).toISOString();
    const end = new Date(year, monthIdx + 1, 1).toISOString();

    const { data: allAttendance } = await supabase.from("attendance").select("user_id, status, check_in, check_out").gte("check_in", start).lt("check_in", end);

    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    const workHoursLimit = settings?.working_hours_per_day || 9;
    const otRate = (settings as any)?.overtime_rate || 200;

    employees.forEach(emp => {
        const existing = existingMap.get(emp.id);
        
        // Skip if already paid
        if (existing && existing.status === 'Paid') return;

        const userAtt = allAttendance?.filter(a => a.user_id === emp.id) || [];
        const lateCount = userAtt.filter(a => a.status?.toLowerCase() === 'late').length;
        const totalFine = lateCount * lateFine;
        
        let totalOtPay = 0;
        userAtt.forEach(a => {
            if (a.check_in && a.check_out) {
                const hours = (new Date(a.check_out).getTime() - new Date(a.check_in).getTime()) / (3600 * 1000);
                if (hours > workHoursLimit) {
                    totalOtPay += (hours - workHoursLimit) * otRate;
                }
            }
        });

        const basic = 25000;
        const hra = 5000;
        const otPay = Math.round(totalOtPay);
        const net = Math.round(basic + hra + otPay - totalFine);

        const payload = {
            user_id: emp.id,
            month: month,
            basic_pay: basic,
            hra: hra,
            allowances: 0,
            bonus: 0,
            overtime_pay: otPay,
            fines: totalFine,
            tax: 0,
            net_payable: net,
            status: 'Pending'
        };

        if (existing) {
            toUpdate.push({ id: existing.id, ...payload });
        } else {
            toInsert.push(payload);
        }
    });

    if (toInsert.length === 0 && toUpdate.length === 0) {
        setLoading(false);
        return toast.info("No new payslips to generate or update.");
    }

    try {
        let successCount = 0;
        
        if (toInsert.length > 0) {
            const { error: insError } = await supabase.from("payslips").insert(toInsert);
            if (insError) throw insError;
            successCount += toInsert.length;
        }

        if (toUpdate.length > 0) {
            // Bulk update is tricky in Supabase without an RPC, so we'll do it one by one or via upsert if we had a unique constraint
            // For now, let's just use upsert which works if we include the ID
            const { error: updError } = await supabase.from("payslips").upsert(toUpdate);
            if (updError) throw updError;
            successCount += toUpdate.length;
        }

        toast.success(`Successfully processed ${successCount} payslips for ${month}`);
        loadData();
    } catch (err: any) {
        toast.error("Payroll Error: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditData({ ...p });
  };

  const saveEdit = async () => {
    const { profiles, ...updates } = editData;
    updates.net_payable = Number(updates.basic_pay) + Number(updates.hra) + Number(updates.allowances) + Number(updates.bonus) + Number(updates.overtime_pay || 0) - Number(updates.fines) - Number(updates.tax);
    
    const { error } = await supabase.from("payslips").update(updates).eq("id", editingId);
    if (!error) {
        toast.success("Payslip updated");
        setEditingId(null);
        loadData();
    } else toast.error(error.message);
  };

  const handleExport = () => {
    if (payslips.length === 0) return toast.error("No data to export");
    exportToCSV(payslips.map(p => ({
        Employee: p.profiles?.name,
        Month: p.month,
        Basic: p.basic_pay,
        HRA: p.hra,
        Allowances: p.allowances,
        Bonus: p.bonus,
        Fines: p.fines,
        NetPayable: p.net_payable,
        Status: p.status
    })), `payroll_${month.replace(' ', '_')}`);
  };

  const totals = payslips.reduce((acc, p) => ({
    gross: acc.gross + Number(p.basic_pay) + Number(p.hra) + Number(p.allowances) + Number(p.bonus) + Number(p.overtime_pay || 0),
    net: acc.net + Number(p.net_payable),
    fines: acc.fines + Number(p.fines),
    ot: acc.ot + Number(p.overtime_pay || 0),
  }), { gross: 0, net: 0, fines: 0, ot: 0 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll & Deductions"
        subtitle="Manage salary processing, variable late fines and overtime tracking"
        actions={
          <div className="flex items-center gap-3">
            {isAdmin && (
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary border border-primary/20">
                    <ShieldCheck className="h-3.5 w-3.5" /> Admin Access
                </div>
            )}
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-lg border bg-card px-3 text-sm font-medium focus:border-primary outline-none">
              {monthOptions.map(m => <option key={m}>{m}</option>)}
            </select>
            {isAdmin && (
                <button onClick={handleRunPayroll} className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant transition-all hover:scale-105 active:scale-95">
                    <Plus className="h-4 w-4" /> Run Payroll
                </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Net Payable" value={`${currency} ${totals.net.toLocaleString()}`} icon={Wallet} tone="success" />
        <StatCard label="Gross Payroll" value={`${currency} ${totals.gross.toLocaleString()}`} icon={TrendingUp} tone="info" />
        <StatCard label="Fined Instances" value={fineDetails.length} icon={BadgeAlert} tone="warning" />
        <StatCard label="Staff on OT" value={new Set(otDetails.map(d => d.user_id)).size} icon={Users} tone="default" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RuleCard title="Late Fine Variable" formula={`${currency} ${lateFine} / instance`} detail="Adjustable by Admin in Settings. Automatically calculated for every late mark." />
        <RuleCard title="Overtime Policy" formula="Duration Tracking" detail={`Working > ${settings?.working_hours_per_day || 9} hours per day is logged below.`} />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex items-center justify-between border-b p-5 bg-muted/10">
          <h2 className="text-lg font-semibold">{isAdmin ? "Organization Payroll" : "My Payslip"} · {month}</h2>
          <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th className="px-4 py-3 text-right">Basic</th>
                <th className="px-4 py-3 text-right">HRA</th>
                <th className="px-4 py-3 text-right">Allow.</th>
                <th className="px-4 py-3 text-right">Bonus</th>
                <th className="px-4 py-3 text-right text-success">OT Pay</th>
                <th className="px-4 py-3 text-right text-destructive">Fines</th>
                <th className="px-4 py-3 text-right text-destructive">Tax</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3 text-center">Status</th>
                {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="py-20 text-center text-muted-foreground text-xs uppercase tracking-widest">Loading Records...</td></tr>
              ) : payslips.length === 0 ? (
                <tr><td colSpan={11} className="py-20 text-center text-muted-foreground text-xs uppercase tracking-widest">No Records Found</td></tr>
              ) : payslips.map((p) => (
                <tr key={p.id} className="border-t hover:bg-accent/20 transition-colors">
                  <td className="px-5 py-3 font-medium text-primary">{p.profiles?.name}</td>
                  {editingId === p.id ? (
                      <>
                        <td className="px-4 py-3"><input type="number" className="w-24 rounded border bg-background px-2 py-1 text-right focus:border-primary outline-none" value={editData.basic_pay} onChange={e => setEditData({...editData, basic_pay: e.target.value})} /></td>
                        <td className="px-4 py-3"><input type="number" className="w-20 rounded border bg-background px-2 py-1 text-right focus:border-primary outline-none" value={editData.hra} onChange={e => setEditData({...editData, hra: e.target.value})} /></td>
                        <td className="px-4 py-3"><input type="number" className="w-20 rounded border bg-background px-2 py-1 text-right focus:border-primary outline-none" value={editData.allowances} onChange={e => setEditData({...editData, allowances: e.target.value})} /></td>
                        <td className="px-4 py-3"><input type="number" className="w-20 rounded border bg-background px-2 py-1 text-right focus:border-primary outline-none text-success font-bold" value={editData.bonus} onChange={e => setEditData({...editData, bonus: e.target.value})} /></td>
                        <td className="px-4 py-3"><input type="number" className="w-20 rounded border bg-background px-2 py-1 text-right focus:border-primary outline-none text-success font-bold" value={editData.overtime_pay} onChange={e => setEditData({...editData, overtime_pay: e.target.value})} /></td>
                        <td className="px-4 py-3"><input type="number" className="w-20 rounded border bg-background px-2 py-1 text-right focus:border-primary outline-none text-destructive font-bold" value={editData.fines} onChange={e => setEditData({...editData, fines: e.target.value})} /></td>
                        <td className="px-4 py-3"><input type="number" className="w-20 rounded border bg-background px-2 py-1 text-right focus:border-primary outline-none text-destructive font-bold" value={editData.tax} onChange={e => setEditData({...editData, tax: e.target.value})} /></td>
                      </>
                  ) : (
                      <>
                        <td className="px-4 py-3 text-right font-medium">{currency} {Number(p.basic_pay).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{currency} {Number(p.hra).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{currency} {Number(p.allowances).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-success">{currency} {Number(p.bonus).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-success">{currency} {Number(p.overtime_pay || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-destructive">−{currency} {Number(p.fines).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-destructive">−{currency} {Number(p.tax).toLocaleString()}</td>
                      </>
                  )}
                  <td className="px-4 py-3 text-right font-black text-primary">
                    {currency} {Number(editingId === p.id ? (Number(editData.basic_pay) + Number(editData.hra) + Number(editData.allowances) + Number(editData.bonus) + Number(editData.overtime_pay || 0) - Number(editData.fines) - Number(editData.tax)) : p.net_payable).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === p.id ? (
                        <select 
                            value={editData.status} 
                            onChange={e => setEditData({...editData, status: e.target.value})}
                            className="rounded border bg-background px-1 py-1 text-[10px] font-bold outline-none focus:border-primary"
                        >
                            <option>Pending</option>
                            <option>Paid</option>
                        </select>
                    ) : (
                        <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold shadow-sm uppercase tracking-wider",
                          p.status === "Paid" ? "border-success/40 bg-success/10 text-success" :
                          "border-warning/40 bg-warning/15 text-warning"
                        )}>
                          {p.status}
                        </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {isAdmin && (
                        editingId === p.id ? (
                            <div className="flex justify-end gap-2">
                                <button onClick={saveEdit} className="inline-flex items-center gap-1 rounded-lg bg-success px-2 py-1 text-[10px] font-bold text-white shadow-lg hover:opacity-90">
                                    <Save className="h-3 w-3" /> Save
                                </button>
                                <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-lg bg-zinc-600 px-2 py-1 text-[10px] font-bold text-white shadow-lg hover:opacity-90">
                                    <X className="h-3 w-3" /> Close
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => startEdit(p)} 
                                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary transition-all hover:bg-primary hover:text-white"
                            >
                                <Edit2 className="h-3 w-3" /> Edit Record
                            </button>
                        )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
          {loading ? (
            <div className="py-20 text-center text-muted-foreground text-xs uppercase tracking-widest">Loading Records...</div>
          ) : payslips.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-xs uppercase tracking-widest">No Records Found</div>
          ) : payslips.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border/50 bg-background/50 p-4 space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-primary">{p.profiles?.name}</h4>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{p.month}</p>
                </div>
                <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest",
                  p.status === "Paid" ? "border-success/40 bg-success/10 text-success" :
                  "border-warning/40 bg-warning/15 text-warning"
                )}>
                  {p.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Gross Earnings</p>
                  <p className="text-sm font-bold text-success">
                    {currency} {(Number(p.basic_pay) + Number(p.hra) + Number(p.allowances) + Number(p.bonus) + Number(p.overtime_pay || 0)).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total Fines</p>
                  <p className="text-sm font-bold text-destructive">
                    −{currency} {Number(p.fines).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-primary/5 -mx-4 -mb-4 p-4 mt-2">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Net Payable</p>
                  <p className="text-lg font-black text-primary leading-tight">
                    {currency} {Number(p.net_payable).toLocaleString()}
                  </p>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => startEdit(p)} 
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg active:scale-90 transition-transform"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
          {/* Late Fines Detail */}
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
              <div className="border-b p-4 bg-muted/20">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                      <BadgeAlert className="h-4 w-4 text-warning" /> Fine Breakdown · {month}
                  </h3>
              </div>
              <div className="p-0 max-h-64 overflow-y-auto scrollbar-thin">
                  {fineDetails.length === 0 ? (
                      <div className="py-10 text-center text-xs text-muted-foreground">No late marks found.</div>
                  ) : fineDetails.map((f, i) => (
                      <div key={i} className="flex items-center justify-between border-b border-border/60 dark:border-white/5 p-4 last:border-0 hover:bg-accent/10">
                          <div>
                              <div className="font-bold text-sm">{f.profiles?.name}</div>
                              <div className="text-[10px] text-muted-foreground uppercase">{new Date(f.check_in || f.created_at).toLocaleDateString(undefined, {weekday:'short', day:'numeric', month:'short'})}</div>
                          </div>
                          <div className="text-right">
                              <div className="font-black text-destructive text-sm">−{currency} {lateFine}</div>
                              <div className="text-[10px] text-muted-foreground">
                                Late Punch: {f.check_in ? new Date(f.check_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'N/A'}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          {/* Overtime Details */}
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
              <div className="border-b p-4 bg-muted/20">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                      <Clock className="h-4 w-4 text-success" /> Overtime Tracker · {month}
                  </h3>
              </div>
              <div className="p-0 max-h-64 overflow-y-auto scrollbar-thin">
                  {otDetails.length === 0 ? (
                      <div className="py-10 text-center text-xs text-muted-foreground">No overtime recorded.</div>
                  ) : otDetails.map((r, i) => {
                      const duration = (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / (3600 * 1000);
                      return (
                          <div key={i} className="flex items-center justify-between border-b border-border/60 dark:border-white/5 p-4 last:border-0 hover:bg-accent/10">
                              <div>
                                  <div className="font-bold text-sm">{r.profiles?.name}</div>
                                  <div className="text-[10px] text-muted-foreground uppercase">{new Date(r.created_at).toLocaleDateString(undefined, {weekday:'short', day:'numeric', month:'short'})}</div>
                              </div>
                              <div className="text-right">
                                  <div className="font-black text-success text-sm">{duration.toFixed(1)} hrs</div>
                                  <div className="text-[10px] text-muted-foreground">{new Date(r.check_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} — {new Date(r.check_out).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      </div>
    </div>
  );
}

function RuleCard({ title, formula, detail }: { title: string; formula: string; detail: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card transition-all hover:border-primary/30 group">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-primary transition-colors">{title}</div>
      <div className="mt-2 text-2xl font-black text-card-foreground">{formula}</div>
      <div className="mt-2 text-xs text-muted-foreground leading-relaxed">{detail}</div>
    </div>
  );
}
