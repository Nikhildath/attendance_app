import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Calendar, Clock, FileText, BarChart3, Settings, Users, Shield,
  ChevronLeft, Wallet, CalendarRange, PartyPopper, Banknote, MapPinned, Zap, MessageSquare, Radar, Target
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/attendance", label: "Attendance", icon: Zap },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/leaves", label: "Leaves", icon: FileText },
  { to: "/comp-offs", label: "Comp Offs", icon: Clock },
  { to: "/shifts", label: "Shifts", icon: CalendarRange },
  { to: "/payroll", label: "Payroll", icon: Wallet },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const roleNav = [
  { to: "/team", label: "Team Management", icon: Users, roles: ["Manager", "Admin"] },
  { to: "/field-tracking", label: "Field Tracking", icon: MapPinned, roles: ["Manager", "Admin"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["Manager", "Admin"] },
  { to: "/admin", label: "Admin Console", icon: Shield, roles: ["Admin"] },
] as const;

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const isActive = (to: string) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border/70 bg-card/92 text-foreground transition-[width] duration-500 shadow-[20px_0_40px_-20px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-white/[0.03] dark:bg-[#050505] dark:text-white dark:shadow-[20px_0_40px_-20px_rgba(0,0,0,1)]",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      <div className="flex h-20 items-center gap-3 overflow-hidden border-b border-border/60 px-5 dark:border-white/[0.03]">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)] group transition-transform hover:scale-105 overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent animate-pulse" />
           <img src="/icon-192.png" alt="Attendly" className="h-8 w-8 relative z-10 object-contain" />
        </div>
        {!collapsed && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col leading-tight"
          >
            <span className="text-lg font-black tracking-tight text-foreground uppercase italic dark:text-white">
              Attendly<span className="text-primary">Pro</span>
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground">Enterprise v4.5</span>
          </motion.div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4 scrollbar-none relative z-10">
        {!collapsed && <div className="px-3 pb-2 pt-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Core</div>}
        {nav.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-all duration-300",
                active
                  ? "border border-primary/15 bg-primary/8 text-primary shadow-[0_10px_30px_-12px_rgba(var(--primary-rgb),0.28)] dark:border-white/[0.05] dark:bg-white/[0.03] dark:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)]"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground dark:hover:bg-white/[0.02] dark:hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                active ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted/80 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary dark:bg-white/5"
              )}>
                <Icon className="h-[18px] w-[18px] shrink-0" />
              </div>
              {!collapsed && <span className="truncate tracking-tight font-black uppercase text-xs">{item.label}</span>}
              {active && !collapsed && (
                <div className="ml-auto flex items-center gap-1">
                   <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                </div>
              )}
            </Link>
          );
        })}

        {!collapsed && <div className="px-3 pb-2 pt-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Management</div>}
        {roleNav.filter((item) => item.roles.includes(profile?.role || "Employee")).map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-all duration-300",
                active 
                  ? "border border-secondary/15 bg-secondary/10 text-secondary shadow-[0_10px_30px_-12px_rgba(234,88,12,0.22)] dark:border-white/[0.05] dark:bg-white/[0.03] dark:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)]" 
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground dark:hover:bg-white/[0.02] dark:hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                active ? "bg-secondary text-secondary-foreground shadow-glow" : "bg-muted/80 text-muted-foreground group-hover:bg-secondary/10 group-hover:text-secondary dark:bg-white/5"
              )}>
                <Icon className="h-[18px] w-[18px] shrink-0" />
              </div>
              {!collapsed && <span className="truncate tracking-tight font-black uppercase text-xs">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border/60 bg-background/55 p-4 dark:border-white/[0.03] dark:bg-black/20">
         <div className={cn(
           "flex items-center gap-3 rounded-2xl border border-border/60 bg-background/80 p-3 dark:border-white/[0.03] dark:bg-white/[0.02]",
           collapsed && "justify-center px-0"
         )}>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
               <Shield className="h-4 w-4 text-primary" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="truncate text-[10px] font-black uppercase tracking-wider text-foreground dark:text-white">{profile?.name}</span>
                <span className="truncate text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{profile?.role}</span>
              </div>
            )}
         </div>
      </div>

      <div className="bg-background/70 p-4 dark:bg-black/40">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/50 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-all hover:border-primary/20 hover:bg-accent hover:text-foreground active:scale-95 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-500", collapsed && "rotate-180")} />
          {!collapsed && <span>{isMobile ? "Close" : "Minimize"}</span>}
        </button>
      </div>
    </aside>
  );
}
