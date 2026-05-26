import { useEffect, useRef, useState, useCallback } from "react";
import { socketService } from "@/lib/socket-service";
import { X, Mic, MicOff, Video, VideoOff, Monitor, Phone, PhoneOff, MessageSquare, Maximize2, Minimize2, Users, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Peer from "simple-peer";
import { Avatar2D } from "./Avatar2D";

interface VideoCallProps {
  roomId: string;
  userId: string;
  userName: string;
  isDirect?: boolean;
  calleeName?: string;
  onEnd: () => void;
  onReady?: () => void;
  profiles?: { id: string; name: string; avatar_url?: string | null; role?: string }[];
}

type PeerEntry = {
  peerId: string;
  peer: Peer.Instance;
  stream?: MediaStream;
};

function getProfilePic(profiles: VideoCallProps["profiles"], id: string, name: string): string | null {
  return profiles?.find((p) => p.id === id)?.avatar_url || null;
}

export function VideoCall({ roomId, userId, userName, isDirect, calleeName, onEnd, onReady, profiles }: VideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [remoteVideoOff, setRemoteVideoOff] = useState<Map<string, boolean>>(new Map());

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
  const peerNamesRef = useRef<Map<string, string>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 4000);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    startHideTimer();
  }, [startHideTimer]);

  useEffect(() => {
    const startCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 480 } },
          audio: true,
        });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        socketService.joinVideoRoom(roomId, userName);
        onReady?.();
      } catch (err: any) {
        console.error("Failed to get media:", err);
        setMediaError(err.message || "Camera/mic access denied. Check permissions.");
        onReady?.();
      }
    };
    startCall();

    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    startHideTimer();

    return () => {
      clearInterval(timer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      stopAll();
    };
  }, [roomId]);

  const stopAll = useCallback(() => {
    localStream?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    peersRef.current.forEach((p) => p.destroy());
    peersRef.current.clear();
    socketService.leaveVideoRoom(roomId);
  }, [localStream, roomId]);

  const createPeer = useCallback(
    (targetId: string, initiator: boolean, stream: MediaStream) => {
      const peer = new Peer({ initiator, stream, trickle: false, config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] } });

      peer.on("signal", (signal) => {
        socketService.sendVideoSignal(targetId, signal, userName);
      });

      peer.on("stream", (remoteStream) => {
        setPeers((prev) => {
          if (prev.some((p) => p.peerId === targetId)) return prev;
          return [...prev, { peerId: targetId, peer, stream: remoteStream }];
        });
        const vt = remoteStream.getVideoTracks()[0];
        if (vt && !vt.enabled) {
          setRemoteVideoOff((prev) => { const m = new Map(prev); m.set(targetId, true); return m; });
        }
      });

      peer.on("close", () => {
        setPeers((prev) => prev.filter((p) => p.peerId !== targetId));
        peersRef.current.delete(targetId);
        setRemoteVideoOff((prev) => { const m = new Map(prev); m.delete(targetId); return m; });
      });

      peersRef.current.set(targetId, peer);
      return peer;
    },
    [userName]
  );

  useEffect(() => {
    if (!localStream) return;

    const unsubJoined = socketService.onVideoUserJoined((data) => {
      if (data.userId !== userId) {
        peerNamesRef.current.set(data.userId, data.name);
        createPeer(data.userId, true, localStream);
      }
    });

    const unsubSignal = socketService.onVideoSignal((data) => {
      if (data.from === userId) return;
      let peer = peersRef.current.get(data.from);
      if (!peer) {
        peer = createPeer(data.from, false, localStream!);
      }
      peer.signal(data.signal);
    });

    const unsubLeft = socketService.onVideoUserLeft((data) => {
      const peer = peersRef.current.get(data.userId);
      if (peer) {
        peer.destroy();
        peersRef.current.delete(data.userId);
        setPeers((prev) => prev.filter((p) => p.peerId !== data.userId));
        setRemoteVideoOff((prev) => { const m = new Map(prev); m.delete(data.userId); return m; });
      }
    });

    const unsubVideoToggle = socketService.onVideoToggle((data) => {
      if (data.userId !== userId) {
        setRemoteVideoOff((prev) => { const m = new Map(prev); m.set(data.userId, data.videoOff); return m; });
      }
    });

    return () => {
      unsubJoined();
      unsubSignal();
      unsubLeft();
      unsubVideoToggle();
    };
  }, [localStream, userId, createPeer]);

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    setIsMuted(!isMuted);
    showControls();
  };

  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    setIsVideoOff(!isVideoOff);
    socketService.setVideoToggle(roomId, !isVideoOff);
    showControls();
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      const videoTrack = localStream?.getVideoTracks()[0];
      const oldScreenTrack = screenTrackRef.current;
      screenTrackRef.current = null;
      peersRef.current.forEach((p) => { if (oldScreenTrack && videoTrack) p.replaceTrack(oldScreenTrack, videoTrack, localStream!); });
      setIsScreenSharing(false);
      socketService.setScreenShare(roomId, false);
      showControls();
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true } as DisplayMediaStreamOptions);
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;
      const camTrack = localStream?.getVideoTracks()[0];
      peersRef.current.forEach((p) => { if (camTrack) p.replaceTrack(camTrack, screenTrack, screenStream); });
      screenTrack.onended = () => toggleScreenShare();
      setIsScreenSharing(true);
      socketService.setScreenShare(roomId, true);
    } catch {}
    showControls();
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [...prev, { sender: userName, text: chatInput }]);
    socketService.sendChatMessage({ room_id: roomId, user_id: userId, content: chatInput, type: "text" });
    setChatInput("");
  };

  useEffect(() => {
    const unsubMsg = socketService.onChatMessage((data) => {
      if (data.user_id !== userId) {
        setChatMessages((prev) => [...prev, { sender: data.user_id, text: data.content }]);
      }
    });
    return unsubMsg;
  }, [userId]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
    showControls();
  };

  const getPeerName = (pid: string) => peerNamesRef.current.get(pid) || pid.slice(0, 8);

  const PeerAvatar = ({ pid, name }: { pid: string; name: string }) => (
    <Avatar2D name={name} size={48} src={getProfilePic(profiles, pid, name)} />
  );

  const myAvatarUrl = getProfilePic(profiles, userId, userName);

  const remotePeers = peers.filter((p) => p.stream);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] bg-black flex flex-col touch-none select-none"
      onTouchStart={showControls}
      onMouseMove={showControls}
    >
      {/* Header - auto-hides */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 z-30 flex items-center justify-between p-3 md:p-4 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-white/10 backdrop-blur-md">
            <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-white text-[11px] md:text-sm font-medium">{formatTime(callDuration)}</span>
          </div>
          <span className="text-white/80 text-[11px] md:text-sm font-medium hidden sm:inline">
            {isDirect ? `Calling ${calleeName || "..."}` : `Meeting · ${remotePeers.length + 1} participants`}
          </span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button onClick={toggleFullscreen} className="p-2 md:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            {isFullscreen ? <Minimize2 size={16} className="md:hidden" /> : <Maximize2 size={16} className="md:hidden" />}
            {isFullscreen ? <Minimize2 size={18} className="hidden md:block" /> : <Maximize2 size={18} className="hidden md:block" />}
          </button>
          <button onClick={() => setShowChat(!showChat)} className="p-2 md:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <MessageSquare size={16} className="md:hidden" />
            <MessageSquare size={18} className="hidden md:block" />
          </button>
          <button onClick={onEnd} className="p-2 md:p-2.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors">
            <X size={16} className="md:hidden" />
            <X size={18} className="hidden md:block" />
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 relative overflow-hidden">
        <div className={cn("grid gap-2 md:gap-4 h-full p-2 md:p-4", remotePeers.length <= 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2")}>
          {/* Remote videos */}
          {remotePeers.map((p) => {
            const rName = getPeerName(p.peerId);
            const rVideoOff = remoteVideoOff.get(p.peerId) || false;
            return (
              <div key={p.peerId} className="relative rounded-xl md:rounded-2xl overflow-hidden bg-zinc-900 min-h-0">
                {rVideoOff ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                    <PeerAvatar pid={p.peerId} name={rName} />
                  </div>
                ) : (
                  <video ref={(el) => { if (el && p.stream) el.srcObject = p.stream; }} autoPlay playsInline className="w-full h-full object-cover" />
                )}
                <div className="absolute bottom-2 left-2 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg bg-black/50 text-white text-[10px] md:text-xs font-medium backdrop-blur-sm flex items-center gap-1.5">
                  <Avatar2D name={rName} size={14} src={getProfilePic(profiles, p.peerId, rName)} />
                  {rName}
                  {rVideoOff && <VideoOff size={10} className="text-red-400" />}
                </div>
              </div>
            );
          })}

          {/* Local video (PiP when remote exists) */}
          <div
            className={cn(
              "relative rounded-xl md:rounded-2xl overflow-hidden bg-zinc-900",
              remotePeers.length > 0
                ? "absolute bottom-16 md:bottom-20 right-2 md:right-4 w-32 h-44 md:w-48 md:h-40 z-20 shadow-2xl border-2 border-green-500/40"
                : "border-2 border-green-500/30"
            )}
          >
            {mediaError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 p-2 text-center">
                <p className="text-white/70 text-[10px] md:text-xs">{mediaError}</p>
              </div>
            ) : (
              <>
                {isVideoOff ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                    <Avatar2D name={userName} size={48} src={myAvatarUrl} />
                  </div>
                ) : (
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                )}
                <div className="absolute bottom-1 left-1 md:bottom-2 md:left-2 px-1 md:px-2 py-0.5 md:py-1 rounded-lg bg-black/50 text-white text-[9px] md:text-[10px] font-medium backdrop-blur-sm flex items-center gap-1">
                  <Avatar2D name={userName} size={12} src={myAvatarUrl} />
                  {isScreenSharing ? "Screen" : "You"}
                </div>
              </>
            )}
          </div>

          {/* Waiting screen with profile pic */}
          {remotePeers.length === 0 && !mediaError && (
            <div className="col-span-full flex items-center justify-center">
              <div className="text-center px-4">
                <div className="mx-auto mb-3 md:mb-4">
                  <Avatar2D name={userName} size={80} src={myAvatarUrl} />
                </div>
                <p className="text-white/60 text-sm md:text-lg font-medium">Waiting for others to join...</p>
                <p className="text-white/40 text-[10px] md:text-sm mt-1 hidden sm:block">Share the meeting ID: {roomId.slice(0, 8)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls - auto-hides */}
      <div
        className={cn(
          "relative z-30 flex items-center justify-center gap-2 md:gap-3 p-3 md:p-4 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <button onClick={toggleMute} className={cn("p-3 md:p-4 rounded-full transition-all active:scale-90", isMuted ? "bg-red-500/80 text-white" : "bg-white/10 text-white hover:bg-white/20")}>
          {isMuted ? <MicOff size={18} className="md:hidden" /> : <Mic size={18} className="md:hidden" />}
          {isMuted ? <MicOff size={22} className="hidden md:block" /> : <Mic size={22} className="hidden md:block" />}
        </button>
        <button onClick={onEnd} className="p-3 md:p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all scale-110 hover:scale-125 active:scale-90">
          <PhoneOff size={18} className="md:hidden" />
          <PhoneOff size={22} className="hidden md:block" />
        </button>
        <button onClick={toggleVideo} className={cn("p-3 md:p-4 rounded-full transition-all active:scale-90", isVideoOff ? "bg-red-500/80 text-white" : "bg-white/10 text-white hover:bg-white/20")}>
          {isVideoOff ? <VideoOff size={18} className="md:hidden" /> : <Video size={18} className="md:hidden" />}
          {isVideoOff ? <VideoOff size={22} className="hidden md:block" /> : <Video size={22} className="hidden md:block" />}
        </button>
        <button onClick={toggleScreenShare} className={cn("p-3 md:p-4 rounded-full transition-all active:scale-90", isScreenSharing ? "bg-green-500/80 text-white" : "bg-white/10 text-white hover:bg-white/20")}>
          <Monitor size={18} className="md:hidden" />
          <Monitor size={22} className="hidden md:block" />
        </button>
        {profiles && profiles.length > 0 && (
          <button onClick={() => { setShowAddPeople(!showAddPeople); showControls(); }} className={cn("p-3 md:p-4 rounded-full transition-all active:scale-90", showAddPeople ? "bg-primary/80 text-white" : "bg-white/10 text-white hover:bg-white/20")}>
            <Users size={18} className="md:hidden" />
            <Users size={22} className="hidden md:block" />
          </button>
        )}
      </div>

      {/* Tap to show controls hint */}
      {!controlsVisible && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-300">
          <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white/50 text-[10px] font-medium">
            Tap to show controls
          </div>
        </div>
      )}

      {/* In-call Chat */}
      {showChat && (
        <div className="absolute top-0 right-0 bottom-0 w-full sm:w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 z-40 flex flex-col">
          <div className="flex items-center justify-between p-3 md:p-4 border-b border-white/10">
            <h3 className="text-white font-bold text-sm md:text-base">In-Call Chat</h3>
            <button onClick={() => setShowChat(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className="text-sm">
                <span className="text-primary font-semibold">{msg.sender}: </span>
                <span className="text-white/80">{msg.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={sendChatMessage} className="p-3 md:p-4 border-t border-white/10 flex gap-2">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-primary/50" />
            <button type="submit" className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/80">Send</button>
          </form>
        </div>
      )}

      {/* Add Participants Panel */}
      {showAddPeople && profiles && (
        <div className="absolute top-0 right-0 bottom-0 w-full sm:w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 z-40 flex flex-col">
          <div className="flex items-center justify-between p-3 md:p-4 border-b border-white/10">
            <h3 className="text-white font-bold text-sm md:text-base">Add People</h3>
            <button onClick={() => setShowAddPeople(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {profiles
              .filter((p) => p.id !== userId)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setShowAddPeople(false);
                    socketService.initiateDirectCall(p.id, userName, roomId);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 hover:bg-white/5 transition-colors text-left"
                >
                  <Avatar2D name={p.name} size={36} src={p.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{p.name}</p>
                    <p className="text-white/50 text-[10px] font-medium">{p.role || "Employee"}</p>
                  </div>
                  <ChevronRight size={16} className="text-white/30 shrink-0" />
                </button>
              ))}
            {profiles.filter((p) => p.id !== userId).length === 0 && (
              <p className="text-white/40 text-sm text-center py-8">No other users available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
