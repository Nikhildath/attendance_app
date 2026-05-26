import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MapPin, MapPinned, Battery, Search, Radio, Activity, Pause, Power, Menu, X } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { socketService } from "@/lib/socket-service";
import type { StaffLocation } from "@/lib/socket-service";
import { Avatar2D } from "@/components/common/Avatar2D";

export const Route = createFileRoute("/field-tracking")({
  head: () => ({
    meta: [
      { title: "Field Staff Tracking — Attendly" },
      { name: "description", content: "Live geo-tracking of field staff with status, battery and current task." },
    ],
  }),
  component: FieldTrackingPage,
});

const OFFLINE_AFTER_MS = 90_000;

type FieldStaff = {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: "active" | "idle" | "offline";
  lat: number | null;
  lng: number | null;
  battery: number | null;
  task: string;
  speedKmh: number;
  lastUpdate: string;
  accuracy?: number;
  branch_id?: string | null;
  avatar_url?: string | null;
};

function FieldTrackingPage() {
  const { profile } = useAuth();
  const navigate = Route.useNavigate();
  const [selected, setSelected] = useState<FieldStaff | null>(null);

  useEffect(() => {
    if (profile && profile.role === "Employee") {
      navigate({ to: "/" });
    }
  }, [profile]);
  const [q, setQ] = useState("");
  const [staff, setStaff] = useState<FieldStaff[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [showMobileList, setShowMobileList] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const branchMarkersRef = useRef<Record<string, any>>({});
  const realtimeSubRef = useRef<any>(null);

  const getTrackingStatus = (tracking: any): FieldStaff["status"] => {
    if (!tracking?.last_update) return "offline";
    const ageMs = Date.now() - new Date(tracking.last_update).getTime();
    if (ageMs > OFFLINE_AFTER_MS) return "offline";
    return (tracking.status as FieldStaff["status"]) || "active";
  };

  const loadData = async () => {
    try {
      // Fetch branches for filter
      const { data: branchData } = await supabase.from("branches").select("id, name");
      if (branchData) setBranches(branchData);

      // Fetch profiles with branch_id
      const [{ data: profiles }, { data: tracking }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("staff_tracking").select("*"),
      ]);

      if (profiles) {
        const merged: FieldStaff[] = profiles.map(p => {
          const t = tracking?.find(tr => tr.user_id === p.id);
          return {
            id: p.id,
            name: p.name || "Unknown",
            initials: (p.name || "U").split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
            role: p.role,
            status: getTrackingStatus(t),
            lat: t?.lat ? Number(t.lat) : null,
            lng: t?.lng ? Number(t.lng) : null,
            battery: typeof t?.battery === "number" ? t.battery : null,
            task: t?.current_task || "No active task",
            speedKmh: Number(t?.speed_kmh || 0),
            lastUpdate: t?.last_update ? new Date(t.last_update).toLocaleTimeString() : "Never",
            accuracy: t?.accuracy || 0,
            branch_id: p.branch_id, // Store branch_id for filtering
            avatar_url: p.avatar_url
          } as any;
        });
        setStaff(merged);

        setSelected((prev) => {
          if (!prev) return merged[0] ?? null;
          return merged.find((item) => item.id === prev.id) ?? prev;
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile?.id) return;

    loadData();

    // Subscribe to Supabase realtime changes
    const channel = supabase.channel('tracking_changes_' + profile.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_tracking' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, () => loadData())
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));
    const refreshInterval = window.setInterval(loadData, 30_000);

    realtimeSubRef.current = channel;

    // Request staff locations from socket server to sync with active trackers
    socketService.requestStaffLocations();

    // Subscribe to Socket.io location updates
    const unsubLocation = socketService.onStaffLocationUpdate((data: StaffLocation) => {
      setStaff((prev) => {
        const exists = prev.some((s) => s.id === data.id);
        if (!exists) {
          const newStaff: FieldStaff = {
            id: data.id,
            name: data.name || "Unknown",
            initials: (data.name || "U").split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
            role: data.task?.replace(' - GPS Active', '').replace(' - Using Branch Location', '') || 'Field Staff',
            status: data.status,
            lat: data.lat,
            lng: data.lng,
            battery: data.battery,
            task: data.task,
            speedKmh: data.speed,
            lastUpdate: new Date(data.lastUpdate).toLocaleTimeString(),
            accuracy: data.accuracy,
          };
          return [...prev, newStaff];
        }
        return prev.map((s) =>
          s.id === data.id
            ? {
                ...s,
                lat: data.lat,
                lng: data.lng,
                battery: data.battery,
                speedKmh: data.speed,
                task: data.task,
                status: data.status,
                lastUpdate: new Date(data.lastUpdate).toLocaleTimeString(),
                accuracy: data.accuracy,
              }
            : s
        );
      });
    });

    const unsubLocations = socketService.onStaffLocations((data: StaffLocation[]) => {
      setStaff((prev) => {
        const updated = prev.map((s) => {
          const update = data.find((d) => d.id === s.id);
          if (!update) return s;
          return {
            ...s,
            lat: update.lat,
            lng: update.lng,
            battery: update.battery,
            speedKmh: update.speed,
            task: update.task,
            status: update.status,
            lastUpdate: new Date(update.lastUpdate).toLocaleTimeString(),
            accuracy: update.accuracy,
          };
        });
        const existingIds = new Set(prev.map((s) => s.id));
        const newStaff = data
          .filter((d) => !existingIds.has(d.id))
          .map((d): FieldStaff => ({
            id: d.id,
            name: d.name || "Unknown",
            initials: (d.name || "U").split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
            role: d.task?.replace(' - GPS Active', '').replace(' - Using Branch Location', '') || 'Field Staff',
            status: d.status,
            lat: d.lat,
            lng: d.lng,
            battery: d.battery,
            task: d.task,
            speedKmh: d.speed,
            lastUpdate: new Date(d.lastUpdate).toLocaleTimeString(),
            accuracy: d.accuracy,
          }));
        return [...updated, ...newStaff];
      });
    });

    const unsubStatus = socketService.onStatusChange((data) => {
      setStaff((prev) =>
        prev.map((s) =>
          s.id === data.userId ? { ...s, status: data.status } : s
        )
      );
    });

    const unsubConnected = socketService.onStaffConnected((data: any) => {
      setStaff((prev) => {
        if (prev.some((s) => s.id === data.id)) return prev;
        const newStaff: FieldStaff = {
          id: data.id,
          name: data.name || "Unknown",
          initials: (data.name || "U").split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          role: data.role || 'Field Staff',
          status: data.status || 'active',
          lat: data.lat,
          lng: data.lng,
          battery: data.battery ?? null,
          task: data.task || 'No active task',
          speedKmh: data.speed || 0,
          lastUpdate: new Date(data.lastUpdate).toLocaleTimeString(),
          accuracy: data.accuracy || 0,
          branch_id: data.branch_id,
        };
        return [...prev, newStaff];
      });
    });

    const unsubDisconnected = socketService.onStaffDisconnected((data) => {
      setStaff((prev) =>
        prev.map((s) =>
          s.id === data.userId ? { ...s, status: "offline" as const } : s
        )
      );
    });

    return () => {
      window.clearInterval(refreshInterval);
      setRealtimeConnected(false);
      if (realtimeSubRef.current) {
        supabase.removeChannel(realtimeSubRef.current);
        realtimeSubRef.current = null;
      }
      unsubLocation();
      unsubLocations();
      unsubStatus();
      unsubConnected();
      unsubDisconnected();
    };
  }, [profile?.id]);

  // Initialize Leaflet
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInstance.current) return;
    let canceled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (canceled || !mapRef.current) return;
      
      // Default to India view if no location yet
      const map = L.map(mapRef.current, { 
        zoomControl: true,
        attributionControl: true,
        fadeAnimation: true,
        markerZoomAnimation: true
      }).setView([20.5937, 78.9629], 5);
      
      // Voyager theme for better visibility of roads and names
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);
      mapInstance.current = map;
      
      // Try to center on user's current location
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((pos) => {
              if (mapInstance.current) {
                  mapInstance.current.setView([pos.coords.latitude, pos.coords.longitude], 12);
              }
          });
      }
    })();
    return () => { canceled = true; };
  }, []);

  const filtered = staff.filter((s) => {
    const matchesQuery = s.name.toLowerCase().includes(q.toLowerCase());
    const matchesBranch = selectedBranchId === "all" || (s as any).branch_id === selectedBranchId;
    return matchesQuery && matchesBranch;
  });

  // Update markers
  useEffect(() => {
    if (typeof window === "undefined" || !mapInstance.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const visibleIds = new Set(filtered.map((item) => item.id));

      Object.entries(markersRef.current).forEach(([id, marker]) => {
        if (!visibleIds.has(id)) {
          marker.remove();
          delete markersRef.current[id];
        }
      });

      filtered.forEach((s) => {
        if (s.lat === null || s.lng === null) return;
        const isActive = s.status === "active";
        const isIdle = s.status === "idle";
        const color = isActive ? "#16a34a" : isIdle ? "#eab308" : "#94a3b8";

        const html = `
          <div class="relative flex flex-col items-center group">
            ${isActive ? '<div class="absolute -top-1 -inset-x-1 h-10 w-10 animate-ping rounded-full bg-success/15"></div>' : ''}
            <div class="flex flex-col items-center transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1">
                <div style="background:${color};width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:white;border:2.5px solid white;z-index:10;position:relative;overflow:hidden;box-shadow:0 8px 16px -4px ${color}44;">
                    ${s.avatar_url ? `<img src="${s.avatar_url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" /><span style="display:none;">${s.initials}</span>` : s.initials}
                </div>
                <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid white;margin-top:-4px;z-index:5;"></div>
                <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:10px solid ${color};margin-top:-12px;z-index:6;"></div>
            </div>
            ${isActive ? `<span class="absolute top-0 right-0 h-3.5 w-3.5 rounded-full bg-success border-2 border-white z-20 shadow-sm" style="box-shadow: 0 0 8px ${color}"></span>` : ''}
          </div>
        `;
        const icon = L.divIcon({
          html,
          className: "",
          iconSize: [40, 50],
          iconAnchor: [20, 48]
        });

        const existing = markersRef.current[s.id];
        const popupContent = `
          <div class="overflow-hidden">
            <div class="px-4 py-3 border-b bg-muted/30">
              <div class="flex items-center gap-3">
                <div class="h-8 w-8 rounded-lg overflow-hidden border shadow-sm">
                  ${s.avatar_url ? `<img src="${s.avatar_url}" class="h-full w-full object-cover" />` : `<div class="h-full w-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">${s.initials}</div>`}
                </div>
                <div>
                  <div class="text-sm font-bold leading-none">${s.name}</div>
                  <div class="text-[10px] text-muted-foreground mt-1">${s.role}</div>
                </div>
              </div>
            </div>
            <div class="p-4 space-y-3">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <div class="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Status</div>
                  <div class="flex items-center gap-1.5">
                    <span class="h-2 w-2 rounded-full" style="background:${color}"></span>
                    <span class="text-[11px] font-bold" style="color:${color}">${s.status.toUpperCase()}</span>
                  </div>
                </div>
                <div class="space-y-1">
                  <div class="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Battery</div>
                  <div class="text-[11px] font-bold">${s.battery === null ? 'N/A' : `${s.battery}%`}</div>
                </div>
              </div>
              <div class="space-y-1">
                <div class="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Current Task</div>
                <div class="text-[11px] font-medium leading-relaxed">${s.task}</div>
              </div>
              <div class="pt-2 border-t flex items-center justify-between">
                <div class="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Last Update</div>
                <div class="text-[10px] font-medium">${s.lastUpdate}</div>
              </div>
            </div>
          </div>
        `;

        if (existing) {
          existing.setLatLng([s.lat, s.lng]);
          existing.setIcon(icon);
          existing.setPopupContent(popupContent);
        } else {
          const m = L.marker([s.lat, s.lng], { icon }).addTo(mapInstance.current);
          m.bindPopup(popupContent);
          m.on("click", () => {
            setSelected(s);
            if (s.lat !== null && s.lng !== null && mapInstance.current) {
              mapInstance.current.setView([s.lat, s.lng], 16, { animate: true });
            }
          });
          markersRef.current[s.id] = m;
        }
      });

      if (Object.keys(markersRef.current).length > 0 && mapInstance.current.getZoom() < 6) {
        const group = L.featureGroup(Object.values(markersRef.current));
        mapInstance.current.fitBounds(group.getBounds().pad(0.1));
      }
    })();
  }, [filtered]);

  useEffect(() => {
    if (typeof window === "undefined" || !mapInstance.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const visibleBranches = branches.filter((branch) => {
        if (selectedBranchId !== "all" && branch.id !== selectedBranchId) return false;
        return typeof branch.lat === "number" && typeof branch.lng === "number";
      });
      const visibleIds = new Set(visibleBranches.map((branch) => branch.id));

      Object.entries(branchMarkersRef.current).forEach(([id, marker]) => {
        if (!visibleIds.has(id)) {
          marker.remove();
          delete branchMarkersRef.current[id];
        }
      });

      visibleBranches.forEach((branch) => {
        const hasOverlappingStaff = filtered.some(
          (staffMember) =>
            staffMember.lat !== null &&
            staffMember.lng !== null &&
            Math.abs(staffMember.lat - Number(branch.lat)) < 0.00005 &&
            Math.abs(staffMember.lng - Number(branch.lng)) < 0.00005
        );
        const markerLat = hasOverlappingStaff ? Number(branch.lat) + 0.00018 : Number(branch.lat);
        const markerLng = hasOverlappingStaff ? Number(branch.lng) + 0.00018 : Number(branch.lng);
        const html = `
          <div class="relative flex flex-col items-center group">
            <div style="background:#0f172a;width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;border:3px solid white;box-shadow:0 10px 25px -5px rgba(15,23,42,0.3);font-size:12px;font-weight:900;letter-spacing:0.05em;transition:all 0.3s ease;" class="group-hover:scale-110 group-hover:-translate-y-1">
              HQ
            </div>
            <div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:12px solid white;margin-top:-3px;z-index:5;"></div>
            <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid #0f172a;margin-top:-13px;z-index:6;"></div>
          </div>
        `;
        const icon = L.divIcon({
          html,
          className: "",
          iconSize: [40, 50],
          iconAnchor: [20, 46],
        });

        const popupContent = `
          <div class="overflow-hidden min-w-[180px]">
            <div class="px-4 py-3 border-b bg-primary/5">
              <div class="text-sm font-bold">${branch.name}</div>
              <div class="text-[10px] text-muted-foreground mt-0.5">${branch.city || 'Headquarters'}, ${branch.country || 'India'}</div>
            </div>
            <div class="p-4 bg-card">
              <div class="flex items-center gap-2">
                <div class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
                <div class="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Active Branch</div>
              </div>
              <div class="mt-3 flex items-center justify-between text-[10px] border-t pt-2">
                <span class="text-muted-foreground">Staff Tracked:</span>
                <span class="font-bold">${staff.filter(s => s.branch_id === branch.id).length}</span>
              </div>
            </div>
          </div>
        `;

        const existing = branchMarkersRef.current[branch.id];
        if (existing) {
          existing.setLatLng([markerLat, markerLng]);
          existing.setPopupContent(popupContent);
          existing.setZIndexOffset(1200);
        } else {
          const marker = L.marker([markerLat, markerLng], { icon, zIndexOffset: 1200 }).addTo(mapInstance.current);
          marker.bindPopup(popupContent);
          branchMarkersRef.current[branch.id] = marker;
        }
      });
    })();
  }, [branches, selectedBranchId]);

  const counts = {
    active: filtered.filter((s) => s.status === "active").length,
    idle: filtered.filter((s) => s.status === "idle").length,
    offline: filtered.filter((s) => s.status === "offline").length,
  };

  return (
    <div>
      <PageHeader
        title="Live Field Tracking"
        subtitle="Track, locate and manage your field staff in real-time"
        actions={
            <div className="flex items-center gap-3">
                <select 
                    value={selectedBranchId} 
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="h-10 rounded-lg border bg-card px-3 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                    <option value="all">All Branches</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        {realtimeConnected && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
            <Radio className="h-4 w-4 animate-pulse" />
            <span className="font-medium">Supabase realtime active</span>
          </div>
        )}
        <button 
          onClick={() => {
              if ("geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                      mapInstance.current?.setView([pos.coords.latitude, pos.coords.longitude], 15);
                  });
              }
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-all shadow-sm"
        >
          <MapPin className="h-4 w-4" />
          Locate Me
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 md:grid-cols-4">
        <PillStat label="Active" value={counts.active} cls="bg-success/10 text-success border-success/30" />
        <PillStat label="Idle" value={counts.idle} cls="bg-warning/15 text-warning border-warning/40" />
        <PillStat label="Offline" value={counts.offline} cls="bg-muted text-muted-foreground border-border" />
        <PillStat 
          label="Supabase" 
          value={realtimeConnected ? 1 : 0} 
          cls={realtimeConnected ? "bg-info/10 text-info border-info/30" : "bg-warning/10 text-warning border-warning/30"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="relative overflow-hidden rounded-2xl border bg-white shadow-card">
          <div ref={mapRef} className="h-[400px] sm:h-[500px] lg:h-[620px] w-full transition-all duration-500" style={{ background: "#ebebeb" }} />
          
          {/* Overlay info */}
          <div className="absolute top-6 left-6 z-[1000]">
            <div className="glass rounded-xl border border-border/60 dark:border-white/40 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground/50 shadow-sm backdrop-blur-md">
              Field Monitoring
            </div>
          </div>
        </div>

        {/* Mobile toggle for staff list */}
        <button
          onClick={() => setShowMobileList((v) => !v)}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl lg:hidden"
        >
          {showMobileList ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className={cn(
          "rounded-xl border bg-card shadow-card",
          "max-lg:fixed max-lg:inset-x-4 max-lg:bottom-20 max-lg:z-40 max-lg:max-h-[50vh] max-lg:overflow-auto max-lg:rounded-2xl max-lg:border-2 max-lg:shadow-2xl max-lg:transition-all max-lg:duration-300",
          showMobileList ? "max-lg:opacity-100 max-lg:scale-100" : "max-lg:pointer-events-none max-lg:opacity-0 max-lg:scale-95"
        )}>
          <div className="border-b p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff…" className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm" />
            </div>
          </div>
          <ul className="max-h-[320px] overflow-y-auto lg:max-h-[492px]">
            {loading ? (
               <div className="p-10 text-center text-muted-foreground text-xs">Loading staff...</div>
            ) : filtered.length === 0 ? (
               <div className="p-10 text-center text-muted-foreground text-xs">No live staff data for this branch yet.</div>
            ) : filtered.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setSelected(s);
                    if (s.lat !== null && s.lng !== null && mapInstance.current) {
                      mapInstance.current.setView([s.lat, s.lng], 16, { animate: true });
                    }
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 border-b p-4 text-left transition-colors hover:bg-accent/40",
                    selected?.id === s.id && "bg-accent/60"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar2D 
                      name={s.name} 
                      src={s.avatar_url} 
                      size={40} 
                      className={cn(s.status === "active" ? "ring-2 ring-success ring-offset-1" : s.status === "idle" ? "ring-2 ring-warning ring-offset-1" : "")} 
                    />
                    {s.status === "active" && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-card animate-pulse z-10" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      <BatteryDot v={s.battery} />
                    </div>
                    <div className="text-xs text-muted-foreground">{s.role}</div>
                    <div className="mt-1 truncate text-xs text-foreground/70">{s.task}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {s.status === "active" ? <Activity className="h-3 w-3 text-success" /> : s.status === "idle" ? <Pause className="h-3 w-3 text-warning" /> : <Power className="h-3 w-3" />}
                      <span>{s.lastUpdate}</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PillStat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={cn("flex items-center justify-between rounded-xl border px-4 py-3", cls)}>
      <div className="flex items-center gap-2 text-sm font-semibold"><MapPinned className="h-4 w-4" />{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function BatteryDot({ v }: { v: number | null }) {
  if (v === null) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><Battery className="h-3 w-3" />N/A</span>;
  }
  const tone = v > 50 ? "text-success" : v > 20 ? "text-warning" : "text-destructive";
  return <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", tone)}><Battery className="h-3 w-3" />{v}%</span>;
}
