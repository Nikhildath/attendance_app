import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, PhoneCall } from "lucide-react";
import { socketService } from "@/lib/socket-service";

interface IncomingCallScreenProps {
  callerName: string;
  callerId: string;
  roomId: string;
  onAccept: (roomId: string) => void;
  onReject: () => void;
  onIgnore: () => void;
}

export function IncomingCallScreen({ callerName, callerId, roomId, onAccept, onReject, onIgnore }: IncomingCallScreenProps) {
  const [timeoutSec, setTimeoutSec] = useState(30);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);

    let ringInterval: ReturnType<typeof setInterval>;
    const playRing = () => {
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.value = 540;
        const gain2 = ctx.createGain();
        gain2.gain.value = 0.3;
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.4);
      }, 600);
    };
    playRing();
    ringInterval = setInterval(playRing, 1500);

    const timeout = setInterval(() => {
      setTimeoutSec((s) => {
        if (s <= 1) {
          onIgnore();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      clearInterval(ringInterval);
      clearInterval(timeout);
      ctx.close();
    };
  }, []);

  const handleAccept = () => {
    socketService.joinVideoRoom(roomId, callerName);
    onAccept(roomId);
  };

  const handleReject = () => {
    socketService.endCall(callerId);
    onReject();
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.08)_0%,transparent_70%)]" />

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <div className="mb-6 relative">
          <div className="h-28 w-28 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse shadow-[0_0_60px_rgba(34,197,94,0.2)]">
            <div className="h-24 w-24 rounded-full bg-green-500/30 flex items-center justify-center">
              <PhoneCall size={40} className="text-green-400" />
            </div>
          </div>
          <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-500 animate-ping" />
        </div>

        <h2 className="text-3xl font-black text-white mb-1">Incoming Call</h2>
        <p className="text-xl font-bold text-green-400 mb-2">{callerName}</p>
        <p className="text-sm text-white/50 font-medium mb-10">Direct call · Ringing...</p>

        <div className="flex items-center gap-8">
          <button onClick={handleReject} className="flex flex-col items-center gap-2 group">
            <div className="h-16 w-16 rounded-full bg-red-500/80 flex items-center justify-center group-hover:bg-red-500 group-hover:scale-110 transition-all shadow-lg shadow-red-500/30">
              <PhoneOff size={26} className="text-white" />
            </div>
            <span className="text-xs font-bold text-white/70">Decline</span>
          </button>

          <button onClick={handleAccept} className="flex flex-col items-center gap-2 group">
            <div className="h-16 w-16 rounded-full bg-green-500/80 flex items-center justify-center group-hover:bg-green-500 group-hover:scale-110 transition-all shadow-lg shadow-green-500/30 animate-pulse">
              <Phone size={26} className="text-white" />
            </div>
            <span className="text-xs font-bold text-white/70">Accept</span>
          </button>
        </div>

        <p className="mt-12 text-xs text-white/30 font-medium">Auto-ignoring in {timeoutSec}s</p>
      </div>
    </div>
  );
}
