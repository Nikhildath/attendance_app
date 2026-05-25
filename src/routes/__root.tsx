import { Outlet, createRootRoute, HeadContent, Scripts, Link, useLocation, useRouter } from "@tanstack/react-router";
import React, { useEffect } from "react";
import appCss from "../styles.css?url";
import { ThemeProvider } from "@/lib/theme";
import { AppShell } from "@/components/common/AppShell";
import { BranchProvider } from "@/lib/branch-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { SettingsProvider } from "@/lib/settings-context";
import { LiveTracker } from "@/components/common/LiveTracker";
import { PWAInstallPrompt } from "@/components/common/PWAInstallPrompt";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Go home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#eaf3fb" },
      { title: "Attendly — Workforce Attendance Platform" },
      { name: "description", content: "Modern attendance management with calendar, leaves, reports and team views." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <React.Fragment>
      <HeadContent />
      {children}
      <Scripts />
    </React.Fragment>
  );
}
function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <BranchProvider>
            <RootContent />
            <LiveTracker />
            <Toaster />
          </BranchProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootContent() {
  const location = useLocation();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const hideShell = location.pathname === "/login";

  useEffect(() => {
    if (loading) return;
    const isAuthenticated = user || profile;
    if (!isAuthenticated && location.pathname !== "/login") {
      router.navigate({ to: "/login" });
    }
    if (isAuthenticated && location.pathname === "/login") {
      router.navigate({ to: "/" });
    }
  }, [loading, user, profile, location.pathname, router]);

  // Connect socket when authenticated
  useEffect(() => {
    if (!profile?.id) return;

    import("@/lib/socket-service").then(({ socketService }) => {
      socketService.connect("", "", profile.id).catch((err) => {
        console.warn("[Socket] Connection failed (non-critical):", err);
      });
    });

    return () => {
      import("@/lib/socket-service").then(({ socketService }) => {
        socketService.disconnect();
      });
    };
  }, [profile?.id]);

  // We removed the blocking loading screen to prevent the app from hanging.
  // The AuthProvider still handles auth state, but we allow the app to render immediately.


  return (
    <>
      {hideShell ? <Outlet /> : <AppShell><Outlet /></AppShell>}
      {!hideShell && <PWAInstallPrompt />}
    </>
  );
}
