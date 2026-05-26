import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, X, Banknote, Wallet, Gift, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { toast } from "sonner";

export const Route = createFileRoute("/advances")({
  head: () => ({
    meta: [
      { title: "Advances & Bonuses — Attendly" },
      { name: "description", content: "Request advances, allowances and bonuses with approval workflows." },
    ],
  }),
  component: AdvancesPage,
});

const kindIcon: any = { Advance: Wallet, Bonus: Gift, Allowance: TrendingUp };

function AdvancesPage() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    let query = supabase.from("financial_requests").select("*, profiles(name)");
    if (profile?.role !== 'Admin') {
       query = query.eq('user_id', profile?.id);
    }
    const { data } = await query.order("created_at", { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    if (profile) loadData();
  }, [profile]);

  const visible = items.filter((i) => filter === "All" || i.kind === filter);
  const totalApproved = items.filter((i) => i.status === "Approved").reduce((s, i) => s + Number(i.amount), 0);
  const pendingCount = items.filter((i) => i.status === "Pending").length;
  const totalBonus = items.filter((i) => i.kind === "Bonus" && i.status === "Approved").reduce((s, i) => s + Number(i.amount), 0);

  const submit = async (data: any) => {
    const { error } = await supabase.from("financial_requests").insert([{
       ...data,
       user_id: profile?.id
    }]);
    
    if (!error) {
      toast.success("Request submitted successfully");
      loadData();
      setOpen(false);
    } else toast.error(error.message);
  };

  const updateStatus = async (id: string, status: string) => {
    if (profile?.role !== 'Admin') return;
    const { error } = await supabase.from("financial_requests").update({ status }).eq('id', id);
    if (!error) {
      toast.success(`Request ${status.toLowerCase()}ed`);
      loadData();
    } else toast.error(error.message);
  };

  return (
    <div>
      <PageHeader
        title="Advances & Bonuses"
        subtitle="Request salary advances, custom allowances and one-time bonuses"
        actions={
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant">
            <Plus className="h-4 w-4" /> New Request
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Approved" value={`${settings?.default_currency || 'INR'} ${totalApproved.toLocaleString()}`} icon={Wallet} tone="success" />
        <StatCard label="Pending Requests" value={pendingCount} icon={Plus} tone="warning" />
        <StatCard label="Bonuses Paid" value={`${settings?.default_currency || 'INR'} ${totalBonus.toLocaleString()}`} icon={Gift} tone="default" />
        <StatCard label="Total Balance" value={`${settings?.default_currency || 'INR'} ${(totalApproved - totalBonus).toLocaleString()}`} icon={TrendingUp} tone="info" />
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center gap-2">
        {(["All","Advance","Allowance","Bonus"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            filter === f ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent"
          )}>{f}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Applied</th>
                <th className="px-5 py-3 text-center">Status</th>
                {profile?.role === 'Admin' && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <tr><td colSpan={7} className="py-20 text-center text-muted-foreground text-xs">Loading requests...</td></tr>
              ) : visible.length === 0 ? (
                 <tr><td colSpan={7} className="py-20 text-center text-muted-foreground text-xs">No requests found.</td></tr>
              ) : visible.map((r) => {
                const Icon = kindIcon[r.kind] || Wallet;
                return (
                  <tr key={r.id} className="border-t hover:bg-accent/20">
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium"><Icon className="h-3.5 w-3.5 text-primary" /> {r.kind}</span>
                    </td>
                    <td className="px-5 py-3 font-medium">{r.profiles?.name}</td>
                    <td className="px-5 py-3 font-semibold">{settings?.default_currency || 'INR'} {Number(r.amount).toLocaleString()}</td>
                    <td className="px-5 py-3 max-w-xs truncate text-muted-foreground">{r.reason}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        r.status === "Approved" ? "border-success/40 bg-success/10 text-success" :
                        r.status === "Pending" ? "border-warning/40 bg-warning/15 text-warning" :
                        "border-destructive/40 bg-destructive/10 text-destructive"
                      )}>{r.status}</span>
                    </td>
                    {profile?.role === 'Admin' && r.status === "Pending" && (
                        <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-2">
                                <button onClick={() => updateStatus(r.id, "Approved")} className="text-[10px] font-bold uppercase text-success hover:underline">Approve</button>
                                <button onClick={() => updateStatus(r.id, "Rejected")} className="text-[10px] font-bold uppercase text-destructive hover:underline">Reject</button>
                            </div>
                        </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open && <RequestModal onClose={() => setOpen(false)} onSubmit={submit} name={profile?.name || ""} />}
    </div>
  );
}

function RequestModal({ onClose, onSubmit, name }: { onClose: () => void; onSubmit: (d: any) => void; name: string }) {
  const [kind, setKind] = useState<string>("Advance");
  const [amount, setAmount] = useState(500);
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-elegant">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Financial Request</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ kind, amount, reason }); }}>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary transition-colors">
              {(["Advance","Allowance","Bonus"] as const).map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</label>
            <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary transition-colors" required min={1} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full rounded-lg border bg-background p-3 text-sm outline-none focus:border-primary transition-colors" placeholder="Brief reason for this request..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
            <button type="submit" className="rounded-lg gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-elegant transition-opacity hover:opacity-90">Submit Request</button>
          </div>
        </form>
      </div>
    </div>
  );
}
