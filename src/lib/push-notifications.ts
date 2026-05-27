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
    // High-priority channel for "ringing" effect
    await PushNotifications.createChannel({
      id: "incoming_calls",
      name: "Incoming Calls",
      description: "Ringtone and vibration for incoming calls",
      importance: 5,
      vibration: true,
      sound: "ringtone",
      visibility: 1,
    });
  } catch {
    // skip
  }

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    await supabase.from("user_push_tokens").upsert(
      {
        user_id: userId,
        token: token.value,
        platform: "android",
      },
      { onConflict: "token" }
    );
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("📲 [Native Push] Received:", notification);
    const data = notification.data as Record<string, unknown>;
    
    if (data?.type === "call" && data?.roomId && data?.callerName) {
       // Trigger the ringing UI if the app is open
       window.dispatchEvent(new CustomEvent('incoming-call', { 
         detail: {
           callerName: data.callerName,
           callerId: data.callerId,
           roomId: data.roomId
         } 
       }));
    }
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification.data as Record<string, unknown>;
    if (data?.type === "call" && data?.roomId) {
       const url = `/meetings?call=incoming&room=${data.roomId}&from=${data.callerId || ""}&name=${encodeURIComponent(data.callerName as string)}`;
       window.location.href = url;
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

  await supabase.from("user_push_tokens").upsert(
    {
      user_id: userId,
      token: subJson.endpoint as string,
      platform: "web",
      subscription_json: subJson as Record<string, unknown>,
    },
    { onConflict: "token" }
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
