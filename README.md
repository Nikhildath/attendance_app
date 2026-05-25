# Attendly Pro — Workforce Management Platform

Real-time attendance tracking, field staff geolocation, and team management with Socket.io live updates.

## Features

- **Live Location Tracking** — Field staff locations streamed in real-time via Socket.io. View on an interactive Leaflet map with battery, speed, and status telemetry.
- **AI Face Recognition** — Biometric attendance verification using face-api.js with anti-spoofing.
- **Multi-Branch & Shift Management** — Geofenced offices, custom shifts, late fines, and holiday sync.
- **HR & Payroll** — Leave workflow, comp-offs, automated payslip generation with deductions.
- **Team Chat** — WhatsApp-style messaging with images, files, voice notes, and 30-day auto-purge.
- **Mobile APK** — Built with Capacitor, deployed via GitHub Actions. Push notifications included.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, TanStack Router, Tailwind CSS |
| Real-time | Socket.io (server + client) |
| Database | Supabase (PostgreSQL, Auth, Realtime) |
| Maps | Leaflet + React-Leaflet |
| Mobile | Capacitor (Android APK) |
| Hosting | Render (socket server), GitHub Actions (APK build) |

## Quick Start

### 1. Install
```bash
npm install
```

### 2. Configure (no .env needed)
All settings are in two files:

- **`src/lib/config.ts`** — frontend settings (gets baked into APK)
- **`server-config.js`** — socket server settings (for Render)

Edit these before building. No `.env` file required.

### 3. Database
Run `supabase_schema.sql` in your Supabase SQL editor to create all tables and functions.

### 4. Run locally
```bash
npm run dev
```
- Frontend: `http://localhost:8080`
- Socket server: `http://localhost:3001`
- Live map: `http://localhost:8080/field-tracking`

## Deploy Socket Server on Render (Free)

```yaml
# render.yaml — already configured, just push to GitHub
services:
  - type: web
    name: attendance-socket-server
    runtime: node
    buildCommand: npm install
    startCommand: node server.js
```

1. Push to GitHub
2. Render.com → New + → Web Service → connect repo
3. Free plan, no env vars needed
4. After deploy, copy your Render URL (e.g. `https://attendance-socket-server.onrender.com`)

## Set the URL & Build APK

In `src/lib/config.ts`:
```ts
export const SOCKET_URL = "https://attendance-socket-server.onrender.com";
```

Then run your GitHub Action to build the APK. The app connects to your Render-hosted socket server for live location.

## How Live Location Works

```
Phone GPS → LiveTracker component → Socket.io → Render server
                                                     ↓
                              Supabase (persist) + broadcast to admin panels
                                                     ↓
                              field-tracking.tsx updates map in real-time
```

The app **only sends via Socket.io** (no direct Supabase writes from the device) — keeps your Supabase quota low.

## Architecture

```
attendance-hub-pro/
├── server.js              # Socket.io server (deploy on Render)
├── server-config.js       # Server settings (edit before deploy)
├── src/
│   ├── lib/
│   │   ├── config.ts      # Frontend settings (edit before APK build)
│   │   ├── socket-service.ts  # Socket.io client singleton
│   │   └── supabase.ts    # Supabase client (reads from config.ts)
│   ├── components/
│   │   └── common/
│   │       └── LiveTracker.tsx  # GPS → Socket.io every 30s
│   └── routes/
│       └── field-tracking.tsx   # Live map with socket updates
└── render.yaml            # Render blueprint (socket-only)
```

## License

MIT
