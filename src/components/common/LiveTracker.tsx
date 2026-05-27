/**
 * LiveTracker — Global background location tracker
 *
 * Lifecycle:
 *  1. Mounts once per session (rendered in __root.tsx).
 *  2. Polls/listens to the `attendance` table to know whether the user is
 *     currently checked in (isTracking = true) or checked out (false).
 *  3. When isTracking = true:
 *     – Native (Android): starts BackgroundTrackerService (custom Java, posts
 *       to /api/location every 15 s even when app is killed) AND uses
 *       BackgroundGeolocation.addWatcher foreground callback to emit via
 *       socket while the app is in the foreground.
 *     – Web: polls navigator.geolocation every 10 s and emits via socket.
 *  4. When isTracking = false: stops everything.
 */

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useBranch } from "@/lib/branch-context";
import { socketService } from "@/lib/socket-service";
import { SOCKET_URL, API_KEY } from "@/lib/config";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { getDeviceInfo } from "@/lib/device-info";
import {
  startBackgroundTracker,
  stopBackgroundTracker,
  requestBatteryOptimizationExemption,
} from "@/lib/background-tracker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Community background-geolocation plugin (foreground callback only on native) */
const BackgroundGeolocation = registerPlugin<any>("BackgroundGeolocation");

const TRACKING_INTERVAL_MS = 10_000; // web polling interval
const BATTERY_PROMPT_KEY   = "battery_opt_prompted";

type BatteryManagerLike = { level: number };

export function LiveTracker() {
  const { profile }          = useAuth();
  const { current: branch }  = useBranch();
  const [isTracking, setIsTracking]           = useState(false);
  const [showBatteryDialog, setShowBatteryDialog] = useState(false);

  // refs so effects can read the latest values without re-running
  const intervalRef    = useRef<number | null>(null);
  const watcherIdRef   = useRef<string | null>(null);
  const deviceInfoRef  = useRef<string>("");
  const isActiveRef    = useRef(false); // guards stale callbacks after cleanup

  // ── 1. Determine whether the user is currently checked in ──────────────────
  useEffect(() => {
    if (!profile?.id) return;

    let canceled = false;

    const checkStatus = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("attendance")
        .select("id, check_out")
        .eq("user_id", profile.id)
        .gte("check_in", today.toISOString())
        .order("check_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[LiveTracker] Error checking attendance:", error.message);
      }

      if (!canceled) {
        setIsTracking(!!(data && !data.check_out));
      }
    };

    checkStatus();

    // Grab device info once
    getDeviceInfo().then((info) => {
      deviceInfoRef.current = `${info.model} | ${info.os} ${info.osVersion}`;
    });

    // Realtime listener — fires on INSERT (check-in) or UPDATE (check-out)
    const channel = supabase
      .channel(`attendance_tracker_${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          if (canceled) return;
          const rec = payload.new as any;
          // For DELETE payload.new is empty — treat as checked out
          if (!rec || !rec.id) {
            setIsTracking(false);
          } else {
            setIsTracking(!rec.check_out);
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[LiveTracker] Realtime channel error — polling fallback");
          // Fallback: poll every 30 s if realtime fails
          const fallback = window.setInterval(checkStatus, 30_000);
          return () => window.clearInterval(fallback);
        }
      });

    return () => {
      canceled = true;
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // ── 2. Start / stop location tracking when isTracking changes ──────────────
  useEffect(() => {
    if (!profile?.id || !isTracking) return;

    isActiveRef.current = true;

    // ── helpers ────────────────────────────────────────────────────────────

    const getBatteryLevel = async (): Promise<number> => {
      const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
      if (!nav.getBattery) return 0;
      try {
        const b = await nav.getBattery();
        return Math.round(b.level * 100);
      } catch {
        return 0;
      }
    };

    /** Emit one location update via the socket connection. */
    const sendLocationUpdate = (coords?: {
      latitude: number;
      longitude: number;
      speed?: number;
      accuracy?: number;
    }) => {
      if (!isActiveRef.current) return;

      let lat = coords?.latitude;
      let lng = coords?.longitude;
      const hasGps = typeof lat === "number" && typeof lng === "number";

      if (!hasGps) {
        if (branch?.lat && branch?.lng) {
          lat = branch.lat;
          lng = branch.lng;
        } else {
          lat = 12.9716;
          lng = 77.5946;
        }
      }

      getBatteryLevel().then((battery) => {
        if (!isActiveRef.current) return;
        socketService.updateLocation({
          userId: profile.id,
          lat: lat ?? 0,
          lng: lng ?? 0,
          battery,
          speed:    coords?.speed    ?? 0,
          accuracy: coords?.accuracy ?? 0,
          task: `${profile.role} - ${hasGps ? "GPS Active" : "Using Branch Location"}`,
          status:     "active",
          deviceInfo: deviceInfoRef.current,
        });
      });
    };

    // ── web tracking (browser / fallback) ──────────────────────────────────

    const startWebTracking = () => {
      const poll = () => {
        if (!isActiveRef.current) return;
        if (!("geolocation" in navigator)) {
          sendLocationUpdate();
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isActiveRef.current) return;
            sendLocationUpdate({
              latitude:  pos.coords.latitude,
              longitude: pos.coords.longitude,
              speed:     pos.coords.speed    ?? 0,
              accuracy:  pos.coords.accuracy ?? 0,
            });
          },
          (err) => {
            console.warn("[LiveTracker] GPS unavailable, using fallback:", err.message);
            sendLocationUpdate();
          },
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
      };

      poll(); // immediate first update
      intervalRef.current = window.setInterval(poll, TRACKING_INTERVAL_MS);
    };

    // ── native tracking (Android) ──────────────────────────────────────────

    const startNativeTracking = async () => {
      try {
        /**
         * addWatcher provides a JS callback while the app is in the FOREGROUND.
         * We deliberately do NOT pass a `url` here because the community plugin
         * sends {latitude, longitude} but not `userId` in the body — the server
         * would reject it. Background HTTP posting is handled exclusively by
         * BackgroundTrackerService (our Java foreground service).
         */
        const watcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: "Attendly tracking active. Location sent every 30 s until checkout.",
            backgroundTitle:   "Attendly Tracking",
            requestPermissions: true,
            stale: false,
            distanceFilter: 0,
          },
          (location: any, error: any) => {
            if (!isActiveRef.current) return;
            if (error) {
              console.error("[LiveTracker] BackgroundGeolocation error:", error.code, error.message);
              return;
            }
            if (location) {
              sendLocationUpdate({
                latitude:  location.latitude,
                longitude: location.longitude,
                speed:     location.speed    ?? 0,
                accuracy:  location.accuracy ?? 0,
              });
            }
          }
        );
        watcherIdRef.current = watcherId;
        console.log("[LiveTracker] BackgroundGeolocation watcher started:", watcherId);
      } catch (err) {
        console.error("[LiveTracker] Failed to start BackgroundGeolocation, using web fallback:", err);
        startWebTracking();
      }
    };

    // ── kick off ───────────────────────────────────────────────────────────

    if (Capacitor.isNativePlatform()) {
      startNativeTracking();

      // Our custom Java foreground service handles background / killed-app HTTP posts
      startBackgroundTracker({
        userId:    profile.id,
        apiKey:    API_KEY,
        serverUrl: SOCKET_URL,
      });

      // Prompt to disable battery optimisation once
      if (!localStorage.getItem(BATTERY_PROMPT_KEY)) {
        setShowBatteryDialog(true);
      }
    } else {
      startWebTracking();
    }

    // ── cleanup when isTracking → false or component unmounts ──────────────
    return () => {
      isActiveRef.current = false;

      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (Capacitor.isNativePlatform()) {
        if (watcherIdRef.current) {
          BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current }).catch(
            (e: any) => console.warn("[LiveTracker] removeWatcher error:", e)
          );
          watcherIdRef.current = null;
        }
        stopBackgroundTracker();
      }

      console.log("[LiveTracker] Tracking stopped.");
    };
  }, [profile?.id, profile?.role, branch?.id, branch?.lat, branch?.lng, isTracking]);

  // ── UI: battery optimisation prompt ────────────────────────────────────────
  return (
    <AlertDialog open={showBatteryDialog} onOpenChange={setShowBatteryDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enable Reliable Background Tracking</AlertDialogTitle>
          <AlertDialogDescription>
            To keep your location updating while Attendly is minimised or the screen
            is off, please disable battery optimisation for the app on the next screen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => localStorage.setItem(BATTERY_PROMPT_KEY, "dismissed")}
          >
            Skip
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              localStorage.setItem(BATTERY_PROMPT_KEY, "opened");
              requestBatteryOptimizationExemption();
            }}
          >
            Open Settings
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
