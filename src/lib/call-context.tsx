import { createContext, useContext, useState, ReactNode } from "react";

type IncomingCall = {
  callerName: string;
  callerId: string;
  roomId: string;
};

type ActiveCall = {
  roomId: string;
  calleeName?: string;
};

type CallContextType = {
  isInCall: boolean;
  setInCall: (v: boolean) => void;
  incomingCall: IncomingCall | null;
  setIncomingCall: (call: IncomingCall | null) => void;
  activeCall: ActiveCall | null;
  setActiveCall: (call: ActiveCall | null) => void;
};

const CallContext = createContext<CallContextType>({
  isInCall: false,
  setInCall: () => {},
  incomingCall: null,
  setIncomingCall: () => {},
  activeCall: null,
  setActiveCall: () => {},
});

export function CallProvider({ children }: { children: ReactNode }) {
  const [isInCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  return (
    <CallContext.Provider value={{ 
      isInCall, 
      setInCall, 
      incomingCall, 
      setIncomingCall,
      activeCall,
      setActiveCall
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  return useContext(CallContext);
}
