import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Edit2, Plus, RefreshCw, Save, Trash2, X, Plane } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { LeaveStatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/leaves")({
  head: () => ({
    meta: [
      { title: "Leaves — Attendly" },
      { name: "description", content: "Apply for leaves and review your past leave requests." },
    ],
  }),
  component: LeavesPage,
});

function LeavesPage() {
  const { profile, isAdmin, isManager } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [allPending, setAllPending] = useState<any[]>([]);
  const [categories, setCategories] = useState<LeaveCategory[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"my" | "approvals" | "categories">("my");

  // Sync tab with URL search params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "approvals" || t === "categories" || t === "my") {
      setTab(t as any);
    }
  }, []);

  const canApprove = isAdmin || isManager;

  const loadLeaves = async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data: categoryData } = await supabase
      .from("leave_categories")
      .select("*")
      .order("sort_order")
      .order("name");
    if (categoryData) setCategories(categoryData as LeaveCategory[]);
    
    // Load my leaves
    const { data: myData } = await supabase
      .from("leaves")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    if (myData) setLeaves(myData);

    // Load all pending for admins/managers
    if (canApprove) {
      console.log("Loading all pending leaves for admin...");
      const { data: pendData, error: pendError } = await supabase
        .from("leaves")
        .select(`
          *,
          profiles:user_id (
            name
          )
        `)
        .eq("status", "Pending")
        .order("created_at", { ascending: false });
      
      if (pendError) {
        console.error("Error loading pending leaves:", pendError);
      } else if (pendData) {
        console.log("Found pending leaves:", pendData.length);
        setAllPending(pendData);
      }
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadLeaves();
  }, [profile, isAdmin, isManager]);

  const updateStatus = async (id: string, status: "Approved" | "Rejected") => {
    const { error } = await supabase
      .from("leaves")
      .update({ status })
      .eq("id", id);
    
    if (!error) {
      toast.success(`Request ${status.toLowerCase()}`);
      loadLeaves();
    } else toast.error(error.message);
  };

  const submit = async (data: any) => {
    const from = new Date(data.from);
    const to = new Date(data.to);
    const days = data.half ? 0.5 : Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    
    const { error } = await supabase.from("leaves").insert([{
      user_id: profile?.id,
      type: data.type,
      from_date: data.from,
      to_date: data.to,
      days: days,
      half_day: data.half,
      reason: data.reason,
      status: "Pending"
    }]);

    if (!error) {
      toast.success("Leave request submitted");
      setOpen(false);
      loadLeaves();
    } else toast.error(error.message);
  };

  const activeCategories = categories.filter((category) => category.is_active);
  const fallbackCategories = activeCategories.length > 0 ? activeCategories : DEFAULT_LEAVE_CATEGORIES;
  const balance = fallbackCategories.map((category, index) => {
    const used = leaves
      .filter((leave) => leave.type === category.name && leave.status === "Approved")
      .reduce((total, leave) => total + Number(leave.days || 0), 0);

    return {
      label: category.name,
      used,
      total: Number(category.annual_allowance || 0),
      tone: CATEGORY_TONES[index % CATEGORY_TONES.length],
    };
  });

  return (
    <div>
      <PageHeader
        title="Leaves"
        subtitle="Track balances and submit new leave requests"
        actions={
          <div className="flex items-center gap-2">
            {canApprove && (
              <div className="mr-4 flex rounded-lg border bg-card p-1 shadow-sm">
                <button
                  onClick={() => setTab("my")}
                  className={cn("rounded-md px-3 py-1 text-xs font-semibold transition-all", tab === "my" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  My Leaves
                </button>
                <button
                  onClick={() => setTab("approvals")}
                  className={cn("relative rounded-md px-3 py-1 text-xs font-semibold transition-all", tab === "approvals" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  Approvals
                  {allPending.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground ring-2 ring-background">{allPending.length}</span>}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setTab("categories")}
                    className={cn("rounded-md px-3 py-1 text-xs font-semibold transition-all", tab === "categories" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    Categories
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant"
            >
              <Plus className="h-4 w-4" /> Apply for Leave
            </button>
          </div>
        }
      />

      {tab === "my" ? (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            {balance.map((b) => {
              const pct = (b.used / b.total) * 100;
              return (
                <div key={b.label} className="rounded-xl border bg-card p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-muted-foreground">{b.label} Leave</div>
                    <Plane className={`h-4 w-4 ${b.tone}`} />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{Math.max(0, b.total - b.used)}</span>
                    <span className="text-sm text-muted-foreground">/ {b.total} left</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-semibold">My Requests</h2>
              <span className="text-xs text-muted-foreground">{leaves.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Period</th>
                    <th className="px-5 py-3">Days</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Loading leaves...</td></tr>
                  ) : leaves.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No leave requests found.</td></tr>
                  ) : leaves.map((l) => (
                    <tr key={l.id} className="border-t transition-colors hover:bg-accent/30">
                      <td className="px-5 py-3 font-medium">{l.type}</td>
                      <td className="px-5 py-3 text-muted-foreground">{l.from_date} → {l.to_date}</td>
                      <td className="px-5 py-3">{l.days}{l.half_day && " (½)"}</td>
                      <td className="px-5 py-3 max-w-xs truncate text-muted-foreground">{l.reason}</td>
                      <td className="px-5 py-3"><LeaveStatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : tab === "approvals" ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="text-lg font-semibold">Pending Approvals</h2>
              <p className="text-xs text-muted-foreground">Review and process team leave requests</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={loadLeaves}
                className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-xs font-semibold hover:bg-accent transition-colors"
                disabled={loading}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Refresh
              </button>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{allPending.length} requests</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Period</th>
                  <th className="px-5 py-3">Days</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Loading approvals...</td></tr>
                ) : allPending.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">No pending requests.</td></tr>
                ) : allPending.map((l) => {
                  const profileData = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
                  const userName = profileData?.name || "Unknown User";
                  
                  return (
                    <tr key={l.id} className="border-t transition-colors hover:bg-accent/30">
                      <td className="px-5 py-3">
                        <div className="font-bold text-foreground">{userName}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-tighter">ID: {l.user_id.split('-')[0]}</div>
                      </td>
                      <td className="px-5 py-3 font-medium">{l.type}</td>
                      <td className="px-5 py-3 text-muted-foreground">{l.from_date} → {l.to_date}</td>
                      <td className="px-5 py-3">{l.days}{l.half_day && " (½)"}</td>
                      <td className="px-5 py-3 max-w-xs truncate text-muted-foreground">{l.reason}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => updateStatus(l.id, "Rejected")}
                            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => updateStatus(l.id, "Approved")}
                            className="rounded-lg border border-success/30 bg-success/10 px-3 py-1 text-xs font-bold text-success hover:bg-success/20 transition-colors"
                          >
                            Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <LeaveCategoryManager categories={categories} onChange={loadLeaves} />
      )}

      {open && <LeaveModal categories={fallbackCategories} onClose={() => setOpen(false)} onSubmit={submit} />}
    </div>
  );
}

type LeaveCategory = {
  id?: string;
  name: string;
  annual_allowance: number;
  is_paid: boolean;
  is_active: boolean;
  sort_order: number;
};

const DEFAULT_LEAVE_CATEGORIES: LeaveCategory[] = [
  { name: "Annual", annual_allowance: 20, is_paid: true, is_active: true, sort_order: 1 },
  { name: "Sick", annual_allowance: 10, is_paid: true, is_active: true, sort_order: 2 },
  { name: "Casual", annual_allowance: 8, is_paid: true, is_active: true, sort_order: 3 },
  { name: "Unpaid", annual_allowance: 0, is_paid: false, is_active: true, sort_order: 4 },
];

const CATEGORY_TONES = ["text-info", "text-success", "text-warning", "text-destructive", "text-primary"];

function LeaveModal({ categories, onClose, onSubmit }: { categories: LeaveCategory[]; onClose: () => void; onSubmit: (d: any) => void }) {
  const [type, setType] = useState(categories[0]?.name ?? "Casual");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [half, setHalf] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-elegant animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Apply for Leave</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (from && to) onSubmit({ type, from, to, half, reason }); }}
          className="mt-5 space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Leave Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20">
              {categories.map((category) => <option key={category.name}>{category.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20" required />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border bg-background/40 p-3 transition-colors hover:bg-background/60">
            <input id="half" type="checkbox" checked={half} onChange={(e) => setHalf(e.target.checked)} className="h-4 w-4 accent-primary rounded" />
            <label htmlFor="half" className="text-sm font-medium cursor-pointer">Half-day leave</label>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full rounded-lg border bg-background p-3 text-sm focus:ring-2 focus:ring-primary/20" placeholder="Brief reason for your leave…" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
            <button type="submit" className="rounded-lg gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-elegant hover:scale-[1.02] transition-transform">Submit Request</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LeaveCategoryManager({ categories, onChange }: { categories: LeaveCategory[]; onChange: () => Promise<void> }) {
  const [draft, setDraft] = useState<LeaveCategory>({ name: "", annual_allowance: 0, is_paid: true, is_active: true, sort_order: categories.length + 1 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LeaveCategory | null>(null);
  const [saving, setSaving] = useState(false);

  const resetDraft = () => setDraft({ name: "", annual_allowance: 0, is_paid: true, is_active: true, sort_order: categories.length + 1 });

  const saveCategory = async (category: LeaveCategory, id?: string) => {
    if (!category.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setSaving(true);
    const payload = {
      name: category.name.trim(),
      annual_allowance: Number(category.annual_allowance || 0),
      is_paid: category.is_paid,
      is_active: category.is_active,
      sort_order: Number(category.sort_order || 0),
    };
    const result = id
      ? await supabase.from("leave_categories").update(payload).eq("id", id)
      : await supabase.from("leave_categories").insert([payload]);

    setSaving(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    toast.success(id ? "Leave category updated" : "Leave category added");
    setEditingId(null);
    setEditing(null);
    resetDraft();
    onChange();
  };

  const deleteCategory = async (category: LeaveCategory) => {
    if (!category.id) return;
    const used = await supabase.from("leaves").select("id", { count: "exact", head: true }).eq("type", category.name);
    if ((used.count || 0) > 0) {
      toast.error("This category is used by leave requests. Disable it instead.");
      return;
    }

    const { error } = await supabase.from("leave_categories").delete().eq("id", category.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Leave category deleted");
      onChange();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">Leave Categories</h2>
          <p className="text-xs text-muted-foreground">Control the leave types employees can request</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Allowance</th>
                <th className="px-5 py-3">Paid</th>
                <th className="px-5 py-3">Visible</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No categories yet. Add your first category.</td></tr>
              ) : categories.map((category) => {
                const isEditing = editingId === category.id;
                const row = isEditing && editing ? editing : category;

                return (
                  <tr key={category.id || category.name} className="border-t transition-colors hover:bg-accent/30">
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input value={row.name} onChange={(e) => setEditing({ ...row, name: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-3 text-sm" />
                      ) : (
                        <span className="font-semibold">{category.name}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input type="number" min="0" step="0.5" value={row.annual_allowance} onChange={(e) => setEditing({ ...row, annual_allowance: Number(e.target.value) })} className="h-9 w-24 rounded-lg border bg-background px-3 text-sm" />
                      ) : (
                        <span>{category.annual_allowance} days</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <input type="checkbox" checked={row.is_paid} disabled={!isEditing} onChange={(e) => setEditing({ ...row, is_paid: e.target.checked })} className="h-4 w-4 accent-primary" />
                    </td>
                    <td className="px-5 py-3">
                      <input type="checkbox" checked={row.is_active} disabled={!isEditing} onChange={(e) => setEditing({ ...row, is_active: e.target.checked })} className="h-4 w-4 accent-primary" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveCategory(row, category.id)} disabled={saving} className="inline-flex h-8 items-center gap-1 rounded-lg border border-success/30 bg-success/10 px-3 text-xs font-bold text-success hover:bg-success/20">
                              <Save className="h-3.5 w-3.5" /> Save
                            </button>
                            <button onClick={() => { setEditingId(null); setEditing(null); }} className="h-8 rounded-lg border px-3 text-xs font-semibold hover:bg-accent">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingId(category.id || null); setEditing(category); }} className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-semibold hover:bg-accent">
                              <Edit2 className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button onClick={() => deleteCategory(category)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-xs font-bold text-destructive hover:bg-destructive/20">
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); saveCategory(draft); }}
        className="h-fit rounded-xl border bg-card p-5 shadow-card"
      >
        <h2 className="text-lg font-semibold">Add Category</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</label>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" placeholder="Maternity, Work From Home..." />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Annual Allowance</label>
            <input type="number" min="0" step="0.5" value={draft.annual_allowance} onChange={(e) => setDraft({ ...draft, annual_allowance: Number(e.target.value) })} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-background/40 p-3">
            <span className="text-sm font-medium">Paid leave</span>
            <input type="checkbox" checked={draft.is_paid} onChange={(e) => setDraft({ ...draft, is_paid: e.target.checked })} className="h-4 w-4 accent-primary" />
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-background/40 p-3">
            <span className="text-sm font-medium">Visible to staff</span>
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="h-4 w-4 accent-primary" />
          </div>
          <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-elegant">
            <Plus className="h-4 w-4" /> Add Leave Category
          </button>
        </div>
      </form>
    </div>
  );
}
