import { Buffer } from "buffer";
(window as any).Buffer = Buffer;
(window as any).process = { env: {}, browser: true };
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).process = (window as any).process;
}

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { registerSW } from "virtual:pwa-register";

const router = getRouter();

// Register the service worker
registerSW({ immediate: true });

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}
