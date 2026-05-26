import { useState, useEffect } from "react";
import { Sidebar } from "../layout/Sidebar";
import { Topbar } from "../layout/Topbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { LayoutDashboard, Zap, Calendar, Users, Settings, Bell, Search, Radar, Shield, Sparkles, Grid3X3, Clock, FileText, BarChart3, MapPinned, MessageSquare, CalendarRange, Wallet, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";

const extraMobileNav = [
  { to: "/leaves", label: "Leaves", icon: FileText },
  { to: "/comp-offs", label: "Comp Offs", icon: Clock },
  { to: "/shifts", label: "Shifts", icon: CalendarRange },
  { to: "/payroll", label: "Payroll", icon: Wallet },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/field-tracking", label: "Field Tracking", icon: MapPinned, roles: ["Manager", "Admin"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["Manager", "Admin"] },
  { to: "/admin", label: "Admin Console", icon: Shield, roles: ["Admin"] },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMoreNav, setShowMoreNav] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const router = useRouter();
  const { profile } = useAuth();

  useEffect(() => {
    setShowMobileMenu(false);
    setShowMoreNav(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen overflow-x-clip bg-background text-foreground selection:bg-primary selection:text-primary-foreground font-sans antialiased">
      {/* Global Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.88)_0%,rgba(235,244,255,0.94)_42%,rgba(223,232,243,0.98)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
         <div className="absolute inset-0 opacity-[0.03] mix-blend-soft-light dark:opacity-[0.02] dark:mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
         <div className="absolute top-[10%] left-[20%] h-[320px] w-[320px] rounded-full bg-primary/10 blur-[120px] animate-pulse dark:bg-primary/5 md:h-[500px] md:w-[500px] md:blur-[150px]" />
         <div className="absolute bottom-[10%] right-[20%] h-[260px] w-[260px] rounded-full bg-secondary/10 blur-[100px] dark:bg-secondary/5 md:h-[400px] md:w-[400px] md:blur-[120px]" />
         <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:100px_100px] dark:bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)]" />
      </div>

      {!isMobile && (
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      )}

      <AnimatePresence>
        {isMobile && showMobileMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMenu(false)}
              className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-md dark:bg-black/80"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-72"
            >
              <Sidebar collapsed={false} onToggle={() => setShowMobileMenu(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main
        className={cn(
          "relative z-10 flex min-w-0 flex-1 flex-col transition-all duration-500 ease-in-out",
          !isMobile && (collapsed ? "pl-[72px]" : "pl-64")
        )}
      >
        <Topbar onMenu={() => setShowMobileMenu(true)} />
        <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-1 px-3 py-5 pb-[10rem] md:px-8 md:py-8 md:pb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="min-w-0 flex-1"
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* FLASHY Animated Mobile Navigation */}
      {isMobile && (
        <nav className="group fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex h-[4.6rem] w-[calc(100%-1rem)] max-w-md -translate-x-1/2 items-center justify-between overflow-visible rounded-[2rem] border border-border/70 bg-card/88 px-2 shadow-[0_25px_80px_-15px_rgba(15,23,42,0.18)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#0a0a0a]/60 dark:shadow-[0_25px_80px_-15px_rgba(var(--primary-rgb),0.3)] sm:bottom-6 sm:h-20 sm:w-[92%] sm:px-3">
           {/* Animated Scanning Beam */}
           <motion.div 
             animate={{ x: [-150, 150, -150] }}
             transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
             className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent skew-x-12 pointer-events-none"
           />
           
           {/* Center Aura Glow */}
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-primary to-transparent blur-md opacity-50" />

           <MobileNavItem to="/" icon={LayoutDashboard} active={location.pathname === "/"} />
           <MobileNavItem to="/calendar" icon={Calendar} active={location.pathname === "/calendar"} />
           
           {/* HYPER-ANIMATED Action Button */}
           <div className="group/btn relative -top-7 sm:-top-10">
              {/* Outer Orbit */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-8 border border-primary/20 rounded-full border-dashed"
              />
              
              {/* Spinning Ring */}
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-4 border-2 border-primary/40 border-t-transparent border-l-transparent rounded-full"
              />
              
              {/* Pulse Waves */}
              <div className="absolute -inset-2 bg-primary/20 rounded-full blur-xl animate-pulse" />

              <Link to="/attendance" className="relative flex items-center justify-center">
                 <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/50 bg-background shadow-[0_0_40px_rgba(var(--primary-rgb),0.18)] transition-all duration-300 group-active/btn:scale-90 group-hover/btn:border-primary dark:border-primary/60 dark:bg-[#0a0a0a] dark:shadow-[0_0_40px_rgba(var(--primary-rgb),0.5)] sm:h-20 sm:w-20">
                    {/* Inner HUD lines */}
                    <div className="absolute inset-2 rounded-full border border-white/5 animate-spin-slow" />
                    <Zap className="h-8 w-8 text-primary drop-shadow-[0_0_15px_var(--color-primary)] transition-transform duration-500 group-hover/btn:scale-110 sm:h-10 sm:w-10" />
                    
                    {/* Particle Dots */}
                    <div className="absolute top-2 right-4 w-1 h-1 rounded-full bg-primary shadow-glow animate-ping" />
                    <div className="absolute bottom-3 left-3 w-1 h-1 rounded-full bg-secondary shadow-glow animate-pulse" />
                 </div>
              </Link>
           </div>

           <MobileNavItem to="/team" icon={Users} active={location.pathname === "/team"} />
           <MobileNavItem onClick={() => setShowMoreNav(true)} icon={Grid3X3} active={showMoreNav} />
        </nav>
      )}

      {/* Mobile More Navigation Sheet */}
      {isMobile && (
        <AnimatePresence>
          {showMoreNav && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMoreNav(false)}
                className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-md dark:bg-black/80"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed inset-x-4 bottom-24 z-50 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#0a0a0a]/95"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">More</span>
                  <button onClick={() => setShowMoreNav(false)} className="rounded-full p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {extraMobileNav
                    .filter((item) => !("roles" in item) || (item as any).roles.includes(profile?.role || "Employee"))
                    .map((item) => {
                      const Icon = item.icon;
                      const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
                      return (
                        <button
                          key={item.to}
                          onClick={() => {
                            setShowMoreNav(false);
                            setTimeout(() => router.navigate({ to: item.to }), 0);
                          }}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all cursor-pointer",
                            active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                            active ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted/80"
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-wider text-center leading-tight">{item.label}</span>
                        </button>
                      );
                    })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function MobileNavItem({ to, onClick, icon: Icon, active }: { to?: string; onClick?: () => void; icon: any; active: boolean }) {
  const inner = (
    <>
      <div className={cn(
        "relative rounded-2xl p-2.5 transition-all duration-500 sm:p-3",
        active ? "text-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary-rgb),0.12)] scale-110" : "text-muted-foreground group-hover/nav:text-foreground/70 dark:text-white/20 dark:group-hover/nav:text-white/60"
      )}>
        <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", active && "drop-shadow-[0_0_10px_var(--color-primary)]")} />
        
        {active && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -top-1 -right-1"
          >
             <Sparkles className="w-3 h-3 text-primary animate-pulse" />
          </motion.div>
        )}
      </div>
      
      {active && (
        <motion.div 
          layoutId="nav-glow"
          className="absolute -bottom-2 w-8 h-1 bg-primary rounded-full blur-sm opacity-50 shadow-glow" 
        />
      )}
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="group/nav relative flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded-2xl transition-all duration-300">
        {inner}
      </button>
    );
  }

  return (
    <Link to={to!} className="group/nav relative flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded-2xl transition-all duration-300">
      {inner}
    </Link>
  );
}
