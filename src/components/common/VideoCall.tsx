import { useEffect, useRef, useState, useCallback } from "react";
import { socketService } from "@/lib/socket-service";
import { X, Mic, MicOff, Video, VideoOff, Monitor, Phone, PhoneOff, MessageSquare, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Peer from "simple-peer";

interface VideoCallProps {
  roomId: string;
  userId: string;
  userName: string;
  isDirect?: boolean;
  calleeName?: string;
  onEnd: () => void;
}

type PeerEntry = {
  peerId: string;
  peer: Peer.Instance;
  stream?: MediaStream;
};

export function VideoCall({ roomId, userId, userName, isDirect, calleeName, onEnd }: VideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    const startCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        socketService.joinVideoRoom(roomId, userName);
      } catch (err) {
        console.error("Failed to get media:", err);
      }
    };
    startCall();

    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => {
      clearInterval(timer);
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
      });

      peer.on("close", () => {
        setPeers((prev) => prev.filter((p) => p.peerId !== targetId));
        peersRef.current.delete(targetId);
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
      }
    });

    return () => {
      unsubJoined();
      unsubSignal();
      unsubLeft();
    };
  }, [localStream, userId, createPeer]);

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    setIsVideoOff(!isVideoOff);
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
  };

  const remotePeers = peers.filter((p) => p.stream);

  return (
    <div ref={containerRef} className={cn("fixed inset-0 z-[200] bg-black flex flex-col", isFullscreen && "bg-black")}>
      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-white text-sm font-medium">{formatTime(callDuration)}</span>
          </div>
          <span className="text-white/80 text-sm font-medium">
            {isDirect ? `Calling ${calleeName || "..."}` : `Meeting · ${remotePeers.length + 1} participants`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleFullscreen} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button onClick={() => setShowChat(!showChat)} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <MessageSquare size={18} />
          </button>
          <button onClick={onEnd} className="p-2.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 relative overflow-hidden p-4">
        <div className={cn("grid gap-4 h-full", remotePeers.length <= 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2")}>
          {/* Remote videos */}
          {remotePeers.map((p) => (
            <div key={p.peerId} className="relative rounded-2xl overflow-hidden bg-zinc-900">
              <video ref={(el) => { if (el && p.stream) el.srcObject = p.stream; }} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-3 left-3 px-2 py-1 rounded-lg bg-black/50 text-white text-xs font-medium backdrop-blur-sm">
                {p.peerId === userId ? "You" : p.peerId.slice(0, 8)}
              </div>
            </div>
          ))}

          {/* Local video (PiP when remote exists) */}
          <div className={cn("relative rounded-2xl overflow-hidden bg-zinc-900", remotePeers.length > 0 ? "absolute bottom-20 right-4 w-48 h-36 md:w-56 md:h-40 z-20 shadow-2xl border-2 border-white/20" : "")}>
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/50 text-white text-[10px] font-medium backdrop-blur-sm">
              {isScreenSharing ? "Screen" : "You"}
            </div>
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                <div className="h-16 w-16 rounded-full bg-zinc-700 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{userName[0]?.toUpperCase()}</span>
                </div>
              </div>
            )}
          </div>

          {remotePeers.length === 0 && (
            <div className="col-span-full flex items-center justify-center">
              <div className="text-center">
                <div className="h-24 w-24 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <span className="text-white text-4xl font-bold">{userName[0]?.toUpperCase()}</span>
                </div>
                <p className="text-white/60 text-lg font-medium">Waiting for others to join...</p>
                <p className="text-white/40 text-sm mt-1">Share the meeting ID: {roomId.slice(0, 8)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-30 flex items-center justify-center gap-3 p-4 bg-gradient-to-t from-black/60 to-transparent">
        <button onClick={toggleMute} className={cn("p-4 rounded-full transition-all", isMuted ? "bg-red-500/80 text-white" : "bg-white/10 text-white hover:bg-white/20")}>
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button onClick={onEnd} className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all scale-110 hover:scale-125">
          <PhoneOff size={22} />
        </button>
        <button onClick={toggleVideo} className={cn("p-4 rounded-full transition-all", isVideoOff ? "bg-red-500/80 text-white" : "bg-white/10 text-white hover:bg-white/20")}>
          {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
        </button>
        <button onClick={toggleScreenShare} className={cn("p-4 rounded-full transition-all", isScreenSharing ? "bg-green-500/80 text-white" : "bg-white/10 text-white hover:bg-white/20")}>
          <Monitor size={22} />
        </button>
      </div>

      {/* In-call Chat */}
      {showChat && (
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 z-40 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-white font-bold">In-Call Chat</h3>
            <button onClick={() => setShowChat(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className="text-sm">
                <span className="text-primary font-semibold">{msg.sender}: </span>
                <span className="text-white/80">{msg.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={sendChatMessage} className="p-4 border-t border-white/10 flex gap-2">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-primary/50" />
            <button type="submit" className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/80">Send</button>
          </form>
        </div>
      )}
    </div>
  );
}
