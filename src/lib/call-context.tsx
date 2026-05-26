import { createContext, useContext, useState, ReactNode } from "react";

type CallContextType = {
  isInCall: boolean;
  setInCall: (v: boolean) => void;
};

const CallContext = createContext<CallContextType>({
  isInCall: false,
  setInCall: () => {},
});

export function CallProvider({ children }: { children: ReactNode }) {
  const [isInCall, setInCall] = useState(false);
  return (
    <CallContext.Provider value={{ isInCall, setInCall }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  return useContext(CallContext);
}
