import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useBranch } from "@/lib/branch-context";
import { StatusBadge } from "@/components/common/StatusBadge";
import { calculateDistance } from "@/lib/utils";
import {
  MapPin,
  Clock,
  History as HistoryIcon,
  Calendar,
  Radar,
  Zap,
  ZapOff,
  Fingerprint,
  ShieldCheck,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { Capacitor } from "@capacitor/core";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Attendly Pro" },
      { name: "description", content: "Secure neural verification and spatio-temporal synchronization." },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { profile } = useAuth();
  const { current: branch } = useBranch();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [state, setState] = useState<"idle" | "scanning" | "success">("idle");
  const [scanProgress, setScanProgress] = useState(0);

  // Biometric state
  const [biometryType, setBiometryType] = useState<string>("none");
  const [preferredBiometricMode, setPreferredBiometricMode] = useState<string>(() => {
    return localStorage.getItem("preferred_biometric_mode") || "fingerprint";
  });
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    const detectBiometrics = async () => {
      // Check if running on a native platform
      if (!Capacitor.isNativePlatform()) {
        setBioAvailable(false);
        return;
      }
      try {
        const avail = await NativeBiometric.isAvailable();
        setBioAvailable(avail.isAvailable);
        if (avail.isAvailable) {
          const bt = avail.biometryType;
          let typeStr = "unknown";
          if (bt === 1 || bt === "touch-id" || bt === "TouchID") typeStr = "fingerprint";
          else if (bt === 2 || bt === "face-id" || bt === "FaceID") typeStr = "face";
          else if (bt === 3 || bt === "fingerprint" || bt === "Fingerprint") typeStr = "fingerprint";
          else if (bt === 4 || bt === "face" || bt === "FaceAuthentication") typeStr = "face";
          else if (bt === 6 || bt === "multiple" || bt === "Multiple") typeStr = "multiple";
          setBiometryType(typeStr);
        }
      } catch (e) {
        console.warn("Could not check biometrics:", e);
        setBioAvailable(false);
      }
    };
    detectBiometrics();

    // Sync preferred mode from localStorage
    const stored = localStorage.getItem("preferred_biometric_mode") || "fingerprint";
    setPreferredBiometricMode(stored);
  }, []);

  const loadStatus = async () => {
    if (!profile?.id) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", profile.id)
      .gte("check_in", today.toISOString())
      .order("check_in", { ascending: false })
      .limit(1)
      .single();
    setAttendance(data);
  };

  const loadHistory = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", profile.id)
      .order("check_in", { ascending: false })
      .limit(5);
    setHistory(data || []);
  };

  const loadActiveShift = async () => {
    if (!profile?.id) return;
    const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
    const { data: sched } = await supabase
      .from("shift_schedule")
      .select("*")
      .eq("user_id", profile.id)
      .single();
    if (sched && sched[day]) {
      const { data: sh } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", sched[day])
        .single();
      setActiveShift(sh);
    }
  };

  useEffect(() => {
    loadStatus();
    loadHistory();
    loadActiveShift();
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation(pos),
        (err) => {
          console.warn("Location error:", err);
          toast.error("Location access required for verification");
        },
        { enableHighAccuracy: true }
      );
    }
  }, [profile?.id]);

  /**
   * CRITICAL: This function MUST return true before executePunch is called.
   * It uses the native biometric plugin on device, or blocks on web.
   */
  const verifyBiometric = async (): Promise<boolean> => {
    // On web/browser — biometrics not supported, block attendance
    if (!Capacitor.isNativePlatform()) {
      toast.error("Biometric verification is only available on the mobile app. Please use the Android app.");
      return false;
    }

    if (!bioAvailable) {
      toast.error("This device does not support biometric sensors.");
      return false;
    }

    if (!profile?.passkey_registered) {
      toast.error("Please register your biometrics first in Settings → Security.");
      return false;
    }

    const isFace = preferredBiometricMode === "face";

    try {
      await NativeBiometric.verifyIdentity({
        reason: "Verify your identity to mark attendance",
        title: isFace ? "Face Recognition" : "Fingerprint Verification",
        subtitle: "Attendly Pro — Identity Check",
        description: isFace
          ? "Look at the front camera to verify your identity"
          : "Place your registered finger on the sensor",
      });
      return true;
    } catch (err: any) {
      const code = err?.code ?? err?.message ?? "";
      if (String(code).includes("10") || String(code).includes("cancel") || String(code).toLowerCase().includes("user")) {
        toast.error("Verification cancelled. Please try again.");
      } else {
        toast.error("Biometric verification failed. Identity not confirmed.");
      }
      console.error("Biometric error:", err);
      return false;
    }
  };

  const executePunch = async () => {
    if (!profile?.id) return;
    setLoading(true);

    if (attendance?.id && !attendance.check_out) {
      const { error } = await supabase
        .from("attendance")
        .update({ check_out: new Date().toISOString() })
        .eq("id", attendance.id);
      if (!error) {
        toast.success("Checked out successfully");
        loadStatus();
        loadHistory();
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    let lat = location?.coords.latitude || null;
    let lng = location?.coords.longitude || null;

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, enableHighAccuracy: true })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      setLocation(pos);
    } catch {
      if (!lat) {
        toast.error("Location Required: Please enable GPS.");
        setLoading(false);
        return;
      }
    }

    if (branch && branch.lat && branch.lng) {
      const dist = calculateDistance(lat!, lng!, branch.lat, branch.lng);
      const radius = branch.radius_meters || 150;
      if (dist > radius) {
        toast.error(`Out of Range: You are ${Math.round(dist - radius)}m away from ${branch.name}.`);
        setLoading(false);
        return;
      }
    }

    let status = "present";
    if (activeShift && activeShift.start_time && activeShift.start_time !== "—") {
      const now = new Date();
      const [sH, sM] = activeShift.start_time.split(":").map(Number);
      const shiftStart = new Date(now);
      shiftStart.setHours(sH, sM, 0, 0);
      const thresholdMins = settings?.late_threshold_mins || 15;
      const lateTime = new Date(shiftStart.getTime() + thresholdMins * 60000);
      if (now > lateTime) status = "late";
    }

    const { error } = await supabase.from("attendance").insert([{
      user_id: profile.id,
      check_in: new Date().toISOString(),
      status,
      branch_id: branch?.id,
    }]);

    if (!error) {
      toast.success(status === "late" ? "Attendance Marked (Late)" : "Attendance Marked Successfully!");
      loadStatus();
      loadHistory();
    } else {
      toast.error(error.message);
    }
    setLoading(false);
  };

  /**
   * MAIN PUNCH HANDLER
   * Gate: biometric MUST succeed before executePunch is ever called.
   */
  const handlePunch = async () => {
    if (!profile || loading) return;

    // Step 1: Show scanning UI
    setState("scanning");
    setScanProgress(0);

    // Animate progress bar during biometric prompt
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 90) { clearInterval(interval); return 90; }
        return prev + 3;
      });
    }, 80);

    try {
      // Step 2: MANDATORY biometric verification — nothing proceeds without this
      const verified = await verifyBiometric();

      clearInterval(interval);

      if (!verified) {
        // Biometric failed or cancelled — abort completely, never call executePunch
        setScanProgress(0);
        setState("idle");
        return;
      }

      // Step 3: Only reached if biometric succeeded
      setScanProgress(100);
      await new Promise((res) => setTimeout(res, 400));

      // Step 4: Now safe to record attendance
      await executePunch();
    } finally {
      setState("idle");
      setScanProgress(0);
    }
  };

  const isPunchedIn = attendance && !attendance.check_out;
  const isFaceVerification = preferredBiometricMode === "face";

  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="space-y-8 md:space-y-10">
      <PageHeader
        title="Attendance"
        subtitle="Secure biometric verification required for all punch operations"
      />

      {/* Non-native warning banner */}
      {!isNative && (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">
            Biometric verification requires the Android app. Install the APK to use attendance punch.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-8 lg:gap-10">
          <div className="group relative overflow-hidden rounded-[2.75rem] border border-foreground/5 dark:border-white/[0.05] bg-foreground/[0.01] dark:bg-white/[0.01] p-5 shadow-2xl backdrop-blur-3xl md:rounded-[4rem] md:p-10">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute inset-0 bg-grid-pattern dark:bg-grid-pattern-dark bg-[size:40px_40px]" />
            </div>

            <div className="relative z-10 flex flex-col items-center gap-8 text-center md:gap-12">
              <div className="space-y-3">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter md:text-3xl">Neural Verification</h2>
                {profile?.passkey_registered ? (
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <ShieldCheck className="w-3 h-3" />
                    <span className="text-[8px] font-black uppercase tracking-widest">
                      {isFaceVerification ? "Face Recognition Active" : "Fingerprint Active"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-amber-500">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Biometrics Not Registered</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-8 md:gap-10">
                <div className="relative flex items-center justify-center">
                  {/* Radar Sweep */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-10 sm:-inset-16 md:-inset-20 rounded-full mix-blend-screen pointer-events-none text-primary opacity-30"
                    style={{ background: "conic-gradient(from 0deg, transparent 75%, currentColor 100%)" }}
                  />
                  {/* Outer Orbit */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-6 sm:-inset-12 md:-inset-16 border-2 border-primary/20 rounded-full border-dashed"
                  />
                  {/* Spinning Ring */}
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-3 sm:-inset-6 md:-inset-8 border-4 border-primary/40 border-t-transparent border-l-transparent rounded-full"
                  />
                  {/* Pulse */}
                  <div className="absolute -inset-2 bg-primary/20 rounded-full blur-2xl animate-pulse" />

                  <button
                    onClick={handlePunch}
                    disabled={loading || !!attendance?.check_out || !isNative}
                    className={cn(
                      "group relative flex flex-col items-center justify-center gap-2 rounded-full transition-all duration-500",
                      "z-10 h-44 w-44 border-4 sm:h-56 sm:w-56 md:h-80 md:w-80",
                      !isNative
                        ? "opacity-40 cursor-not-allowed bg-muted border-muted"
                        : isPunchedIn
                        ? "bg-secondary/10 border-secondary shadow-[0_0_50px_rgba(var(--secondary-rgb),0.2)]"
                        : "bg-card dark:bg-[#0a0a0a] border-primary/60 shadow-[0_0_80px_rgba(var(--primary-rgb),0.5)] group-active:scale-95 hover:border-primary"
                    )}
                  >
                    <div className="absolute inset-4 rounded-full border border-foreground/5 dark:border-white/5 animate-spin-slow pointer-events-none" />
                    <div className="absolute top-7 right-9 h-2 w-2 rounded-full bg-primary shadow-glow animate-ping sm:right-12 sm:top-8" />
                    <div className="absolute bottom-9 left-8 h-2 w-2 rounded-full bg-secondary shadow-glow animate-pulse sm:bottom-10 sm:left-10" />
                    <div className="absolute inset-2 rounded-full border border-foreground/5 dark:border-white/5 animate-spin-slow" />

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={isPunchedIn ? "out" : "in"}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center"
                      >
                        {isPunchedIn ? (
                          <ZapOff className="mb-2 h-14 w-14 text-secondary transition-transform duration-500 group-hover:scale-110 sm:h-20 sm:w-20" />
                        ) : isFaceVerification ? (
                          <Camera className="mb-2 h-16 w-16 animate-pulse text-primary drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)] transition-transform duration-500 group-hover:scale-110 sm:h-24 sm:w-24" />
                        ) : (
                          <Fingerprint className="mb-2 h-16 w-16 animate-pulse text-primary drop-shadow-[0_0_15px_var(--color-primary)] transition-transform duration-500 group-hover:scale-110 sm:h-24 sm:w-24" />
                        )}
                        <span className="text-base font-black uppercase tracking-[0.16em] sm:text-xl sm:tracking-[0.2em]">
                          {isPunchedIn ? "Check Out" : "Punch In"}
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-foreground/30 dark:text-white/30 mt-1">
                          {isFaceVerification ? "Face ID Required" : "Fingerprint Required"}
                        </span>
                      </motion.div>
                    </AnimatePresence>
                  </button>

                  {/* Scanning HUD Overlay */}
                  <AnimatePresence>
                    {state === "scanning" && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md rounded-full"
                      >
                        <div className="relative h-40 w-40 sm:h-48 sm:w-48">
                          <div className="absolute inset-0 border-2 border-primary/20 rounded-full" />
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 border-t-2 border-primary rounded-full"
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            {isFaceVerification ? (
                              <Camera className="h-14 w-14 animate-pulse text-primary sm:h-16 sm:w-16" />
                            ) : (
                              <Fingerprint className="h-14 w-14 animate-pulse text-primary sm:h-16 sm:w-16" />
                            )}
                            <span className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                              {scanProgress}%
                            </span>
                          </div>
                        </div>
                        <div className="mt-8 space-y-1 text-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/60">
                            {isFaceVerification ? "Awaiting Face Scan" : "Awaiting Fingerprint"}
                          </p>
                          <p className="text-[8px] font-bold uppercase tracking-widest text-primary/60">
                            Identity Verification In Progress
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Registration prompt */}
                {!profile?.passkey_registered && isNative && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-center max-w-sm z-20"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">
                      Register your biometrics in Settings → Security to enable attendance
                    </p>
                  </motion.div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
                <div className="flex flex-col items-center gap-1">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-foreground/30 dark:text-white/30">
                    {branch?.name || "Global Hub"}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Radar className="w-4 h-4 text-secondary" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-foreground/30 dark:text-white/30">
                    {location ? "Spatial Verified" : "Offline"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* History Panel */}
        <div className="flex min-w-0 flex-col gap-8 lg:gap-10">
          <div className="flex flex-1 flex-col gap-6 rounded-[2.5rem] border border-foreground/5 dark:border-white/[0.05] bg-card dark:bg-[#0a0a0a] p-5 shadow-2xl md:gap-8 md:rounded-[3rem] md:p-10">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                <HistoryIcon className="w-5 h-5 text-primary" /> Data History
              </h2>
              <Calendar className="w-5 h-5 text-foreground/20 dark:text-white/20" />
            </div>

            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="py-20 text-center opacity-10 flex flex-col items-center">
                  <Zap className="w-12 h-12 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">No Temporal Data</p>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="group flex flex-col gap-4 rounded-[1.5rem] border border-foreground/5 dark:border-white/[0.03] bg-foreground/[0.02] dark:bg-white/[0.02] p-4 transition-all hover:bg-foreground/[0.04] dark:hover:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase text-foreground dark:text-white tracking-tight">
                          {new Date(item.check_in).toLocaleDateString()}
                        </p>
                        <p className="text-[9px] font-bold text-foreground/30 dark:text-white/30 uppercase tracking-widest mt-1">
                          {new Date(item.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {item.check_out
                            ? ` → ${new Date(item.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : " · Cycle Active"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                ))
              )}
            </div>

            <Button
              onClick={async () => {
                if (!profile?.id) return;
                const { data } = await supabase
                  .from("attendance")
                  .select("*")
                  .eq("user_id", profile.id)
                  .order("check_in", { ascending: false });
                if (data) {
                  const csv = [
                    ["Check In", "Check Out", "Status", "Notes"],
                    ...data.map((r) => [r.check_in, r.check_out, r.status, r.notes]),
                  ]
                    .map((e) => e.join(","))
                    .join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.setAttribute("hidden", "");
                  a.setAttribute("href", url);
                  a.setAttribute("download", "attendance_history.csv");
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
              }}
              variant="ghost"
              className="mt-auto h-12 rounded-2xl border border-foreground/5 dark:border-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-foreground/20 dark:text-white/20 hover:text-foreground dark:hover:text-white hover:bg-foreground/5 dark:hover:bg-white/5 transition-all"
            >
              Export Temporal Archives
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
