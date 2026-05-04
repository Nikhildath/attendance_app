import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Calendar, Clock, FileText, BarChart3, Settings, Users, Shield,
  ChevronLeft, Wallet, CalendarRange, PartyPopper, Banknote, MapPinned, Zap, MessageSquare, Radar, Target, Sparkles
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
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/[0.03] bg-[#050505] text-white transition-[width] duration-500 shadow-[20px_0_40px_-20px_rgba(0,0,0,1)]",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      <div className="flex h-20 items-center gap-3 border-b border-white/[0.03] px-5 overflow-hidden">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)] group transition-transform hover:scale-105">
           <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent animate-pulse" />
           <Sparkles className="h-5 w-5 relative z-10" />
        </div>
        {!collapsed && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col leading-tight"
          >
            <span className="text-lg font-black tracking-tight text-white uppercase italic">
              Attendly<span className="text-primary">Pro</span>
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30">Enterprise v4.5</span>
          </motion.div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4 scrollbar-none relative z-10">
        {!collapsed && <div className="px-3 pb-2 pt-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700/50">Core</div>}
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
                  ? "bg-white/[0.03] text-primary border border-white/[0.05] shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)]"
                  : "text-zinc-500 hover:bg-white/[0.02] hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                active ? "bg-primary text-primary-foreground shadow-glow" : "bg-white/5 text-zinc-500 group-hover:text-primary group-hover:bg-primary/10"
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

        {!collapsed && <div className="px-3 pb-2 pt-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700/50">Management</div>}
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
                  ? "bg-white/[0.03] text-secondary border border-white/[0.05] shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)]" 
                  : "text-zinc-500 hover:bg-white/[0.02] hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                active ? "bg-secondary text-secondary-foreground shadow-glow" : "bg-white/5 text-zinc-500 group-hover:text-secondary group-hover:bg-secondary/10"
              )}>
                <Icon className="h-[18px] w-[18px] shrink-0" />
              </div>
              {!collapsed && <span className="truncate tracking-tight font-black uppercase text-xs">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4 border-t border-white/[0.03] bg-black/20">
         <div className={cn(
           "flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.03]",
           collapsed && "justify-center px-0"
         )}>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
               <Shield className="h-4 w-4 text-primary" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-white truncate">{profile?.name}</span>
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest truncate">{profile?.role}</span>
              </div>
            )}
         </div>
      </div>

      <div className="p-4 bg-black/40">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-600 transition-all hover:bg-white/10 hover:text-white hover:border-primary/20 active:scale-95"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-500", collapsed && "rotate-180")} />
          {!collapsed && <span>{isMobile ? "Close" : "Minimize"}</span>}
        </button>
      </div>
    </aside>
  );
}
