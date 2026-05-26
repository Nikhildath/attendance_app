import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";

export type DeviceInfo = {
  model: string;
  os: string;
  osVersion: string;
};

function parseUserAgent(ua: string): DeviceInfo {
  const lower = ua.toLowerCase();

  if (/android/.test(lower)) {
    const match = ua.match(/Android\s([\d._]+)/);
    const osVersion = match ? match[1] : "Unknown";
    let model = "Unknown Android";
    const modelMatch = ua.match(/\([^;]+;\s([^;)]+)/);
    if (modelMatch) {
      model = modelMatch[1].trim();
    }
    return { model, os: "Android", osVersion };
  }

  if (/iphone|ipad|ipod/.test(lower)) {
    const match = ua.match(/OS\s([\d_]+)/);
    const osVersion = match ? match[1].replace(/_/g, ".") : "Unknown";
    const isiPad = /ipad/.test(lower);
    const isiPod = /ipod/.test(lower);
    const model = isiPad ? "iPad" : isiPod ? "iPod" : "iPhone";
    return { model, os: "iOS", osVersion };
  }

  if (/macintosh|mac os x/.test(lower)) {
    const match = ua.match(/Mac OS X\s([\d_]+)/);
    return {
      model: "Mac",
      os: "macOS",
      osVersion: match ? match[1].replace(/_/g, ".") : "Unknown",
    };
  }

  if (/windows/.test(lower)) {
    const match = ua.match(/Windows NT\s([\d.]+)/);
    const versions: Record<string, string> = {
      "10.0": "10",
      "6.3": "8.1",
      "6.2": "8",
      "6.1": "7",
    };
    const ver = match ? match[1] : "Unknown";
    return {
      model: "PC",
      os: "Windows",
      osVersion: versions[ver] || ver,
    };
  }

  if (/linux/.test(lower)) {
    return { model: "PC", os: "Linux", osVersion: "Unknown" };
  }

  return { model: "Unknown", os: "Unknown", osVersion: "Unknown" };
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await Device.getInfo();
      return {
        model: info.model || info.name || "Unknown",
        os: info.operatingSystem?.toString() || "Unknown",
        osVersion: info.osVersion || "Unknown",
      };
    } catch {
      return parseUserAgent(navigator.userAgent);
    }
  }
  return parseUserAgent(navigator.userAgent);
}
