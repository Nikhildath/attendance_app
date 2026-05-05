import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    port: 8080,
  },
  plugins: [
    react(),
    tailwindcss(),
    TanStackRouterVite(),
    tsconfigPaths(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon-192.png", "icon-512.png", "banner.png"],
      manifest: {
        name: "Attendly - Attendance Hub Pro",
        short_name: "Attendly",
        description: "Professional Attendance and Staff Tracking Management System",
        theme_color: "#eaf3fb",
        background_color: "#eaf3fb",
        display: "standalone",
        start_url: "/",
        orientation: "portrait",
        categories: ["productivity", "business", "utilities"],
        screenshots: [
          {
            src: "/banner.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Attendly Dashboard"
          },
          {
            src: "/banner.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "narrow",
            label: "Attendly Mobile"
          }
        ],
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
