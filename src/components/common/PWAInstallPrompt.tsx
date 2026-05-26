import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [manualInstall, setManualInstall] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem("pwa-prompt-dismissed") === "true";
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);

    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      if (!isDismissed) {
        setShowPrompt(true);
      }
      
      // Show sidebar button
      const sidebarBtn = document.getElementById("pwa-install-button-container");
      if (sidebarBtn) sidebarBtn.classList.remove("hidden");
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(standalone);
    if (standalone) {
      setShowPrompt(false);
      setManualInstall(false);
      const sidebarBtn = document.getElementById("pwa-install-button-container");
      if (sidebarBtn) sidebarBtn.classList.add("hidden");
    }

    const fallbackTimer = window.setTimeout(() => {
      if (!standalone && !deferredPrompt && isIos && isSafari && !isDismissed) {
        setManualInstall(true);
        setShowPrompt(true);
      }
    }, 1500);

    // Attach to sidebar button if it exists
    const handleSidebarInstall = () => handleInstall();
    const sidebarBtn = document.getElementById("pwa-install-button");
    if (sidebarBtn) sidebarBtn.addEventListener("click", handleSidebarInstall);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("beforeinstallprompt", handler);
      if (sidebarBtn) sidebarBtn.removeEventListener("click", handleSidebarInstall);
    };
  }, [deferredPrompt]);

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
    const sidebarBtn = document.getElementById("pwa-install-button-container");
    if (sidebarBtn) sidebarBtn.classList.add("hidden");
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className={cn(
      "animate-in slide-in-from-bottom-10 fade-in duration-500 fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[100] md:bottom-8 md:left-auto md:right-8 md:w-80"
    )}>
      <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-[linear-gradient(145deg,rgba(14,165,233,0.96),rgba(37,99,235,0.92))] p-4 text-white shadow-2xl shadow-primary/30 backdrop-blur-xl pointer-events-auto">
        {/* Background Glow */}
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.12))] pointer-events-none" />
        
        <div className="relative z-10 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/18 backdrop-blur-sm ring-1 ring-white/20">
            <Download className="h-6 w-6 text-white" />
          </div>
          
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70">
              {manualInstall ? "Add To Home" : "PWA Ready"}
            </p>
            <h3 className="mt-1 font-black leading-tight">
              {manualInstall ? "Install from your browser menu" : "Install Attendly Pro"}
            </h3>
            <p className="mt-1 text-xs text-white/85 line-clamp-2">
              {manualInstall
                ? "On iPhone or iPad, open the browser share menu and tap Add to Home Screen."
                : "Add it to your home screen for a faster full-screen experience with app-style navigation."}
            </p>
            
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!manualInstall && (
                <button
                  onClick={handleInstall}
                  className="rounded-xl bg-white px-4 py-2 text-xs font-black text-primary shadow-lg transition-all hover:bg-white/95 active:scale-95"
                >
                  Install App
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20"
              >
                {manualInstall ? "Got It" : "Maybe Later"}
              </button>
            </div>
          </div>
          
          <button 
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1 text-white/60 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
