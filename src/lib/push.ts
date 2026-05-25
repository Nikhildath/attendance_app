import { createClient } from "@supabase/supabase-js";

const CHAT_SUPABASE_URL = "https://pcgoxzcllijqqvwaqqpl.supabase.co";
const CHAT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZ294emNsbGlqcXF2d2FxcXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzIzNDIsImV4cCI6MjA5MzIwODM0Mn0.h3eQUd4KCr3C7ml4AOwyYQMm2tmYPhbIcfp7R6VzoZY";
const VAPID_PUBLIC_KEY = "BGIA1VAmBOZoD_m9TkevM4BZ3kpsjF70XSgKykZUas8TUTtIBQ7xONMJoEF89NkGMDXYJDTwhGW3Ca5xm_vmO4Q";

const chatSupabase =
  CHAT_SUPABASE_URL && CHAT_SUPABASE_ANON_KEY
    ? createClient(CHAT_SUPABASE_URL, CHAT_SUPABASE_ANON_KEY)
    : null;

type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return { granted: false, reason: "unsupported" as const };
  }

  if (Notification.permission === "granted") {
    return { granted: true, reason: "granted" as const };
  }

  if (Notification.permission === "denied") {
    return { granted: false, reason: "blocked" as const };
  }

  const permission = await Notification.requestPermission();
  return {
    granted: permission === "granted",
    reason: permission === "granted" ? ("granted" as const) : ("blocked" as const),
  };
}

export async function showLocalNotification(payload: PushPayload) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;

  const normalized = {
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    data: payload.data || {},
  };

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.showNotification(normalized.title, {
        body: normalized.body,
        icon: normalized.icon,
        badge: normalized.badge,
        data: normalized.data,
      });
      return true;
    }
  } catch (error) {
    console.warn("[Push] Service worker notification failed, falling back to window Notification.", error);
  }

  new Notification(normalized.title, normalized);
  return true;
}

export async function subscribeToPush(userId: string) {
  if (!userId) return { ok: false, reason: "missing-user" as const };
  if (!isPushSupported()) return { ok: false, reason: "unsupported" as const };
  if (!chatSupabase) return { ok: false, reason: "missing-chat-config" as const };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "missing-vapid-key" as const };

  const permission = await requestNotificationPermission();
  if (!permission.granted) {
    return { ok: false, reason: permission.reason };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const { error } = await chatSupabase.from("push_subscriptions").upsert({
    user_id: userId,
    subscription: JSON.parse(JSON.stringify(subscription)),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[Push] Failed to save subscription:", error);
    return { ok: false, reason: "save-failed" as const, error };
  }

  return { ok: true, reason: "subscribed" as const, subscription };
}

export async function sendPushNotification(userId: string, payload: PushPayload) {
  if (!userId) return false;

  try {
    const response = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, payload }),
    });

    if (response.ok) {
      return true;
    }

    const errorText = await response.text();
    console.warn("[Push] Backend send failed:", response.status, errorText);
  } catch (error) {
    console.warn("[Push] Push send request failed:", error);
  }

  return false;
}
