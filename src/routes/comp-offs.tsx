import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/comp-offs")({
  head: () => ({
    meta: [
      { title: "Comp Offs — Attendly" },
      { name: "description", content: "Apply for Compensatory Offs and track approvals." },
    ],
  }),
  component: CompOffsPage,
});

function CompOffsPage() {
  const { profile, isAdmin, isManager } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [allPending, setAllPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"my" | "approvals">("my");
  const [open, setOpen] = useState(false);

  const canApprove = isAdmin || isManager;

  const loadRequests = async () => {
    if (!profile?.id) return;
    setLoading(true);

    // Load My Requests
    const { data: myData } = await supabase
      .from("comp_off_requests")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    
    if (myData) setRequests(myData);

    // Load Approvals
    if (canApprove) {
      const { data: pendData } = await supabase
        .from("comp_off_requests")
        .select(`*, profiles:user_id(name)`)
        .eq("status", "Pending")
        .order("created_at", { ascending: false });
      
      if (pendData) setAllPending(pendData);
    }
    setLoading(false);
  };

  useEffect(() => { loadRequests(); }, [profile, canApprove]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const worked_on = formData.get("worked_on") as string;
    const days = Number(formData.get("days"));
    const reason = formData.get("reason") as string;

    const { error } = await supabase.from("comp_off_requests").insert([{
      user_id: profile?.id,
      worked_on,
      days,
      reason,
      status: "Pending"
    }]);

    if (!error) {
      toast.success("Comp Off request submitted!");
      setOpen(false);
      loadRequests();
    } else toast.error(error.message);
  };

  const updateStatus = async (id: string, status: "Approved" | "Rejected") => {
    const { error } = await supabase.from("comp_off_requests").update({ status }).eq("id", id);
    if (!error) {
      toast.success(`Request ${status.toLowerCase()}`);
      loadRequests();
    } else toast.error(error.message);
  };

  return (
    <div>
      <PageHeader
        title="Compensatory Offs"
        subtitle="Request time off for working on holidays or weekends"
        actions={
          <div className="flex items-center gap-2">
            {canApprove && (
              <div className="mr-4 flex rounded-lg border bg-card p-1 shadow-sm">
                <button
                  onClick={() => setTab("my")}
                  className={cn("rounded-md px-3 py-1 text-xs font-semibold transition-all", tab === "my" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  My Requests
                </button>
                <button
                  onClick={() => setTab("approvals")}
                  className={cn("relative rounded-md px-3 py-1 text-xs font-semibold transition-all", tab === "approvals" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  Approvals
                  {allPending.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground ring-2 ring-background">{allPending.length}</span>}
                </button>
              </div>
            )}
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant"
            >
              <Plus className="h-4 w-4" /> Apply Comp-Off
            </button>
          </div>
        }
      />

      {tab === "my" ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="flex items-center justify-between border-b p-5">
            <h2 className="text-lg font-semibold">My Comp-Offs</h2>
            <span className="text-xs text-muted-foreground">{requests.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Worked On</th>
                  <th className="px-5 py-3">Days Earned</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Loading...</td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">No requests found.</td></tr>
                ) : requests.map((r) => (
                  <tr key={r.id} className="border-t transition-colors hover:bg-accent/30">
                    <td className="px-5 py-3 font-medium">{r.worked_on}</td>
                    <td className="px-5 py-3">{r.days}</td>
                    <td className="px-5 py-3 max-w-xs truncate text-muted-foreground">{r.reason}</td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                        r.status === "Approved" ? "bg-success/10 text-success" :
                        r.status === "Rejected" ? "bg-destructive/10 text-destructive" :
                        "bg-warning/10 text-warning"
                      )}>
                        {r.status === "Approved" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                         r.status === "Rejected" ? <XCircle className="h-3.5 w-3.5" /> :
                         <Clock className="h-3.5 w-3.5" />}
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="flex items-center justify-between border-b p-5">
            <h2 className="text-lg font-semibold">Pending Approvals</h2>
            <span className="text-xs text-muted-foreground">{allPending.length} requests</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Worked On</th>
                  <th className="px-5 py-3">Days</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Loading...</td></tr>
                ) : allPending.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No pending requests.</td></tr>
                ) : allPending.map((r) => {
                  const profileData = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
                  const userName = profileData?.name || "Unknown User";
                  return (
                    <tr key={r.id} className="border-t transition-colors hover:bg-accent/30">
                      <td className="px-5 py-3 font-bold">{userName}</td>
                      <td className="px-5 py-3 font-medium">{r.worked_on}</td>
                      <td className="px-5 py-3">{r.days}</td>
                      <td className="px-5 py-3 max-w-xs truncate text-muted-foreground">{r.reason}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => updateStatus(r.id, "Rejected")} className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors">Reject</button>
                          <button onClick={() => updateStatus(r.id, "Approved")} className="rounded-lg border border-success/30 bg-success/10 px-3 py-1 text-xs font-bold text-success hover:bg-success/20 transition-colors">Approve</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-elegant animate-in fade-in zoom-in duration-200">
            <h2 className="text-lg font-semibold mb-5">Apply Comp Off</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Date Worked On</label>
                <input name="worked_on" type="date" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" required />
                <p className="mt-1 text-[10px] text-muted-foreground">The holiday or weekend date you worked on.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Days Earned</label>
                <input name="days" type="number" min="0.5" step="0.5" defaultValue={1} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Reason</label>
                <textarea name="reason" rows={3} className="w-full rounded-lg border bg-background p-3 text-sm" placeholder="Why were you required to work?" required />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
                <button type="submit" className="rounded-lg gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-elegant hover:scale-[1.02] transition-transform">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
