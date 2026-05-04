import { useState, useEffect } from "react";
import { Sidebar } from "../layout/Sidebar";
import { Topbar } from "../layout/Topbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Zap, Calendar, Users, Settings, Bell, Search, Radar, Shield, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  useEffect(() => {
    setShowMobileMenu(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-[#020202] text-white selection:bg-primary selection:text-primary-foreground font-sans antialiased overflow-x-hidden">
      {/* Global Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
         <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
         <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px] animate-pulse" />
         <div className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[120px]" />
         <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100px_100px]" />
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
              className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md"
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
          "relative z-10 flex flex-1 flex-col transition-all duration-500 ease-in-out",
          !isMobile && (collapsed ? "pl-[72px]" : "pl-64")
        )}
      >
        <Topbar onMenu={() => setShowMobileMenu(true)} />
        <div className="flex-1 px-4 py-8 md:px-8 max-w-[1600px] mx-auto w-full pb-40 md:pb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* FLASHY Animated Mobile Navigation */}
      {isMobile && (
        <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md h-20 bg-[#0a0a0a]/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_25px_80px_-15px_rgba(var(--primary-rgb),0.3)] flex items-center justify-between px-3 overflow-visible group">
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
           <div className="relative -top-10 group/btn">
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
                 <div className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 bg-[#0a0a0a] border-2 border-primary/60 shadow-[0_0_40px_rgba(var(--primary-rgb),0.5)] group-active/btn:scale-90 group-hover/btn:border-primary">
                    {/* Inner HUD lines */}
                    <div className="absolute inset-2 rounded-full border border-white/5 animate-spin-slow" />
                    <Zap className="w-10 h-10 text-primary drop-shadow-[0_0_15px_var(--color-primary)] transition-transform duration-500 group-hover/btn:scale-110" />
                    
                    {/* Particle Dots */}
                    <div className="absolute top-2 right-4 w-1 h-1 rounded-full bg-primary shadow-glow animate-ping" />
                    <div className="absolute bottom-3 left-3 w-1 h-1 rounded-full bg-secondary shadow-glow animate-pulse" />
                 </div>
              </Link>
           </div>

           <MobileNavItem to="/team" icon={Users} active={location.pathname === "/team"} />
           <MobileNavItem to="/settings" icon={Settings} active={location.pathname === "/settings"} />
        </nav>
      )}
    </div>
  );
}

function MobileNavItem({ to, icon: Icon, active }: { to: string; icon: any; active: boolean }) {
  return (
    <Link to={to} className="relative flex-1 flex flex-col items-center justify-center h-full rounded-2xl transition-all duration-300 group/nav">
      <div className={cn(
        "relative p-3 rounded-2xl transition-all duration-500",
        active ? "text-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] scale-110" : "text-white/20 group-hover/nav:text-white/60"
      )}>
        <Icon className={cn("w-6 h-6", active && "drop-shadow-[0_0_10px_var(--color-primary)]")} />
        
        {/* Active Particle Effect */}
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
    </Link>
  );
}
