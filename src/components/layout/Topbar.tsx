import { Bell, Search, Moon, Sun, Menu, Building2, ChevronDown, LogOut, Radar, Zap, ShieldCheck } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Avatar2D } from "@/components/common/Avatar2D";
import { useBranch } from "@/lib/branch-context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { requestNotificationPermission } from "@/lib/push";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  priority?: number;
};

function formatNotificationTime(value?: string | null) {
  if (!value) return "Now";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { theme, toggle } = useTheme();
  const { current, setCurrent, all, loading: branchLoading } = useBranch();
  const [open, setOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  useEffect(() => {
    const fetchResults = async () => {
      if (search.length < 2) { setResults([]); return; }
      const { data } = await supabase.from("profiles").select("*").ilike("name", `%${search}%`).limit(5);
      setResults(data || []);
    };
    const timer = setTimeout(fetchResults, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setResults([]);
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) setNotificationOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    let alive = true;
    const loadNotifications = async () => {
      const next: NotificationItem[] = [];
      const today = new Date().toISOString().split("T")[0];
      const isAdminOrManager = profile.role === "Admin" || profile.role === "Manager";

      const [myLeaves, myAttendance, pendingLeaves, holidayToday] = await Promise.all([
        supabase.from("leaves").select("*").eq("user_id", profile.id).neq("status", "Pending").order("created_at", { ascending: false }).limit(3),
        supabase.from("attendance").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(1),
        isAdminOrManager ? supabase.from("leaves").select("id", { count: "exact", head: true }).eq("status", "Pending") : Promise.resolve({ count: 0 }),
        current?.id ? supabase.from("company_holidays").select("name").eq("date", today).or(`branch_id.is.null,branch_id.eq.${current.id}`).limit(1) : Promise.resolve({ data: [] }),
      ]);

      if (!profile.branch_id) next.push({ id: "br", title: "Setup Required", body: "No branch assigned to your profile.", time: "System", priority: 3 });
      if (pendingLeaves.count! > 0) next.push({ id: "pl", title: "Pending Approvals", body: `${pendingLeaves.count} leaves waiting.`, time: "Today", priority: 3 });
      
      if (alive) setNotifications(next.sort((a, b) => (b.priority || 0) - (a.priority || 0)).slice(0, 10));
    };
    loadNotifications();
    const id = setInterval(loadNotifications, 30000);
    return () => { alive = false; clearInterval(id); };
  }, [profile?.id, profile?.branch_id, current?.id]);

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center gap-4 px-8 bg-[#020202]/60 backdrop-blur-3xl border-b border-white/[0.03]">
      <Button variant="ghost" size="icon" className="md:hidden hover:bg-white/10" onClick={onMenu}>
        <Menu className="h-6 w-6" />
      </Button>

      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          disabled={branchLoading || !current}
          className="flex items-center gap-3 rounded-[1.25rem] border border-white/[0.05] bg-white/[0.02] px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all hover:bg-white/[0.05] shadow-2xl disabled:opacity-50 group"
        >
          <Building2 className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline italic">{branchLoading ? "Syncing..." : current?.name || "Global Hub"}</span>
          <ChevronDown className={cn("h-4 w-4 text-white/20 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-4 w-72 overflow-hidden rounded-[2rem] border border-white/[0.05] bg-[#0a0a0a]/95 backdrop-blur-3xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-300">
             <div className="p-4 border-b border-white/[0.03] bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Select Division</div>
             <div className="p-2 max-h-80 overflow-y-auto scrollbar-none">
                {all.map(b => (
                  <button key={b.id} onClick={() => { setCurrent(b.id); setOpen(false); }} className={cn("flex w-full items-center gap-4 p-3 rounded-2xl text-left hover:bg-white/[0.03] transition-colors group", b.id === current?.id && "bg-primary/10")}>
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-colors", b.id === current?.id ? "bg-primary text-primary-foreground shadow-glow" : "bg-white/5 text-white/20")}>
                       <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                       <p className="text-xs font-bold text-white uppercase tracking-tight">{b.name}</p>
                       <p className="text-[9px] font-black uppercase tracking-widest text-white/20">{b.city}</p>
                    </div>
                  </button>
                ))}
             </div>
          </div>
        )}
      </div>

      <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH GLOBAL DATA..."
          className="h-11 w-full rounded-2xl bg-white/[0.02] border border-white/[0.05] pl-11 pr-4 text-[10px] font-black uppercase tracking-widest outline-none transition-all focus:border-primary/40 focus:bg-white/[0.04]"
        />
        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-white/[0.05] bg-[#0a0a0a] shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
            {results.map(p => (
              <button key={p.id} onClick={() => { setSearch(""); setResults([]); navigate({ to: "/team", search: { q: p.name } as any }); }} className="flex w-full items-center gap-3 p-2 rounded-xl hover:bg-white/5">
                <Avatar2D name={p.name} size={32} src={p.avatar_url} />
                <span className="text-[10px] font-black uppercase tracking-tight text-white/80">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-full p-1 border border-white/[0.05]">
           <Button variant="ghost" size="icon" onClick={toggle} className="h-9 w-9 rounded-full hover:bg-white/10 text-white/40 hover:text-white">
             {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
           </Button>
           <div ref={notificationRef} className="relative">
             <Button variant="ghost" size="icon" onClick={() => setNotificationOpen(!notificationOpen)} className="h-9 w-9 rounded-full hover:bg-white/10 text-white/40 hover:text-white">
               <Bell className="h-4 w-4" />
               {notifications.length > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary shadow-glow animate-pulse" />}
             </Button>
             {notificationOpen && (
               <div className="absolute right-0 top-full mt-4 w-80 rounded-[2.5rem] border border-white/[0.05] bg-[#0a0a0a] shadow-2xl p-2 animate-in fade-in zoom-in-95 origin-top-right">
                  <div className="p-4 border-b border-white/[0.03] text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Live Intelligence</div>
                  <div className="p-2 space-y-1">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/10">No New Data</div>
                    ) : notifications.map(n => (
                      <div key={n.id} className="p-4 rounded-2xl hover:bg-white/[0.03] transition-all">
                        <p className="text-[11px] font-black uppercase text-white tracking-tight">{n.title}</p>
                        <p className="text-[9px] font-medium text-white/30 uppercase mt-1 leading-relaxed">{n.body}</p>
                      </div>
                    ))}
                  </div>
               </div>
             )}
           </div>
        </div>

        <div className="flex items-center gap-3 pl-2 border-l border-white/5">
           <div className="flex flex-col items-end leading-none">
              <span className="text-[10px] font-black tracking-tight text-white uppercase italic">{profile?.name || "Guest"}</span>
              <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-0.5">{profile?.role || "Visitor"}</span>
           </div>
           <div className="relative">
              <div className="absolute -inset-1 bg-primary/20 rounded-full blur-sm" />
              <Avatar2D name={profile?.name || "G"} size={36} src={profile?.avatar_url} />
           </div>
        </div>

        <Button onClick={signOut} variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-secondary/10 text-white/20 hover:text-secondary">
           <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
