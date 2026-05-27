import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCall } from "@/lib/call-context";
import { socketService } from "@/lib/socket-service";
import { IncomingCallScreen } from "./IncomingCallScreen";
import { VideoCall } from "./VideoCall";
import { supabase } from "@/lib/supabase";

export function GlobalCallManager() {
  const { profile } = useAuth();
  const { incomingCall, setIncomingCall, activeCall, setActiveCall, isInCall, setInCall } = useCall();
  const [allProfiles, setAllProfiles] = useState<any[]>([]);

  // Listen for custom 'incoming-call' events (from push notifications)
  useEffect(() => {
    const handleCustomEvent = (e: any) => {
      console.log("📞 [GlobalCallManager] Custom Event received:", e.detail);
      setIncomingCall({
        callerName: e.detail.callerName,
        callerId: e.detail.callerId,
        roomId: e.detail.roomId
      });
    };
    window.addEventListener('incoming-call', handleCustomEvent);
    return () => window.removeEventListener('incoming-call', handleCustomEvent);
  }, [setIncomingCall]);

  // Fetch all profiles for the VideoCall component to show names/avatars
  useEffect(() => {
    if (!profile) return;
    const fetchProfiles = async () => {
      const { data } = await supabase.from("profiles").select("id, name, avatar_url, role");
      if (data) setAllProfiles(data);
    };
    fetchProfiles();
  }, [profile]);

  const handleAccept = (roomId: string) => {
    setActiveCall({ roomId, calleeName: incomingCall?.callerName, calleeId: incomingCall?.callerId });
    setIncomingCall(null);
    setInCall(true);
  };

  const handleReject = () => {
    if (incomingCall) {
      socketService.endCall(incomingCall.callerId);
    }
    setIncomingCall(null);
  };

  const handleIgnore = () => {
    setIncomingCall(null);
  };

  const handleEndCall = () => {
    if (activeCall?.calleeId) {
      socketService.endCall(activeCall.calleeId);
    }
    setActiveCall(null);
    setInCall(false);
  };

  if (!profile) return null;

  return (
    <>
      {incomingCall && (
        <IncomingCallScreen
          callerName={incomingCall.callerName}
          callerId={incomingCall.callerId}
          roomId={incomingCall.roomId}
          onAccept={handleAccept}
          onReject={handleReject}
          onIgnore={handleIgnore}
        />
      )}

      {activeCall && (
        <VideoCall
          roomId={activeCall.roomId}
          userId={profile.id}
          userName={profile.name || profile.email || "Staff Member"}
          isDirect={!!activeCall.calleeName}
          calleeName={activeCall.calleeName}
          onEnd={handleEndCall}
          profiles={allProfiles}
        />
      )}
    </>
  );
}
