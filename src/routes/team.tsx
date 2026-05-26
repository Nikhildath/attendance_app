import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, X, Users, Search, Activity, Shield, Calendar, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar2D } from "@/components/common/Avatar2D";
import { StatusBadge, LeaveStatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/push";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/team")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      q: (search.q as string) || "",
    };
  },
  head: () => ({
    meta: [
      { title: "Team Overview — Attendly Pro" },
      { name: "description", content: "Manager view: team attendance and leave approvals." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { profile } = useAuth();
  const { q } = Route.useSearch();
  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    // Fetch profiles
    const { data: profs } = await supabase.from("profiles").select("*");
    
    // Fetch today's attendance for everyone
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: att } = await supabase
      .from("attendance")
      .select("*")
      .gte("check_in", todayStart.toISOString());

    if (profs) {
      const merged = profs.map(p => {
        const record = att?.find(a => a.user_id === p.id);
        return {
          ...p,
          checkIn: record?.check_in ? new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—",
          checkOut: record?.check_out ? new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—",
          // Map null or undefined status to "absent" if no check-in today, or use the recorded status
          currentStatus: record?.status || "absent"
        };
      });
      setMembers(merged);
    }

    // Fetch pending leave requests
    const { data: lvs } = await supabase
      .from("leaves")
      .select(`*, profiles(name)`)
      .eq("status", "Pending");
    
    if (lvs) setRequests(lvs);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const decide = async (id: string, status: "Approved" | "Rejected") => {
    const { error } = await supabase
      .from("leaves")
      .update({ status })
      .eq("id", id);
    
    if (!error) {
      toast.success(`Leave ${status}`);
      setRequests(rs => rs.map(r => r.id === id ? { ...r, status } : r));
      
      const request = requests.find(r => r.id === id);
      if (request?.user_id) {
        sendPushNotification(request.user_id, {
          title: `Leave ${status}`,
          body: `Your leave request for ${request.from_date} has been ${status.toLowerCase()}.`
        });
      }
    } else toast.error(error.message);
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Team Overview"
        subtitle="Operational insight into workforce activity and request management"
        actions={
          <div className="flex items-center gap-3 bg-muted/30 dark:bg-white/[0.03] backdrop-blur-3xl px-5 py-2.5 rounded-2xl border border-border/50 dark:border-white/[0.05] shadow-2xl">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-xl font-black italic tracking-tighter">{members.length}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Personnel</span>
          </div>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="p-8 rounded-[3rem] bg-muted/10 dark:bg-white/[0.01] backdrop-blur-3xl border border-border/30 dark:border-white/[0.03] shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-10 opacity-[0.02] -rotate-12 pointer-events-none">
               <Activity className="w-32 h-32" />
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                <Calendar className="w-6 h-6 text-primary" /> Today's Attendance
              </h2>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
                <input 
                  placeholder="FILTER PERSONNEL..."
                  className="w-full h-10 bg-muted/20 dark:bg-white/[0.02] border border-border/60 dark:border-white/5 rounded-xl pl-9 text-[10px] font-black uppercase tracking-widest focus:border-primary/40 outline-none"
                />
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 dark:bg-white/[0.03] text-left text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60 dark:text-white/40">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Check-In</th>
                    <th className="px-6 py-4">Check-Out</th>
                    <th className="px-6 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 dark:divide-white/[0.03]">
                  {loading ? (
                     <tr><td colSpan={5} className="py-20 text-center text-[10px] font-black uppercase tracking-widest text-foreground/30">Synchronizing Data...</td></tr>
                  ) : members.filter(m => !q || m.name.toLowerCase().includes(q.toLowerCase())).map((m) => (
                    <tr key={m.id} className="group hover:bg-muted/20 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="absolute -inset-1 bg-primary/10 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Avatar2D name={m.name} size={36} src={m.avatar_url} />
                          </div>
                          <div className="text-foreground dark:text-white">{m.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-foreground/50 dark:text-white/40">{m.role}</td>
                      <td className="px-6 py-4 font-black italic tabular-nums text-success text-xs">{m.checkIn}</td>
                      <td className="px-6 py-4 font-black italic tabular-nums text-secondary text-xs">{m.checkOut}</td>
                      <td className="px-6 py-4 text-right">
                        <StatusBadge status={m.currentStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {loading ? (
                <div className="py-20 text-center text-[10px] font-black uppercase tracking-widest text-foreground/30">Synchronizing Data...</div>
              ) : members.filter(m => !q || m.name.toLowerCase().includes(q.toLowerCase())).map((m) => (
                <div key={m.id} className="p-6 rounded-3xl bg-muted/20 dark:bg-white/[0.02] border border-border/30 dark:border-white/[0.03] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar2D name={m.name} size={44} src={m.avatar_url} />
                      <div>
                        <h4 className="font-bold text-sm tracking-tight">{m.name}</h4>
                        <p className="text-[9px] font-black uppercase tracking-widest text-foreground/50 dark:text-white/40">{m.role}</p>
                      </div>
                    </div>
                    <StatusBadge status={m.currentStatus} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/60 dark:border-white/5">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-foreground/50 dark:text-white/30">Check-In</p>
                      <p className="text-xs font-black italic text-success mt-1 tabular-nums">{m.checkIn}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-foreground/50 dark:text-white/30">Check-Out</p>
                      <p className="text-xs font-black italic text-secondary mt-1 tabular-nums">{m.checkOut}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="p-10 rounded-[3rem] bg-card dark:bg-[#0a0a0a] border border-border/50 dark:border-white/[0.05] shadow-2xl flex flex-col gap-8 h-full relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="flex flex-col gap-2 relative z-10">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter">Leave Requests</h2>
              <p className="text-[9px] font-black text-foreground/50 dark:text-white/30 uppercase tracking-[0.3em]">Pending operational authorization</p>
            </div>

            <div className="space-y-4 relative z-10">
              {requests.length === 0 ? (
                 <div className="py-20 text-center opacity-10 flex flex-col items-center">
                    <Shield className="w-12 h-12 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">Clear Protocol</p>
                 </div>
              ) : requests.map((r) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={r.id} 
                  className="p-6 rounded-[2rem] bg-muted/20 dark:bg-white/[0.02] border border-border/30 dark:border-white/[0.03] hover:bg-muted/30 dark:hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-sm text-foreground">{r.profiles?.name}</div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-primary mt-1">{r.type} · {r.days} Days</div>
                      <div className="mt-3 text-xs text-foreground/60 dark:text-white/50 leading-relaxed italic">"{r.reason}"</div>
                    </div>
                    <LeaveStatusBadge status={r.status} />
                  </div>
                  {r.status === "Pending" && (
                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={() => decide(r.id, "Approved")}
                        className="flex-1 h-10 rounded-xl bg-success text-success-foreground text-[10px] font-black uppercase tracking-widest shadow-glow active:scale-95 transition-all"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decide(r.id, "Rejected")}
                        className="flex-1 h-10 rounded-xl bg-muted/30 dark:bg-white/5 border border-border/60 dark:border-white/5 text-muted-foreground dark:text-white/40 text-[10px] font-black uppercase tracking-widest hover:bg-secondary/20 hover:text-secondary hover:border-secondary/20 active:scale-95 transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <button className="mt-auto group flex items-center justify-center gap-4 p-5 rounded-[2rem] bg-muted/20 dark:bg-white/[0.02] border border-border/50 dark:border-white/[0.05] text-foreground/50 dark:text-white/30 font-black uppercase tracking-[0.3em] text-[10px] hover:bg-primary/5 hover:text-primary transition-all">
              Manage Archives <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
