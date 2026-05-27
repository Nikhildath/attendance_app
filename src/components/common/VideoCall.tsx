import { useEffect, useRef, useState, useCallback } from "react";
import { socketService } from "@/lib/socket-service";
import { X, Mic, MicOff, Video, VideoOff, Monitor, Phone, PhoneOff, MessageSquare, Maximize2, Minimize2, Users, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Peer from "simple-peer";
import { Avatar2D } from "./Avatar2D";
import { Capacitor } from "@capacitor/core";
import { ScreenShare } from "@/lib/screen-share";
import { MediaPermissions } from "@/lib/media-permissions";

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

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

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
  const pendingSignalsRef = useRef<Map<string, any[]>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const nativeScreenCleanupRef = useRef<(() => void) | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const startHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 4000);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    startHideTimer();
  }, [startHideTimer]);

  const startCall = useCallback(async () => {
    console.log("🎥 [VideoCall] Starting call. isNative:", isNative);
    if (isNative) {
      try {
        console.log("🎥 [VideoCall] Requesting native permissions...");
        const permResult = await MediaPermissions.request();
        if (!permResult.allGranted) {
          setMediaError("Camera or microphone permission denied.");
          socketService.joinVideoRoom(roomId, userName);
          onReady?.();
          return;
        }
      } catch (err: any) {
        console.warn("🎥 [VideoCall] MediaPermissions plugin failed:", err.message);
      }
    }

    try {
      const constraints = {
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      socketService.joinVideoRoom(roomId, userName);
      onReady?.();
    } catch (err: any) {
      console.warn("🎥 [VideoCall] Media failed, trying audio-only:", err.message);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(audioStream);
        setIsVideoOff(true);
        socketService.joinVideoRoom(roomId, userName);
        onReady?.();
      } catch (audioErr: any) {
        setMediaError(`Your microphone and camera are off.`);
        socketService.joinVideoRoom(roomId, userName);
        onReady?.();
      }
    }
  }, [roomId, userName, onReady, isNative]);

  useEffect(() => {
    startCall();
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    startHideTimer();
    return () => {
      clearInterval(timer);
      stopAll();
    };
  }, [roomId]);

  const stopAll = useCallback(() => {
    localStream?.getTracks().forEach((t) => t.stop());
    peersRef.current.forEach((p) => p.destroy());
    peersRef.current.clear();
    socketService.leaveVideoRoom(roomId);
  }, [localStream, roomId]);

  const createPeer = useCallback(
    (targetId: string, initiator: boolean, stream: MediaStream) => {
      console.log(`📡 [WebRTC] Creating peer for ${targetId}, initiator: ${initiator}`);
      const peer = new Peer({ 
        initiator, 
        stream, 
        trickle: true, 
        config: { iceServers: ICE_SERVERS } 
      });

      peer.on("signal", (signal) => {
        socketService.sendVideoSignal(targetId, signal, userName);
      });

      peer.on("stream", (remoteStream) => {
        console.log(`📡 [WebRTC] Received stream from ${targetId}`);
        setPeers((prev) => {
          if (prev.some((p) => p.peerId === targetId)) return prev;
          return [...prev, { peerId: targetId, peer, stream: remoteStream }];
        });
      });

      peer.on("error", (err) => {
        console.error(`📡 [WebRTC] Peer error with ${targetId}:`, err);
      });

      peer.on("close", () => {
        setPeers((prev) => prev.filter((p) => p.peerId !== targetId));
        peersRef.current.delete(targetId);
      });

      peersRef.current.set(targetId, peer);
      
      // Process any pending signals for this peer
      const pending = pendingSignalsRef.current.get(targetId);
      if (pending) {
        pending.forEach(sig => peer.signal(signal));
        pendingSignalsRef.current.delete(targetId);
      }

      return peer;
    },
    [userName]
  );

  useEffect(() => {
    // Listen for users joined even before localStream is ready
    const unsubJoined = socketService.onVideoUserJoined((data) => {
      if (data.userId !== userId) {
        peerNamesRef.current.set(data.userId, data.name);
        if (localStream) {
          createPeer(data.userId, true, localStream);
        }
      }
    });

    const unsubSignal = socketService.onVideoSignal((data) => {
      if (data.from === userId) return;
      let peer = peersRef.current.get(data.from);
      if (!peer && localStream) {
        peer = createPeer(data.from, false, localStream);
        peer.signal(data.signal);
      } else if (peer) {
        peer.signal(data.signal);
      } else {
        // Queue signal if peer/stream not ready
        const pending = pendingSignalsRef.current.get(data.from) || [];
        pending.push(data.signal);
        pendingSignalsRef.current.set(data.from, pending);
      }
    });

    const unsubLeft = socketService.onVideoUserLeft((data) => {
      const peer = peersRef.current.get(data.userId);
      if (peer) {
        peer.destroy();
        peersRef.current.delete(data.userId);
        setPeers((prev) => prev.filter((p) => p.peerId !== data.userId));
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
    // Basic implementation for now
    setIsScreenSharing(!isScreenSharing);
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
      {/* Header */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 z-30 flex items-center justify-between p-3 md:p-4 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-white text-xs font-medium">{formatTime(callDuration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowChat(!showChat)} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <MessageSquare size={18} />
          </button>
          <button onClick={onEnd} className="p-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 relative overflow-hidden">
        <div className={cn("grid gap-2 h-full p-2", remotePeers.length <= 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2")}>
          {remotePeers.map((p) => {
            const rName = getPeerName(p.peerId);
            const rVideoOff = remoteVideoOff.get(p.peerId) || false;
            return (
              <div key={p.peerId} className="relative rounded-2xl overflow-hidden bg-zinc-900 min-h-0">
                {rVideoOff ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                    <PeerAvatar pid={p.peerId} name={rName} />
                  </div>
                ) : (
                  <video ref={(el) => { if (el && p.stream) el.srcObject = p.stream; }} autoPlay playsInline className="w-full h-full object-cover" />
                )}
                <div className="absolute bottom-3 left-3 px-2 py-1 rounded-lg bg-black/50 text-white text-xs font-medium backdrop-blur-sm flex items-center gap-2">
                  <Avatar2D name={rName} size={16} src={getProfilePic(profiles, p.peerId, rName)} />
                  {rName}
                </div>
              </div>
            );
          })}

          {/* Local Video */}
          <div
            className={cn(
              "relative rounded-2xl overflow-hidden bg-zinc-900 border-2 border-primary/30",
              remotePeers.length > 0 ? "absolute bottom-20 right-4 w-32 h-44 z-20 shadow-2xl" : ""
            )}
          >
            {isVideoOff ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                <Avatar2D name={userName} size={48} src={myAvatarUrl} />
              </div>
            ) : (
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            )}
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/50 text-white text-[10px] font-medium backdrop-blur-sm">
              You
            </div>
          </div>

          {remotePeers.length === 0 && (
            <div className="col-span-full flex items-center justify-center">
              <div className="text-center">
                <Avatar2D name={userName} size={80} src={myAvatarUrl} className="mx-auto mb-4" />
                <p className="text-white/60 font-medium">Waiting for others to join...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div
        className={cn(
          "relative z-30 flex items-center justify-center gap-4 p-6 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <button onClick={toggleMute} className={cn("p-4 rounded-full transition-all", isMuted ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20")}>
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        <button onClick={onEnd} className="p-5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all scale-110 active:scale-95">
          <PhoneOff size={28} />
        </button>
        <button onClick={toggleVideo} className={cn("p-4 rounded-full transition-all", isVideoOff ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20")}>
          {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
        </button>
      </div>

      {/* Chat */}
      {showChat && (
        <div className="absolute top-0 right-0 bottom-0 w-full sm:w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 z-40 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-white font-bold">In-Call Chat</h3>
            <button onClick={() => setShowChat(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/60"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className="text-sm">
                <span className="text-primary font-bold">{msg.sender}: </span>
                <span className="text-white/80">{msg.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={sendChatMessage} className="p-4 border-t border-white/10 flex gap-2">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Message..." className="flex-1 bg-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-primary/50" />
            <button type="submit" className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold">Send</button>
          </form>
        </div>
      )}
    </div>
  );
}
