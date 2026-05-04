import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CalendarRange, Plus, Edit2, Trash2, X, Clock, Palette } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/shifts")({
  head: () => ({
    meta: [
      { title: "Shifts — Attendly" },
      { name: "description", content: "Manage work shifts and employee weekly schedules." },
    ],
  }),
  component: ShiftsPage,
});

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ShiftsPage() {
  const { isAdmin, isManager } = useAuth();
  const [filter, setFilter] = useState<"all" | "fixed" | "rotational" | "open">("all");
  const [shifts, setShifts] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [shiftModal, setShiftModal] = useState<{ open: boolean; shift?: any }>({ open: false });
  const [assignModal, setAssignModal] = useState<{ open: boolean; user?: any; day?: string; currentShiftId?: string }>({ open: false });

  const canManage = isAdmin || isManager;

  const loadData = async () => {
    setLoading(true);
    const { data: s } = await supabase.from("shifts").select("*").order("name");
    const { data: sch } = await supabase.from("shift_schedule").select("*");
    const { data: m } = await supabase.from("profiles").select("*").order("name");

    if (s) setShifts(s);
    if (sch) setSchedule(sch);
    if (m) setMembers(m);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveShift = async (data: any) => {
    const isNew = !shiftModal.shift;
    const { error } = isNew 
      ? await supabase.from("shifts").insert([data])
      : await supabase.from("shifts").update(data).eq("id", shiftModal.shift.id);

    if (!error) {
      toast.success(isNew ? "Shift created" : "Shift updated");
      setShiftModal({ open: false });
      loadData();
    } else toast.error(error.message);
  };

  const deleteShift = async (id: string) => {
    if (!confirm("Delete this shift? It might be assigned to users.")) return;
    const { error } = await supabase.from("shifts").delete().eq("id", id);
    if (!error) {
      toast.success("Shift deleted");
      loadData();
    } else toast.error("Could not delete. It may be in use.");
  };

  const assignShift = async (userId: string, day: string, shiftId: string | null) => {
    const existing = schedule.find(s => s.user_id === userId);
    const update = { [day]: shiftId };

    const { error } = existing 
      ? await supabase.from("shift_schedule").update(update).eq("user_id", userId)
      : await supabase.from("shift_schedule").insert([{ user_id: userId, ...update }]);

    if (!error) {
      toast.success("Schedule updated");
      setAssignModal({ open: false });
      loadData();
    } else toast.error(error.message);
  };

  const visibleShifts = shifts.filter((s) => filter === "all" || s.type === filter);

  return (
    <div>
      <PageHeader
        title="Shift Management"
        subtitle="Manage work shifts and dynamic weekly rosters"
        actions={canManage && (
          <button 
            onClick={() => setShiftModal({ open: true })}
            className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant transition-transform hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" /> New Shift
          </button>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all","fixed","rotational","open"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn(
            "rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition-all",
            filter === f ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card hover:bg-accent text-muted-foreground"
          )}>{f}</button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-10 text-center text-muted-foreground text-xs">Loading shifts...</div>
        ) : visibleShifts.length === 0 ? (
          <div className="col-span-full py-10 text-center text-muted-foreground border rounded-xl bg-card/50 border-dashed">No shifts found. Create one to get started.</div>
        ) : visibleShifts.map((s) => (
          <div key={s.id} className="group relative rounded-xl border bg-card p-5 shadow-card transition-all hover:border-primary/50 hover:shadow-elegant">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.type}</div>
                <div className="mt-1 text-lg font-bold">{s.name}</div>
              </div>
              <div className="flex items-center gap-1">
                {canManage && (
                  <div className="mr-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setShiftModal({ open: true, shift: s })} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => deleteShift(s.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-sm", s.color)}>Active</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-2xl font-black tabular-nums tracking-tighter">
              <span>{s.start_time}</span>
              <span className="text-muted-foreground/30 font-light">→</span>
              <span>{s.end_time}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Break: {s.break_minutes} min</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">Shift ID: {s.id.split('-')[0]}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-lg font-semibold">Weekly Schedule</h2>
            <p className="text-xs text-muted-foreground">Click on cells to assign shifts to employees</p>
          </div>
          <CalendarRange className="h-5 w-5 text-muted-foreground opacity-50" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 md:px-5 py-4 w-[120px] max-w-[120px] md:w-[200px] md:max-w-[200px] bg-card sticky left-0 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.1)] truncate">Employee</th>
                {DAY_LABELS.map((d) => <th key={d} className="px-3 py-4 text-center min-w-[100px]">{d}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={8} className="py-20 text-center text-muted-foreground text-xs">Loading roster...</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={8} className="py-20 text-center text-muted-foreground">No employees found.</td></tr>
              ) : members.map((m) => {
                const sched = schedule.find((s) => s.user_id === m.id);
                return (
                  <tr key={m.id} className="group transition-colors hover:bg-accent/10">
                    <td className="px-3 md:px-5 py-4 bg-card sticky left-0 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.1)] w-[120px] max-w-[120px] md:w-[200px] md:max-w-[200px]">
                      <div className="font-bold text-foreground truncate">{m.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-tight truncate">{m.role} • {m.dept || "No Dept"}</div>
                    </td>
                    {DAYS.map((d, i) => {
                      const shiftId = sched?.[d];
                      const sh = shiftId ? shifts.find((s) => s.id === shiftId) : null;
                      return (
                        <td key={i} className="px-2 py-4">
                          <button
                            onClick={() => canManage && setAssignModal({ open: true, user: m, day: d, currentShiftId: shiftId })}
                            disabled={!canManage}
                            className={cn(
                              "mx-auto flex w-full flex-col items-center justify-center rounded-lg border p-1.5 transition-all text-center group/cell",
                              sh 
                                ? `${sh.color} shadow-sm hover:scale-105 active:scale-95` 
                                : "border-dashed bg-muted/20 hover:bg-muted/50 hover:border-primary/30"
                            )}
                          >
                            {sh ? (
                              <>
                                <span className="text-[11px] font-black uppercase truncate w-full">{sh.name}</span>
                                <span className="text-[9px] font-bold opacity-70 tracking-tighter tabular-nums">{sh.start_time === "—" ? "FLEXI" : `${sh.start_time}–${sh.end_time}`}</span>
                              </>
                            ) : (
                              <span className="py-2 text-[10px] font-medium text-muted-foreground/30 group-hover/cell:text-primary/50 transition-colors">OFF</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {shiftModal.open && (
        <ShiftModal 
          shift={shiftModal.shift} 
          onClose={() => setShiftModal({ open: false })} 
          onSave={saveShift} 
        />
      )}

      {assignModal.open && (
        <AssignModal 
          user={assignModal.user}
          day={assignModal.day!}
          shifts={shifts}
          currentShiftId={assignModal.currentShiftId}
          onClose={() => setAssignModal({ open: false })}
          onAssign={(shiftId) => assignShift(assignModal.user.id, assignModal.day!, shiftId)}
        />
      )}
    </div>
  );
}

function ShiftModal({ shift, onClose, onSave }: { shift?: any; onClose: () => void; onSave: (d: any) => void }) {
  const [name, setName] = useState(shift?.name || "");
  const [type, setType] = useState(shift?.type || "fixed");
  const [start, setStart] = useState(shift?.start_time || "09:00");
  const [end, setEnd] = useState(shift?.end_time || "18:00");
  const [breaks, setBreaks] = useState(shift?.break_minutes || 60);
  const [color, setColor] = useState(shift?.color || "bg-primary/10 text-primary border-primary/30");
  const [workOnHolidays, setWorkOnHolidays] = useState(shift?.work_on_holidays || false);

  const colors = [
    { label: "Indigo", value: "bg-primary/10 text-primary border-primary/30" },
    { label: "Green", value: "bg-success/10 text-success border-success/30" },
    { label: "Amber", value: "bg-warning/10 text-warning border-warning/30" },
    { label: "Rose", value: "bg-destructive/10 text-destructive border-destructive/30" },
    { label: "Teal", value: "bg-info/10 text-info border-info/30" },
    { label: "Purple", value: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl animate-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-bold">{shift ? "Edit Shift" : "Create New Shift"}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-accent transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave({ name, type, start_time: start, end_time: end, break_minutes: breaks, color, work_on_holidays: workOnHolidays }); }} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="col-span-full">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Shift Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20" placeholder="e.g. Morning Shift" required />
            </div>
            
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20">
                <option value="fixed">Fixed</option>
                <option value="rotational">Rotational</option>
                <option value="open">Open (Flexi)</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Break (Min)</label>
              <input type="number" value={breaks} onChange={e => setBreaks(parseInt(e.target.value))} className="h-11 w-full rounded-xl border bg-background px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
            </div>

            {type !== "open" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Time</label>
                  <input type="time" value={start} onChange={e => setStart(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-4 text-sm font-medium" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">End Time</label>
                  <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-4 text-sm font-medium" required />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
            <div className="space-y-0.5">
              <label className="text-sm font-bold">Work on Holidays</label>
              <p className="text-[10px] text-muted-foreground">If enabled, this shift remains active even on public holidays.</p>
            </div>
            <button
              type="button"
              onClick={() => setWorkOnHolidays(!workOnHolidays)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                workOnHolidays ? "gradient-primary" : "bg-muted"
              )}
            >
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", workOnHolidays ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Palette className="h-3 w-3" /> Visual Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              {colors.map(c => (
                <button 
                  key={c.value} 
                  type="button" 
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-lg border text-[10px] font-bold transition-all",
                    c.value,
                    color === c.value ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-60 grayscale-[40%] hover:opacity-100 hover:grayscale-0"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border px-6 py-2.5 text-sm font-bold hover:bg-accent transition-colors">Cancel</button>
            <button type="submit" className="rounded-xl gradient-primary px-8 py-2.5 text-sm font-bold text-primary-foreground shadow-elegant hover:scale-[1.02] transition-transform">Save Shift</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignModal({ user, day, shifts, currentShiftId, onClose, onAssign }: { user: any; day: string; shifts: any[]; currentShiftId?: string; onClose: () => void; onAssign: (id: string | null) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl animate-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-bold">Assign Shift</h2>
            <p className="text-xs text-muted-foreground">{user.name} • <span className="capitalize">{day}</span></p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => onAssign(null)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border p-4 text-sm font-bold transition-all hover:bg-accent",
              !currentShiftId ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-dashed"
            )}
          >
            <span>Weekly OFF / No Shift</span>
            {!currentShiftId && <div className="h-2 w-2 rounded-full bg-primary" />}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed" /></div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-card px-2">Available Shifts</div>
          </div>

          <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
            {shifts.map(s => (
              <button
                key={s.id}
                onClick={() => onAssign(s.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border p-4 text-sm font-bold transition-all text-left",
                  s.color,
                  currentShiftId === s.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[0.98]" : "hover:scale-[1.02]"
                )}
              >
                <div>
                  <div>{s.name}</div>
                  <div className="text-[10px] opacity-70 font-medium">{s.start_time} – {s.end_time} ({s.type})</div>
                </div>
                {currentShiftId === s.id && <div className="h-2 w-2 rounded-full bg-current" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
