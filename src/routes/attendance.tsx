import { useEffect, useRef, useState } from "react";
import { exportToCSV } from "@/lib/csv-utils";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, CheckCircle2, Loader2, MapPin, Clock, ShieldCheck, AlertTriangle, ScanFace, PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useBranch } from "@/lib/branch-context";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Mark Attendance — Attendly" },
      { name: "description", content: "Face-recognition attendance with geo-fence verification and recent timeline." },
    ],
  }),
  component: AttendancePage,
});

type State = "idle" | "camera" | "scanning" | "success" | "error";
type GeoState = "unknown" | "checking" | "inside" | "outside" | "denied";

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(d);

// Haversine in meters
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(sa));
}

// Helper functions for WebAuthn Base64URL handling
function base64ToBuffer(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function AttendancePage() {
  const { current, loading: branchLoading } = useBranch();
  const { profile, refreshProfile, user } = useAuth();
  const { settings } = useSettings();
  const [state, setState] = useState<State>("idle");
  const [now, setNow] = useState<string>("");
  const [markedAt, setMarkedAt] = useState<string>("");
  const [geo, setGeo] = useState<GeoState>("unknown");
  const [distance, setDistance] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [punchMode, setPunchMode] = useState<"web" | "mobile">("web");
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [isHoliday, setIsHoliday] = useState<any>(null);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  
  // Liveness & Multi-Descriptor State
  const [livenessChallenge, setLivenessChallenge] = useState<string | null>(null);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [registrationSamples, setRegistrationSamples] = useState<number[][]>([]);
  const [registrationStep, setRegistrationStep] = useState(0); // 0-5 steps
  const [challengeMsg, setChallengeMsg] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [detectionActive, setDetectionActive] = useState(false);
  const [lastSimilarity, setLastSimilarity] = useState<number>(0);
  const matchCounter = useRef<number>(0);
  const hasPunchedThisSession = useRef<boolean>(false);

  const loadRecent = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (data) {
      setRecentRecords(data);
      // Find latest record for today (guard against null check_in)
      const today = new Date().toISOString().split('T')[0];
      const latestToday = data.find(r => r.check_in && r.check_in.startsWith(today));
      setTodayRecord(latestToday || null);
      
      if (latestToday) {
        setMarkedAt(fmtTime(new Date(latestToday.check_in)));
        setState("success");
      }
    }
  };

  useEffect(() => {
    const nowInIndia = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    setNow(fmtTime(nowInIndia));
    const id = setInterval(() => {
      const currentIndia = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      setNow(fmtTime(currentIndia));
    }, 30_000);
    loadRecent();
    return () => clearInterval(id);
  }, [profile]);

  useEffect(() => {
    if (!current?.id) return;
    async function checkHoliday() {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from("company_holidays")
        .select("*")
        .eq("date", today)
        .or(`branch_id.is.null,branch_id.eq.${current.id}`);
      
      if (data && data.length > 0) setIsHoliday(data[0]);
      else setIsHoliday(null);
    }
    checkHoliday();
  }, [current]);

  useEffect(() => {
    if (current?.id) {
        checkGeo();
    }
  }, [current?.id]);

  useEffect(() => {
    if ((state === "camera" || state === "scanning") && videoRef.current && canvasRef.current) {
        setDetectionActive(true);
    } else {
        setDetectionActive(false);
        // Clear canvas when not active
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }
  }, [state]);

  useEffect(() => {
    let animId: number;
    let faceMod: any = null;

    const runDetection = async () => {
        if (!detectionActive || !videoRef.current || !canvasRef.current) return;
        
        if (!faceMod) {
            faceMod = await import("@/lib/face-recognition");
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Sync canvas size with video display size
        if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
            canvas.width = video.clientWidth;
            canvas.height = video.clientHeight;
        }

        const result = await faceMod.detectFace(video);
        
        // Continuous similarity update for the bar
        if ((state === "camera" || state === "scanning") && (profile as any)?.face_descriptor) {
            // Run this asynchronously to not block the mesh too much
            faceMod.getFaceDescriptor(video).then((desc: any) => {
                if (desc) {
                    const storedDescriptors = (profile as any)?.face_descriptor;
                    if (storedDescriptors) {
                        const { isMatch, similarity } = faceMod.compareFaces(desc, storedDescriptors);
                        const score = Math.round(similarity * 100);
                        setLastSimilarity(score);

                        // Auto-punch if identity is confirmed and stable (5 frames)
                        if (isMatch && state === "scanning" && !hasPunchedThisSession.current) {
                            matchCounter.current++;
                            if (matchCounter.current >= 5) {
                                console.log("Auto-Punch: Identity Confirmed (Paranoid Consensus).");
                                hasPunchedThisSession.current = true;
                                saveAttendance();
                            }
                        } else {
                            matchCounter.current = 0;
                        }
                    }
                }
            }).catch(() => {});
        }

        const faceapi = faceMod.faceapi;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background grid (movie effect)
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 40) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for (let i = 0; i < canvas.height; i += 40) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }

        // Global scanning line
        const globalScanY = (Date.now() / 15) % canvas.height;
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
        ctx.beginPath();
        ctx.moveTo(0, globalScanY);
        ctx.lineTo(canvas.width, globalScanY);
        ctx.stroke();

        if (result) {
            const dims = faceapi.matchDimensions(canvas, video, true);
            const resized = faceapi.resizeResults(result, dims);
            
            // Draw Movie-style Mesh with Pulse
            const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;
            ctx.strokeStyle = `rgba(0, 242, 254, ${pulse})`; 
            ctx.lineWidth = 1;
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00f2fe';

            const landmarks = resized.landmarks;
            const pts = landmarks.positions;

            // Connect landmark points for a mesh effect
            const drawPath = (indices: number[], close = false) => {
                ctx.beginPath();
                ctx.moveTo(pts[indices[0]].x, pts[indices[0]].y);
                for (let i = 1; i < indices.length; i++) {
                    ctx.lineTo(pts[indices[i]].x, pts[indices[i]].y);
                }
                if (close) ctx.closePath();
                ctx.stroke();
            };

            // Enhanced Mesh - Connect more points for "movie" feel
            drawPath(Array.from({length: 17}, (_, i) => i)); // Jaw
            drawPath([17, 18, 19, 20, 21]); // L-Brow
            drawPath([22, 23, 24, 25, 26]); // R-Brow
            drawPath([27, 28, 29, 30, 33, 30]); // Nose bridge
            drawPath([31, 32, 33, 34, 35]); // Nose bottom
            drawPath([36, 37, 38, 39, 40, 41], true); // L-Eye
            drawPath([42, 43, 44, 45, 46, 47], true); // R-Eye
            drawPath(Array.from({length: 12}, (_, i) => 48 + i), true); // Lip-Outer
            drawPath(Array.from({length: 8}, (_, i) => 60 + i), true); // Lip-Inner
            
            // Connecting brows to nose bridge
            ctx.beginPath(); ctx.moveTo(pts[21].x, pts[21].y); ctx.lineTo(pts[27].x, pts[27].y); ctx.lineTo(pts[22].x, pts[22].y); ctx.stroke();

            // Add futuristic scanning points
            ctx.fillStyle = '#00f2fe';
            ctx.shadowBlur = 15;
            [30, 36, 45, 48, 54, 8, 0, 16, 21, 22].forEach(idx => {
                ctx.beginPath();
                ctx.arc(pts[idx].x, pts[idx].y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            });

            // Draw bounding box corners with "lock-on" effect
            const box = resized.detection.box;
            const cornerSize = 25;
            const offset = Math.sin(Date.now() / 150) * 5; // Subtle bounce
            
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#00f2fe';
            ctx.shadowBlur = 0;
            
            // Top Left
            ctx.beginPath();
            ctx.moveTo(box.x - offset, box.y + cornerSize - offset); ctx.lineTo(box.x - offset, box.y - offset); ctx.lineTo(box.x + cornerSize - offset, box.y - offset);
            ctx.stroke();
            // Top Right
            ctx.beginPath();
            ctx.moveTo(box.x + box.width + offset - cornerSize, box.y - offset); ctx.lineTo(box.x + box.width + offset, box.y - offset); ctx.lineTo(box.x + box.width + offset, box.y + cornerSize - offset);
            ctx.stroke();
            // Bottom Left
            ctx.beginPath();
            ctx.moveTo(box.x - offset, box.y + box.height + offset - cornerSize); ctx.lineTo(box.x - offset, box.y + box.height + offset); ctx.lineTo(box.x + cornerSize - offset, box.y + box.height + offset);
            ctx.stroke();
            // Bottom Right
            ctx.beginPath();
            ctx.moveTo(box.x + box.width + offset - cornerSize, box.y + box.height + offset); ctx.lineTo(box.x + box.width + offset, box.y + box.height + offset); ctx.lineTo(box.x + box.width + offset, box.y + box.height + offset - cornerSize);
            ctx.stroke();

            // "Movie-style" Data Overlay
            ctx.fillStyle = '#00f2fe';
            ctx.font = 'bold 8px monospace';
            ctx.shadowBlur = 5;
            
            const randomID = (Date.now() % 1000000).toString(16).toUpperCase();
            const confidence = (resized.detection.score * 100).toFixed(1);
            
            ctx.fillText(`BIOMETRIC_ID: ${randomID}`, box.x + box.width + 10, box.y + 10);
            ctx.fillText(`CONFIDENCE: ${confidence}%`, box.x + box.width + 10, box.y + 25);
            ctx.fillText(`COORD_X: ${box.x.toFixed(0)}`, box.x + box.width + 10, box.y + 40);
            ctx.fillText(`COORD_Y: ${box.y.toFixed(0)}`, box.x + box.width + 10, box.y + 55);
            ctx.fillText(`STATUS: ANALYZING`, box.x + box.width + 10, box.y + 70);

            // Draw scanning line within the face box
            const scanY = (Date.now() / 8) % box.height;
            const gradient = ctx.createLinearGradient(box.x, box.y + scanY - 5, box.x, box.y + scanY);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(1, 'rgba(0, 242, 254, 0.4)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(box.x, box.y + scanY - 10, box.width, 10);
            
            ctx.strokeStyle = 'rgba(0, 242, 254, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + scanY); ctx.lineTo(box.x + box.width, box.y + scanY);
            ctx.stroke();

            // Primary Status Text
            ctx.fillStyle = '#00f2fe';
            ctx.font = 'black 10px Inter, sans-serif';
            ctx.fillText('• FACE_DETECTED_SYNC_ACTIVE', box.x, box.y - 12);
        }

        animId = requestAnimationFrame(runDetection);
    };

    if (detectionActive) {
        animId = requestAnimationFrame(runDetection);
    }
    
    return () => cancelAnimationFrame(animId);
  }, [detectionActive]);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function checkGeo(): Promise<boolean> {
    if (!current || !current.lat || !current.lng) return true; // Skip if no branch coords
    if (!navigator.geolocation) { setGeo("denied"); setErrorMsg("Geolocation not supported"); return false; }
    
    setGeo("checking");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const d = distanceMeters(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            { lat: Number(current.lat), lng: Number(current.lng) }
          );
          setDistance(Math.round(d));
          if (d <= (current.radius_meters || 150)) { setGeo("inside"); resolve(true); }
          else { setGeo("outside"); resolve(false); }
        },
        () => { setGeo("denied"); setErrorMsg("Location access denied."); resolve(false); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  const handleExportRecent = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    
    if (data) {
      exportToCSV(data, `attendance_history_${profile.name.replace(/\s+/g, '_')}`);
    }
  };

  async function startCamera() {
    setErrorMsg("");
    setState("camera");
    
    // Don't restart if already active and streaming
    if (streamRef.current && videoRef.current && !videoRef.current.paused) {
        return;
    }

    try {
      stopCamera(); // Ensure clean state
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Handle play promise to avoid interruption errors
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (error.name !== "AbortError") console.error("Camera play failed:", error);
            });
        }
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setErrorMsg("Camera permission denied. Simulating face scan...");
      setState("scanning");
      saveAttendance();
    }
  }

  const saveAttendance = async () => {
    setState("scanning");
    const timestamp = new Date();
    
    let lat = 0;
    let lng = 0;
    let saveError: any = null;

    // Try to get precise location for the record
    try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
    } catch (e) {
        console.warn("Could not get precise location for record, using 0,0");
    }

    // --- SHIFT-BASED ATTENDANCE LOGIC ---
    // Step 1: Fetch user's shift for today to determine work_on_holidays
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = days[timestamp.getDay()];
    let userShift: any = null;
    let shiftWorksOnHolidays = false;

    if (profile?.id) {
      const { data: schedule } = await supabase
        .from('shift_schedule')
        .select(`*, ${dayName}(start_time, end_time, type, work_on_holidays)`)
        .eq('user_id', profile.id)
        .maybeSingle();

      userShift = (schedule as any)?.[dayName] ?? null;
      shiftWorksOnHolidays = userShift?.work_on_holidays === true;
    }

    // Step 2: Determine status — shift has PRIORITY over holidays
    // If shift requires working on holidays, treat today as a normal workday
    let status: string;
    if (isHoliday && !shiftWorksOnHolidays) {
      // True holiday off-day: employee is not expected to work
      status = "holiday";
    } else {
      // Normal workday (either no holiday, or shift requires working on holidays)
      status = "present";

      // Check for late arrival
      if (userShift && userShift.start_time && userShift.type !== 'open') {
        const [sHour, sMin] = userShift.start_time.split(':').map(Number);
        const shiftStart = new Date(timestamp);
        shiftStart.setHours(sHour, sMin, 0, 0);
        const threshold = settings?.late_threshold_mins || 15;
        const lateTime = new Date(shiftStart.getTime() + threshold * 60000);
        if (timestamp > lateTime) {
          status = "late";
        }
      }
    }
    
    if (todayRecord) {
      // Perform Check-Out
      const { error } = await supabase
        .from("attendance")
        .update({
          check_out: timestamp.toISOString(),
          notes: (todayRecord.notes || "") + (geo === "outside" ? " Checked out outside geo-fence." : "")
        })
        .eq("id", todayRecord.id);
      saveError = error;
      if (error) {
        toast.error("Check-out failed: " + error.message);
      } else {
        toast.success("Checked out successfully!");
      }
    } else {
      // Perform Check-In
      const { error } = await supabase.from("attendance").insert([{
        user_id: profile?.id,
        branch_id: current?.id || null,
        status: status,
        check_in: timestamp.toISOString(),
        location_lat: lat,
        location_lng: lng,
        notes: (geo === "outside" ? "Marked outside geo-fence. " : "") + (isHoliday ? `Marked on ${isHoliday.name}` : "")
      }]);
      saveError = error;
      if (error) {
        toast.error("Check-in failed: " + error.message);
      } else {
        toast.success("Checked in successfully!");
      }
    }

    loadRecent();

    setTimeout(() => {
      stopCamera();
      if (saveError) {
        // Error already toasted above, just reset state
        setState("idle");
      } else {
        setMarkedAt(fmtTime(timestamp));
        setState("success");
        loadRecent();
      }
    }, 1500);
  };

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);

  useEffect(() => {
    import("@/lib/face-recognition").then((mod) => {
      mod.loadModels()
        .then(() => {
            console.log("Attendance: Models loaded");
            setModelsLoaded(true);
        })
        .catch(err => {
            console.error("Attendance: Models failed to load", err);
            toast.error("Face recognition module failed to start.", {
              description: "Please check your internet connection or ensure model files are available in /public/models.",
              duration: 5000
            });
        });
    });
  }, []);

  async function registerFace() {
    if (!modelsLoaded) return toast.info("Face recognition models are loading, please wait...");
    setErrorMsg("");
    setRegistrationSamples([]);
    setRegistrationStep(0);
    
    try {
      if (!streamRef.current) await startCamera();
      await new Promise(res => setTimeout(res, 800));
      
      toast.info("Registering face... Please look directly at the camera", { duration: 5000 });
      const { getFaceDescriptor } = await import("@/lib/face-recognition");
      
      const allSamples: number[][] = [];
      const totalSamplesNeeded = 15;
      
      for (let i = 0; i < totalSamplesNeeded; i++) {
        setRegistrationStep(Math.round(((i + 1) / totalSamplesNeeded) * 100));
        const desc = await getFaceDescriptor(videoRef.current!);
        if (desc) allSamples.push(Array.from(desc));
        await new Promise(res => setTimeout(res, 250));
      }

      if (allSamples.length >= 5) {
        console.log(`Captured ${allSamples.length} samples. Storing...`);
        const targetId = profile?.id || user?.id;
        if (!targetId) throw new Error("User ID not found.");

        const { data: success, error } = await supabase
          .rpc('update_own_face', {
            p_id: targetId,
            p_descriptor: allSamples
          });
        
        if (error) throw error;
        toast.success("Face registered successfully!");
        await refreshProfile();
      } else {
        toast.error("Could not capture enough face samples. Please ensure your face is clear.");
      }
    } catch (err: any) {
      toast.error("Registration failed: " + err.message);
    } finally {
      setRegistrationStep(0);
      stopCamera();
      setState("idle");
    }
  }

  async function verifyAndPunch() {
    setState("scanning");
    
    try {
      const { getFaceDescriptor, compareFaces } = await import("@/lib/face-recognition");
      
      // Directly capture and match (No liveness)
      let liveDescriptor = null;
      for (let i = 0; i < 10; i++) {
        liveDescriptor = await getFaceDescriptor(videoRef.current!);
        if (liveDescriptor) break;
        await new Promise(res => setTimeout(res, 300));
      }
      
      if (!liveDescriptor) {
        toast.error("No face detected. Please position your face clearly.");
        setState("camera");
        return;
      }

      const storedDescriptors = (profile as any)?.face_descriptor;
      if (!storedDescriptors) {
          toast.error("Face data missing. Please re-register.");
          setState("idle");
          return;
      }

      const { isMatch, similarity } = compareFaces(liveDescriptor, storedDescriptors);
      const matchPercent = Math.round(similarity * 100);
      setLastSimilarity(matchPercent);

      if (isMatch) {
        console.log(`Verification SUCCESS: ${matchPercent}% similarity`);
        saveAttendance();
      } else {
        toast.error(`Verification failed. Match: ${matchPercent}%`);
        setState("camera");
      }
    } catch (err: any) {
      toast.error("Verification error: " + err.message);
      setState("camera");
    }
  }

  async function registerBiometrics() {
    if (!profile?.id) return;
    setState("scanning");
    try {
      if (!window.PublicKeyCredential) {
        throw new Error("Biometric hardware not detected on this device.");
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Attendly Pro", id: window.location.hostname },
          user: {
            id: Uint8Array.from((profile.id || user.id).replace(/-/g, ''), c => c.charCodeAt(0)),
            name: profile.email || user.email || "user",
            displayName: profile.name || "User"
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          authenticatorSelection: { 
            userVerification: "required",
            residentKey: "preferred"
          },
          timeout: 60000
        }
      });

      if (credential) {
        console.log("Biometric registration success, credential ID:", (credential as any).id);
        const { error } = await supabase
          .from("profiles")
          .update({ 
            biometric_registered: true,
            biometric_credential_id: (credential as any).id
          })
          .eq("id", profile.id);

        if (error) {
          console.error("Failed to update profile with biometrics:", error);
          throw error;
        }
        
        // Force refresh multiple times to ensure state is caught up
        await refreshProfile();
        setTimeout(() => refreshProfile(), 500);
        setTimeout(() => refreshProfile(), 1500);
        
        toast.success("Biometrics registered successfully!");
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      toast.error(err.message || "Biometric registration failed.");
    } finally {
      setState("idle");
    }
  }

  async function mark() {
    if (!current) return toast.error("Please select a branch first");
    setErrorMsg("");
    
    const ok = await checkGeo();
    if (geo === "denied") return;
    if (!ok) {
       toast.warning(`Outside geo-fence (${distance}m). Record will be flagged.`);
    }

    if (punchMode === "mobile") {
      if (!(profile as any)?.biometric_registered) {
        toast.info("Please register your biometrics first.");
        return;
      }

      setState("scanning");
      try {
        if (window.PublicKeyCredential) {
          const credential = await navigator.credentials.get({
            publicKey: {
              challenge: Uint8Array.from("secure-punch", c => c.charCodeAt(0)),
              allowCredentials: [{
                id: base64ToBuffer((profile as any).biometric_credential_id || ""),
                type: 'public-key'
              }],
              userVerification: "required"
            }
          });
          
          if (!credential) {
            throw new Error("Biometric verification failed.");
          }
        } else {
            throw new Error("Biometric hardware not detected.");
        }
        
        await new Promise(res => setTimeout(res, 800));
      } catch (e: any) {
        console.error("Biometric error details:", e);
        if (e.name === "NotAllowedError") {
          toast.error("Verification cancelled or timed out.");
        } else if (e.name === "InvalidStateError") {
          toast.error("This device does not recognize the registered passkey.");
        } else {
          toast.error(e.message || "Verification failed.");
        }
        setState("idle");
        return;
      }
      await saveAttendance();
      return;
    }

    if (!modelsLoaded) return toast.info("Face recognition models are loading, please wait...");
    
    // Check if face is registered
    if (!profile?.face_registered) {
        setErrorMsg("Your face is not registered.");
        return;
    }

    await startCamera();
  }

  return (
    <div>
      <PageHeader
        title="Mark Attendance"
        subtitle="Real-time verification with geo-fence protection"
        actions={
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-tighter text-primary">SFace AI Active</span>
            </div>
            <div className="flex rounded-xl border border-border/50 bg-muted/30 p-1 shadow-sm">
              {(["web","mobile"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setPunchMode(m);
                    setState("idle");
                    stopCamera();
                    if (m === "mobile") refreshProfile();
                  }}
                  className={cn("rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                    punchMode === m ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {m === "web" ? "Web" : "Mobile"}
                </button>
              ))}
            </div>
            <button 
              onClick={registerFace}
              className="rounded-xl border border-border/50 bg-background px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary shadow-sm hover:bg-muted/50 transition-all flex items-center gap-2"
            >
              <ScanFace className="h-3 w-3" />
              Register Face Again
            </button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-5 md:p-8 shadow-sm transition-all hover:shadow-elegant">
          {(!modelsLoaded && profile?.role === "Admin") && (
            <div className="mb-4 rounded-lg bg-info/10 p-3 text-[11px] text-info border border-info/30 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-bold">✨ Biometric Security Active</span>
                <span className="opacity-70">Please look directly at the camera.</span>
              </div>
            </div>
          )}
          <div className="relative mx-auto aspect-[3/4] md:aspect-video w-full overflow-hidden rounded-xl border-2 border-dashed bg-gradient-to-br from-muted/40 to-muted/10">
            {registrationStep > 0 && (
              <div className="absolute top-4 left-4 right-4 z-40 bg-black/60 backdrop-blur-md rounded-lg p-3 border border-primary/30 flex items-center justify-between animate-in slide-in-from-top duration-500">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">Biometric Enrollment</span>
                  <span className="text-sm font-bold text-white">Capturing Samples...</span>
                </div>
                <div className="flex-1 px-6">
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${registrationStep}%` }} />
                    </div>
                </div>
                <div className="text-xs font-black text-white">{registrationStep}%</div>
              </div>
            )}
            <video 
              ref={videoRef} 
              muted 
              playsInline 
              className={cn(
                "absolute inset-0 h-full w-full object-cover", 
                (state !== "camera" && state !== "scanning") || punchMode === "mobile" ? "hidden" : ""
              )} 
            />
            <canvas 
              ref={canvasRef}
              className={cn(
                "absolute inset-0 h-full w-full pointer-events-none z-10",
                (state !== "camera" && state !== "scanning") || punchMode === "mobile" ? "hidden" : ""
              )}
            />

            {/* Real-time Similarity Bar Overlay */}
            {(state === "scanning" || state === "camera") && punchMode === "web" && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[85%] max-w-md space-y-2 pointer-events-none">
                <div className="flex justify-between text-[10px] uppercase tracking-widest font-black drop-shadow-md">
                  <span className={cn(lastSimilarity >= 90 ? "text-emerald-400" : "text-cyan-400")}>
                    {lastSimilarity >= 90 ? "✓ Identity Verified" : "⟲ Analyzing Biometrics"}
                  </span>
                  <span className="text-white font-mono">{lastSimilarity}% Match</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl">
                  {/* Threshold Marker at 90% */}
                  <div className="absolute left-[90%] top-0 bottom-0 w-[2px] bg-white/20 z-10" />
                  
                  {/* Progress Fill */}
                  <div 
                    className={cn(
                      "h-full transition-all duration-500 ease-out",
                      lastSimilarity >= 90 ? "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)]" : "bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)]"
                    )}
                    style={{ width: `${lastSimilarity}%` }}
                  />
                </div>
                {lastSimilarity > 0 && lastSimilarity < 90 && (
                  <p className="text-[9px] text-center text-white/60 font-bold tracking-tighter uppercase drop-shadow-sm">Security clearance required: 90% similarity</p>
                )}
              </div>
            )}

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center pointer-events-none">
              {state === "scanning" ? (
                <div className="flex flex-col items-center gap-2 rounded-xl bg-background/80 px-6 py-4 backdrop-blur-md animate-in fade-in zoom-in duration-300">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div className="text-sm font-semibold">Processing...</div>
                </div>
              ) : (state === "success" && (punchMode === "web" || todayRecord?.check_out)) ? (
                <div className="animate-in fade-in zoom-in duration-300">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15">
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-success">
                    {todayRecord?.check_out ? "Check-Out Successful" : "Punch Successful"}
                  </div>
                  <div className="text-xs text-muted-foreground">Recorded at {markedAt}</div>
                  <button 
                    onClick={registerFace} 
                    className="mt-6 pointer-events-auto text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:underline"
                  >
                    Update Face Data?
                  </button>
                </div>
              ) : punchMode === "mobile" ? (
                <div className="pointer-events-auto flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
                  <div className="relative group cursor-pointer" onClick={mark}>
                    <div className="absolute -inset-1 rounded-full bg-primary/20 animate-ping opacity-75" />
                    <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-tr from-primary to-info opacity-75 blur transition duration-500 group-hover:opacity-100" />
                    <div className="relative flex h-[18rem] md:h-[22rem] w-full max-w-[18rem] flex-col items-center justify-center rounded-[2.5rem] bg-card p-6 shadow-2xl overflow-hidden border border-border/50">
                        {/* Futuristic Scanning Line */}
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_var(--color-primary)] animate-scan-line z-20" />
                        
                        <div className="mb-8 relative z-10">
                            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                            <div className="relative h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/30">
                                <ScanFace className="h-12 w-12 text-primary" />
                            </div>
                        </div>
                        <div className="text-center relative z-10">
                            <div className="text-sm font-black text-primary uppercase tracking-[0.25em]">Biometric ID</div>
                            <div className="mt-2 text-[11px] font-black text-foreground uppercase tracking-widest bg-muted/50 px-3 py-1 rounded-full border border-border/50">
                              {profile?.name?.split(' ')[0] || "USER"}-{profile?.id?.slice(0, 4).toUpperCase()}
                            </div>
                            <div className="mt-6 flex flex-col items-center gap-4">
                              {!(profile as any)?.biometric_registered ? (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); registerBiometrics(); }}
                                  className="pointer-events-auto rounded-full bg-primary px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground shadow-elegant hover:scale-105 active:scale-95 transition-all"
                                >
                                  Register Biometrics
                                </button>
                              ) : (
                                  <>
                                    <div className="flex gap-1.5">
                                      {[1,2,3,4,5].map(i => (
                                        <div 
                                          key={i} 
                                          className="h-1.5 w-6 rounded-full bg-primary/30 animate-pulse" 
                                          style={{ animationDelay: `${i * 150}ms`, boxShadow: '0 0 10px var(--color-primary)' }} 
                                        />
                                      ))}
                                    </div>
                                    <span className="text-[11px] font-black text-primary uppercase tracking-[0.25em] animate-pulse">Tap to verify identity</span>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); registerBiometrics(); }}
                                      className="pointer-events-auto mt-2 text-[9px] font-bold text-muted-foreground hover:text-primary transition-colors underline decoration-dotted"
                                    >
                                      Register Again?
                                    </button>
                                  </>
                              )}
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                  {state === "idle" && (
                    <>
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 relative">
                        <ScanFace className="h-10 w-10 text-primary" />
                        <div className="absolute -bottom-2 whitespace-nowrap bg-primary text-[8px] font-black uppercase px-2 py-0.5 rounded-full text-primary-foreground shadow-sm">
                          SFace AI Active
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        {profile?.face_registered ? "Face Recognition Ready" : "Face Not Registered"}
                      </div>
                      <div className="max-w-xs text-xs text-muted-foreground text-center">
                        {profile?.face_registered 
                            ? "Position your face inside the frame." 
                            : "You need to register your face before marking attendance."}
                      </div>
                      {!profile?.face_registered ? (
                        <button 
                          onClick={registerFace} 
                          className="mt-4 pointer-events-auto rounded-xl bg-primary px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground shadow-elegant hover:scale-105 active:scale-95 transition-all"
                        >
                          Register My Face Now
                        </button>
                      ) : (
                        <button 
                          onClick={registerFace} 
                          className="mt-4 pointer-events-auto flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/10 transition-all shadow-sm"
                        >
                          <ScanFace className="h-3.5 w-3.5" />
                          Register Face Again
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {(state === "idle" || state === "camera") && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[80%] md:h-80 md:w-68 -translate-x-1/2 -translate-y-1/2 rounded-[45%] border-2 border-primary/60 shadow-elegant" />
            )}
            {state === "camera" && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 pointer-events-auto">
                <button
                  onClick={verifyAndPunch}
                  className="rounded-full bg-primary px-8 py-3 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-elegant hover:scale-105 active:scale-95 transition-all"
                >
                  Verify & Punch
                </button>
                <button
                  onClick={registerFace}
                  className="group pointer-events-auto flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-md transition-all hover:bg-black/60 hover:border-white/40"
                >
                  <ScanFace className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                  Register Face Again
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <GeoStatusCard geo={geo} branchName={current?.name || "..."} distance={distance} radius={current?.radius_meters || 150} current={current} />
            <div className="flex items-center gap-3 rounded-xl border bg-background/40 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Local time</div>
                <div className="text-sm font-semibold">{now || "—"}</div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div>{errorMsg}</div>
                {!profile?.face_registered && (
                    <button onClick={registerFace} className="mt-2 text-primary font-bold hover:underline">
                        Register Your Face Now
                    </button>
                )}
              </div>
            </div>
          )}

          {isHoliday && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-holiday/40 bg-holiday/10 p-3 text-xs text-holiday">
              <PartyPopper className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Today is a Holiday: {isHoliday.name}</div>
                <div className="opacity-80 mt-0.5">
                  If your shift requires working today, attendance will be marked as <strong>present/late</strong> based on your shift.
                  Otherwise it will be recorded as <strong>Holiday</strong>.
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {current?.name || "Select Branch"}</span>
            </div>
            <button
              onClick={mark}
              disabled={state === "scanning" || state === "camera" || (punchMode === "web" && !profile?.face_registered) || branchLoading || !!todayRecord?.check_out}
              className="inline-flex items-center gap-2 rounded-xl gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:grayscale"
            >
              <Camera className="h-4 w-4" />
              {todayRecord?.check_out ? "Shift Completed" : (todayRecord ? "Check Out" : "Check In")}
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-5 md:p-8 shadow-sm transition-all hover:shadow-elegant">
          <h2 className="text-lg font-semibold">Today</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border bg-background/40 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Check In</div>
              <div className="mt-1 text-xl font-bold">{markedAt || "—"}</div>
            </div>
            <div className="rounded-xl border bg-background/40 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Check Out</div>
              <div className="mt-1 text-xl font-bold">
                {todayRecord?.check_out ? fmtTime(new Date(todayRecord.check_out)) : "—"}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Records</h3>
            <button onClick={handleExportRecent} className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline">
              Export All
            </button>
          </div>
          <ol className="mt-3 space-y-3">
            {recentRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No records found</p>
            ) : recentRecords.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border bg-background/40 p-3">
                <div>
                  <div className="text-sm font-medium">{new Date(r.created_at).toLocaleDateString()}</div>
                  <div className="text-xs text-muted-foreground">
                    In {r.check_in ? fmtTime(new Date(r.check_in)) : "—"} · Out {r.check_out ? fmtTime(new Date(r.check_out)) : "—"}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function GeoStatusCard({ geo, branchName, distance, radius, current }: { geo: GeoState; branchName: string; distance: number | null; radius: number; current: any }) {
  const hasCoords = current?.lat && current?.lng;
  
  const cfg = {
    unknown:  { tone: "bg-muted/40 border-border text-muted-foreground", label: "Waiting for check…", icon: MapPin },
    checking: { tone: "bg-info/10 border-info/30 text-info",            label: "Locating you…",          icon: Loader2 },
    inside:   { tone: "bg-success/10 border-success/30 text-success",   label: `Inside ${branchName}`,   icon: ShieldCheck },
    outside:  { tone: "bg-warning/15 border-warning/40 text-warning", label: "Outside geo-fence", icon: AlertTriangle },
    denied:   { tone: "bg-destructive/10 border-destructive/30 text-destructive", label: "Location denied", icon: AlertTriangle },
  }[geo];

  const Icon = cfg.icon;

  if (!hasCoords && geo !== "denied" && geo !== "checking") {
      return (
        <div className="flex items-center gap-3 rounded-xl border bg-warning/10 border-warning/30 p-3 text-warning">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/50">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider opacity-70">Geo-fence</div>
            <div className="text-sm font-semibold">No location set for branch</div>
          </div>
        </div>
      );
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-3", cfg.tone)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/50">
        <Icon className={cn("h-5 w-5", geo === "checking" && "animate-spin")} />
      </div>
      <div className="flex-1">
        <div className="text-[11px] uppercase tracking-wider opacity-70">Geo-fence</div>
        <div className="text-sm font-semibold">{cfg.label}</div>
        {distance !== null && geo !== "denied" && (
          <div className="text-[11px] opacity-70">{distance}m from office · allowed {radius}m</div>
        )}
      </div>
    </div>
  );
}
