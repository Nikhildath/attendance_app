import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useBranch } from "@/lib/branch-context";
import { socketService } from "@/lib/socket-service";
import { Capacitor, registerPlugin } from "@capacitor/core";

const BackgroundGeolocation = registerPlugin<any>("BackgroundGeolocation");

const TRACKING_INTERVAL_MS = 30_000;

type BatteryManagerLike = {
  level: number;
};

export function LiveTracker() {
  const { profile } = useAuth();
  const { current: branch } = useBranch();
  const intervalRef = useRef<number | null>(null);
  const watcherIdRef = useRef<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;

    const checkStatus = async () => {
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
      
      setIsTracking(data && !data.check_out);
    };
    
    checkStatus();

    const channel = supabase
      .channel('attendance_tracking_status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const newRecord = payload.new as any;
          if (newRecord && !newRecord.check_out) {
            setIsTracking(true);
          } else {
            setIsTracking(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || !isTracking) return;

    let isActive = true;

    const getBatteryLevel = async () => {
      const batteryApi = (navigator as Navigator & {
        getBattery?: () => Promise<BatteryManagerLike>;
      }).getBattery;

      if (!batteryApi) return null;

      try {
        const battery = await batteryApi.call(navigator);
        return Math.round(battery.level * 100);
      } catch (error) {
        console.warn("Battery API unavailable:", error);
        return null;
      }
    };

    const sendLocationUpdate = (coords?: { latitude: number; longitude: number; speed?: number; accuracy?: number }) => {
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

      getBatteryLevel().then((batteryLevel) => {
        socketService.updateLocation({
          userId: profile.id,
          lat: lat ?? 0,
          lng: lng ?? 0,
          battery: batteryLevel ?? 0,
          speed: coords?.speed ?? 0,
          accuracy: coords?.accuracy ?? 0,
          task: `${profile.role} - ${hasGps ? "GPS Active" : "Using Branch Location"}`,
          status: "active",
        });
      });
    };

    const startWebTracking = () => {
      const captureAndSyncLocation = () => {
        if (!("geolocation" in navigator)) {
          sendLocationUpdate();
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isActive) return;
            sendLocationUpdate({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              speed: pos.coords.speed || 0,
              accuracy: pos.coords.accuracy || 0,
            });
          },
          (err) => {
            console.warn("Location unavailable, using fallback location:", err.message);
            sendLocationUpdate();
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      };

      captureAndSyncLocation();
      intervalRef.current = window.setInterval(captureAndSyncLocation, TRACKING_INTERVAL_MS);
    };

    const startNativeTracking = async () => {
      try {
        const watcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: "App is tracking your location in the background.",
            backgroundTitle: "Tracking active",
            requestPermissions: true,
            stale: false,
            distanceFilter: 0,
          },
          (location: any, error: any) => {
            if (!isActive) return;
            if (error) {
              console.error("Background geolocation error:", error);
              return;
            }
            if (location) {
              sendLocationUpdate({
                latitude: location.latitude,
                longitude: location.longitude,
                speed: location.speed || 0,
                accuracy: location.accuracy || 0,
              });
            }
          }
        );
        watcherIdRef.current = watcherId;
      } catch (err) {
        console.error("Failed to start native background tracking:", err);
        // Fallback to web tracking if plugin fails
        startWebTracking();
      }
    };

    if (Capacitor.isNativePlatform()) {
      startNativeTracking();
    } else {
      startWebTracking();
    }

    return () => {
      isActive = false;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (watcherIdRef.current && Capacitor.isNativePlatform()) {
        BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current }).catch(console.error);
        watcherIdRef.current = null;
      }
    };
  }, [profile?.id, profile?.role, branch?.id, branch?.lat, branch?.lng, profile?.email, profile?.name, isTracking]);

  return null;
}
