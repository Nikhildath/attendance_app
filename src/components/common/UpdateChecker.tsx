import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download } from "lucide-react";

const GITHUB_REPO = "Nikhildath/attendance_app";
const CURRENT_VERSION = "1.0.0";

type GitHubRelease = {
  tag_name: string;
  html_url: string;
  body: string;
  prerelease: boolean;
  assets: { name: string; browser_download_url: string }[];
};

export function UpdateChecker() {
  const [update, setUpdate] = useState<GitHubRelease | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const check = async () => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
          {
            headers: { Accept: "application/vnd.github.v3+json" },
          }
        );
        if (!res.ok) return;
        const release: GitHubRelease = await res.json();
        const latestVer = release.tag_name.replace(/^v/i, "");
        if (latestVer !== CURRENT_VERSION) {
          setUpdate(release);
        }
      } catch {
        // skip
      }
    };

    check();
    const interval = setInterval(check, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  if (!update || dismissed) return null;

  const apkAsset = update.assets.find((a) => a.name.endsWith(".apk"));
  const downloadUrl = apkAsset?.browser_download_url || update.html_url;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-right rounded-xl border bg-card p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Update Available</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {update.tag_name} — {update.body?.split("\n")[0] || "New version available"}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Download
            </a>
            <button
              onClick={() => setDismissed(true)}
              className="inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium hover:bg-accent"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}