import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Calendar, Clock, FileText, BarChart3, Settings, Users, Shield,
  ChevronLeft, Wallet, CalendarRange, PartyPopper, Banknote, MapPinned, Sparkles, MessageSquare
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/attendance", label: "Attendance", icon: Clock },
  { to: "/leaves", label: "Leaves", icon: FileText },
  { to: "/comp-offs", label: "Comp Offs", icon: Clock },
  { to: "/shifts", label: "Shifts", icon: CalendarRange },
  { to: "/payroll", label: "Payroll", icon: Wallet },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/chat", label: "Chat", icon: MessageSquare },
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
  const isAdmin = profile?.role === "Admin";
  const isActive = (to: string) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/5 bg-zinc-950 text-white transition-[width] duration-300",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-white/5 px-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30 font-black shadow-lg shadow-primary/10 transition-transform hover:scale-105 duration-300">
          <Sparkles className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-base font-black tracking-tight text-white">Attendly</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Platform</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4 scrollbar-none">
        {!collapsed && <div className="px-3 pb-2 pt-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Main Menu</div>}
        {nav.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
                active
                  ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "group-hover:text-primary transition-colors")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />}
            </Link>
          );
        })}

        {!collapsed && <div className="px-3 pb-2 pt-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Management</div>}
        {roleNav.filter((item) => item.roles.includes(profile?.role || "Employee")).map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
                active 
                  ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" 
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "group-hover:text-primary transition-colors")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
        
        {/* PWA Install Button */}
        <div id="pwa-install-button-container" className="hidden px-3 pt-4">
           <button 
             id="pwa-install-button"
             className="flex w-full items-center gap-3 rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-bold text-primary border border-primary/20 hover:bg-primary/20 transition-all"
           >
             <Clock className="h-[18px] w-[18px]" />
             {!collapsed && <span>Install App</span>}
           </button>
        </div>
      </nav>

      <div className="border-t border-white/5 p-4">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-zinc-400 transition-all hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")} />
          {!collapsed && <span>{isMobile ? "Close Menu" : "Collapse Menu"}</span>}
        </button>
        {!collapsed && (
          <div className="mt-2 text-center">
            <span className="text-[10px] font-medium text-zinc-600">v1.2.1-pwa-hotfix</span>
          </div>
        )}
      </div>
    </aside>
  );
}
