import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className={cn(
      "fixed bottom-24 left-4 right-4 z-[100] md:bottom-8 md:left-auto md:right-8 md:w-80 animate-in slide-in-from-bottom-10 fade-in duration-500"
    )}>
      <div className="relative overflow-hidden rounded-2xl bg-primary p-4 shadow-2xl shadow-primary/40 border border-white/20">
        {/* Background Glow */}
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Download className="h-6 w-6 text-white" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-bold text-white leading-tight">Install Attendly Pro</h3>
            <p className="mt-1 text-xs text-white/80 line-clamp-2">
              Add to your home screen for the best experience and real-time tracking.
            </p>
            
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="rounded-lg bg-white px-4 py-1.5 text-xs font-bold text-primary hover:bg-white/90 active:scale-95 transition-all"
              >
                Install Now
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
              >
                Maybe Later
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => setShowPrompt(false)}
            className="shrink-0 rounded-full p-1 text-white/60 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
