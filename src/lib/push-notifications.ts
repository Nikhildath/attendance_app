import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabase";
import { VAPID_PUBLIC_KEY } from "./config";

function urlB64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes;
}

async function registerNativePush(userId: string) {
  const permResult = await PushNotifications.requestPermissions();
  if (permResult.receive !== "granted") return;

  try {
    await PushNotifications.createChannel({
      id: "incoming_calls",
      name: "Incoming Calls",
      description: "Notifications for incoming video calls",
      importance: 5,
      vibration: true,
      sound: "default",
      visibility: 1,
    });
  } catch {
    // Channel may already exist
  }

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    const existing = await supabase
      .from("user_push_tokens")
      .select("id")
      .eq("token", token.value)
      .maybeSingle();

    if (existing.data) return;

    await supabase.from("user_push_tokens").upsert(
      {
        user_id: userId,
        token: token.value,
        platform: Capacitor.getPlatform() === "android" ? "android" : "ios",
      },
      { onConflict: "token", ignoreDuplicates: false }
    );
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    const data = notification.data as Record<string, unknown>;
    if (data?.type === "call" && data?.roomId && data?.callerName) {
      window.dispatchEvent(
        new CustomEvent("incoming-call", {
          detail: {
            callerName: data.callerName,
            callerId: data.callerId || "",
            roomId: data.roomId,
          },
        })
      );
    }
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification.data as Record<string, unknown>;
    if (action.actionId === "accept" && data?.roomId && data?.callerName) {
      window.location.href = `/meetings?call=incoming&room=${data.roomId}&from=${data.callerId || ""}&name=${encodeURIComponent(data.callerName as string)}`;
    }
  });
}

async function registerWebPush(userId: string) {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subJson = subscription.toJSON();

  const existing = await supabase
    .from("user_push_tokens")
    .select("id")
    .eq("token", subJson.endpoint as string)
    .maybeSingle();

  if (existing.data) return;

  await supabase.from("user_push_tokens").upsert(
    {
      user_id: userId,
      token: subJson.endpoint as string,
      platform: "web",
      subscription_json: subJson as Record<string, unknown>,
    },
    { onConflict: "token", ignoreDuplicates: false }
  );
}

export async function registerPushNotifications(userId: string) {
  try {
    if (Capacitor.isNativePlatform()) {
      await registerNativePush(userId);
    } else {
      await registerWebPush(userId);
    }
  } catch (err) {
    console.error("Push registration failed:", err);
  }
}

export async function unregisterPushNotifications() {
  try {
    if (Capacitor.isNativePlatform()) {
      await PushNotifications.unregister();
    }

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.toJSON().endpoint;
        await subscription.unsubscribe();
        if (endpoint) {
          await supabase.from("user_push_tokens").delete().eq("token", endpoint);
        }
      }
    }
  } catch (err) {
    console.error("Push unregister failed:", err);
  }
}
