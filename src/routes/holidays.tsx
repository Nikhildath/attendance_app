import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PartyPopper, Plus, Check, X } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useBranch } from "@/lib/branch-context";

export const Route = createFileRoute("/holidays")({
  head: () => ({
    meta: [
      { title: "Holidays & Comp-off — Attendly" },
      { name: "description", content: "Holiday policy, restricted holidays and compensatory off requests." },
    ],
  }),
  component: HolidaysPage,
});

const kindMeta: any = {
  public:     { label: "Public",     cls: "border-holiday/40 bg-holiday/10 text-holiday" },
  restricted: { label: "Restricted", cls: "border-warning/40 bg-warning/15 text-warning" },
  optional:   { label: "Optional",   cls: "border-info/40 bg-info/10 text-info" },
};

function HolidaysPage() {
  const [tab, setTab] = useState<"holidays" | "compoff">("holidays");
  const [holidays, setHolidays] = useState<any[]>([]);
  const [comps, setComps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { current: branch } = useBranch();

  const loadData = async () => {
    setLoading(true);
    let hQuery = supabase.from("company_holidays").select("*");
    
    // Fetch global holidays OR holidays for the current branch
    if (branch) {
      hQuery = hQuery.or(`branch_id.is.null,branch_id.eq.${branch.id}`);
    } else {
      hQuery = hQuery.is("branch_id", null);
    }

    const { data: h } = await hQuery.order("date");
    const { data: c } = await supabase.from("comp_off_requests").select("*, profiles(name)").order("created_at", { ascending: false });

    if (h) setHolidays(h);
    if (c) setComps(c);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("comp_off_requests")
      .update({ status })
      .eq("id", id);
    
    if (!error) {
      toast.success(`Request ${status}`);
      setComps((c) => c.map((x) => (x.id === id ? { ...x, status } : x)));
    } else toast.error(error.message);
  };

  return (
    <div>
      <PageHeader
        title="Holidays & Comp-Off"
        subtitle="Holiday policy with public, restricted and optional days · compensatory off requests"
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant">
            <Plus className="h-4 w-4" /> Apply Comp-off
          </button>
        }
      />

      <div className="mb-4 inline-flex rounded-lg border bg-card p-1 shadow-card">
        {(["holidays","compoff"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn(
            "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors",
            tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}>{t === "holidays" ? "Holiday Policy" : "Comp-off Requests"}</button>
        ))}
      </div>

      {tab === "holidays" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
             <div key="loading-h" translate="no" className="col-span-full py-20 text-center text-muted-foreground text-xs">
               Loading holidays...
             </div>
          ) : holidays.length === 0 ? (
             <div key="empty-h" className="col-span-full py-20 text-center text-muted-foreground text-xs">
               No holidays configured for this location.
             </div>
          ) : holidays.map((h, i) => {
            const meta = kindMeta[h.kind] || kindMeta.public;
            const date = new Date(h.date);
            return (
              <div key={h.id || i} className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-card transition-transform hover:-translate-y-0.5">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-holiday/10 text-holiday">
                  <span className="text-[10px] font-semibold uppercase">{date.toLocaleString("en", { month: "short" })}</span>
                  <span className="text-xl font-bold leading-none">{date.getDate()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <PartyPopper className="h-3.5 w-3.5 text-holiday shrink-0" />
                    <div className="truncate text-sm font-semibold">{h.name}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{h.region}</div>
                  <span className={cn("mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.cls)}>{meta.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "compoff" && (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">Comp-off Requests</h2>
            <p className="text-xs text-muted-foreground">Compensatory leave for working on holidays / weekends</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Worked On</th>
                  <th className="px-5 py-3 text-center">Days</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                   <tr key="loading-c"><td colSpan={6} translate="no" className="py-20 text-center text-muted-foreground text-xs">Loading requests...</td></tr>
                ) : comps.length === 0 ? (
                   <tr key="empty-c"><td colSpan={6} className="py-20 text-center text-muted-foreground text-xs">No requests found.</td></tr>
                ) : comps.map((c, i) => (
                  <tr key={c.id || i} className="border-t hover:bg-accent/30">
                    <td className="px-5 py-3 font-medium">{c.profiles?.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.worked_on}</td>
                    <td className="px-5 py-3 text-center">{c.days}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.reason}</td>
                    <td className="px-5 py-3">
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        c.status === "Approved" ? "border-success/40 bg-success/10 text-success" :
                        c.status === "Pending" ? "border-warning/40 bg-warning/15 text-warning" :
                        "border-destructive/40 bg-destructive/10 text-destructive"
                      )}>{c.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.status === "Pending" && (
                        <div className="inline-flex gap-1">
                          <button onClick={() => setStatus(c.id, "Approved")} className="rounded-lg p-1.5 text-success hover:bg-success/10"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setStatus(c.id, "Rejected")} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
