import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Camera, CalendarDays, User, LayoutGrid, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { PWAInstallPrompt } from "./PWAInstallPrompt";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.id) {
      const subscribeToPush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'BEl62i4nZ9AnWvV-uSQuvQ6S3vL3-uM5A3RzV-yN8U1C5pQ6F-MvM6Y-UvB9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9'
          });
          
          await supabase.from('push_subscriptions').upsert({
            user_id: profile.id,
            subscription: JSON.parse(JSON.stringify(subscription)),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id, subscription' });
        } catch (err) {
          console.warn('Push subscription failed:', err);
        }
      };
      subscribeToPush();
    }
  }, [profile?.id]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        <div className="absolute -top-[10%] -right-[5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[20%] -left-[10%] w-[30%] h-[30%] rounded-full bg-primary-glow/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[50%] h-[50%] rounded-full bg-primary/3 blur-[150px]" />
      </div>

      <div className={cn("hidden md:block relative z-40")}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0">
            <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
      <div className={cn("transition-[padding] duration-300 relative z-10 min-h-screen", collapsed ? "md:pl-[72px]" : "md:pl-64")}>
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="p-3 md:p-8 pb-24 md:pb-8 animate-in fade-in duration-700">
          {children}
        </main>
        <PWAInstallPrompt />
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-40 h-20 border-t border-border/20 bg-background/60 backdrop-blur-2xl md:hidden transition-all duration-500 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]",
        mobileOpen ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
      )}>
        <div className="grid h-full grid-cols-5 items-center px-2">
          <MobileNavLink to="/" icon={Home} label="Home" />
          <MobileNavLink to="/chat" icon={MessageSquare} label="Chat" />
          
          <div className="flex flex-col items-center justify-center -translate-y-6">
            <Link 
              to="/attendance" 
              className="group relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_15px_30px_-10px_rgba(var(--primary-rgb),0.5)] active:scale-90 transition-all border-[6px] border-background"
            >
              <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Camera className="h-7 w-7 relative z-10" />
            </Link>
          </div>

          <MobileNavLink to="/calendar" icon={CalendarDays} label="Plan" />
          <MobileNavLink to="/settings" icon={User} label="Me" />
        </div>
      </nav>
    </div>
  );
}

function MobileNavLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  const { location } = useRouterState();
  const active = location.pathname === to;

  return (
    <Link 
      to={to} 
      className={cn(
        "flex flex-col items-center gap-1.5 transition-all duration-300",
        active ? "text-primary scale-110" : "text-muted-foreground/60 hover:text-muted-foreground"
      )}
    >
      <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]")} />
      <span className={cn("text-[9px] font-black uppercase tracking-[0.15em]", active ? "opacity-100" : "opacity-60")}>{label}</span>
      {active && <div className="h-1 w-1 rounded-full bg-primary animate-in zoom-in duration-300" />}
    </Link>
  );
}
