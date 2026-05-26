import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import { CHAT_SUPABASE_URL, CHAT_SUPABASE_ANON_KEY } from "@/lib/config";
import { requestNotificationPermission, showLocalNotification, subscribeToPush } from "@/lib/push";

interface NotificationServiceContext {
  notifyDashboard: (title: string, body: string) => void;
  setSuppressChatNotifications: (v: boolean) => void;
}

const NotificationCtx = createContext<NotificationServiceContext | null>(null);

export function useNotificationService() {
  const ctx = useContext(NotificationCtx);
  if (!ctx) throw new Error("NotificationService not mounted");
  return ctx;
}

const chatSupabase =
  CHAT_SUPABASE_URL && CHAT_SUPABASE_ANON_KEY
    ? createClient(CHAT_SUPABASE_URL, CHAT_SUPABASE_ANON_KEY)
    : null;

export function NotificationProvider({ userId, children }: { userId: string | undefined; children: ReactNode }) {
  const profileIdRef = useRef(userId);
  const suppressChatRef = useRef(false);

  useEffect(() => {
    profileIdRef.current = userId;
  }, [userId]);

  const setSuppressChatNotifications = (v: boolean) => {
    suppressChatRef.current = v;
  };

  useEffect(() => {
    if (!userId || !chatSupabase) return;

    requestNotificationPermission().catch(() => {});
    subscribeToPush(userId).catch(() => {});

    const channel = chatSupabase
      .channel("global-chat-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (suppressChatRef.current) return;
          const msg = payload.new as any;
          if (!msg || msg.user_id === profileIdRef.current) return;
          showLocalNotification({
            title: "New message",
            body: msg.content || "Sent a message",
            icon: "/icon-192.png",
            data: { url: "/chat" },
          });
        }
      )
      .subscribe();

    return () => {
      chatSupabase.removeChannel(channel);
    };
  }, [userId]);

  const notifyDashboard = (title: string, body: string) => {
    showLocalNotification({ title, body, icon: "/icon-192.png", data: { url: "/" } });
  };

  return <NotificationCtx.Provider value={{ notifyDashboard, setSuppressChatNotifications }}>{children}</NotificationCtx.Provider>;
}
