# Attendly Pro — Enterprise Workforce Management Platform

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor)](https://capacitorjs.com)
[![Supabase](https://img.shields.io/badge/Supabase-2.40-3FCF8E?logo=supabase)](https://supabase.com)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?logo=socket.io)](https://socket.io)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> **A production-grade workforce management platform** with real-time attendance, live GPS field tracking, AI face recognition, team chat, payroll, and a native Android APK — all powered by Supabase.

---

## Screenshots

```
 ┌──────────────────────────────────────────────────────────────┐
 │  Dashboard   Attendance   Field Tracking   Chat   Leaves     │
 │  ┌────────────────────────────────────────────────────────┐  │
 │  │  📊 85% Present    📍 12 Active    📋 3 Pending       │  │
 │  │  ════════════════════════════════════════════════════  │  │
 │  │  [============▊=========================] 68%         │  │
 │  │  Weekly Trend ▲ 12% vs last week                      │  │
 │  │  ┌──────────┬──────────┬──────────┬──────────┐       │  │
 │  │  │ Present  │ Absent   │ Late     │ Leave    │       │  │
 │  │  │   42     │    5     │    3     │    2     │       │  │
 │  │  └──────────┴──────────┴──────────┴──────────┘       │  │
 │  └────────────────────────────────────────────────────────┘  │
 └──────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 📍 Real-Time Live Location Tracking
- **Socket.io** streams GPS coordinates every 30 seconds from field staff
- Interactive **Leaflet map** with live markers, battery level, speed, and status
- **Native Android foreground service** survives app kills (HTTP POST to `/api/location`)
- Branch geofencing with radius validation
- Manager dashboard at `/field-tracking`

### 📸 AI Face Recognition Attendance
- **face-api.js** + **ONNX Runtime** for browser-based face detection
- Anti-spoofing: blink detection before capture
- Captured face stored as Base64 in Supabase
- Biometric passkey support (WebAuthn) for one-tap check-in

### 👥 Multi-Branch & Shift Management
- Geofenced branches with configurable radius (default 150m)
- Custom shift types: fixed, rotational, open
- Per-user weekly shift schedules (Mon–Sun)
- Late fine calculation via organization settings

### 💳 HR, Leave & Payroll
- Leave workflow: Submit → Pending → Approve/Reject with push notification
- Leave categories with annual allowances (Sick, Casual, Annual, etc.)
- Comp-off requests with automated earned-leave tracking
- Payslip generation with deductions (tax, fines, loan)
- Advances / salary loan management

### 🎥 Video Calls & Meetings
- **Direct one-on-one calls** with phone-style incoming call UI
- **Scheduled meetings** with calendar view, participant selection, status tracking
- **WebRTC** via simple-peer with STUN/TURN
- **Screen sharing**, mic/camera toggle, in-call chat
- **FCM push notifications** for incoming calls — rings even when app is killed (Android)
- **Incoming call screen** with Accept/Decline, auto-ringtone, 30s timeout
- Works on both PWA and native Android APK

### 💬 Team Chat
- Real-time messaging via **Socket.io** (lower latency) + Supabase persistence
- Typing indicators with animated dots (2s throttle)
- Rich media: images, video, audio (recorded in-browser), files
- Channels / rooms with admin management
- 30-day auto-purge for message hygiene
- Push notifications for new messages (app-wide)

### 📊 Dashboard & Reports
- Weekly attendance trends with charts (Recharts)
- Month calendar view showing daily status
- Recent activity feed
- Announcements and celebration highlights (birthdays, work anniversaries)
- Exportable reports (CSV)

### 📱 Native Mobile App
- **Capacitor 8** Android APK with native plugins
- Background geolocation (even when app is killed)
- Native biometric authentication (fingerprint + face)
- In-app APK update checker (GitHub Releases)
- PWA with service worker for offline caching
- Push notifications via **FCM** (native) + **Web Push API** (PWA)
- Full-screen incoming call on lock screen

### 🛠 Admin Panel
- User management (create, edit, deactivate)
- Role assignment: Employee, Manager, Admin
- Branch assignment and transfer
- Bulk operations and system settings

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                CLIENT (Vite + React 18 SPA)                      │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ React    │  │ TanStack │  │ Socket.io  │  │ Capacitor 8  │  │
│  │ Router   │  │ Query    │  │ Client     │  │ Native Plugins│  │
│  └──────────┘  └──────────┘  └────────────┘  └──────────────┘  │
│       │              │              │               │            │
│  ┌────┴──────────────┴──────────────┴───────────────┴────┐      │
│  │              Supabase Client SDK                       │      │
│  │         (Auth, Realtime, Database, Storage)            │      │
│  └───────────────────────────────────────────────────────┘      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
│   Supabase       │  │  Socket.io   │  │  Chat Supabase   │
│   (Main DB)      │  │  Server      │  │  (Messages, Push)│
│                  │  │  (Render)    │  │                  │
│  • profiles      │  │  • Live      │  │  • messages      │
│  • attendance    │  │    location  │  │  • rooms         │
│  • leaves        │  │    broadcast │  │  • profiles      │
│  • staff_tracking│  │  • Push      │  │  • push_sub      │
│  • shifts        │  │    notifs    │  │    scriptions    │
│  • payroll       │  └──────────────┘  └──────────────────┘
│  • branches      │
└──────────────────┘
```

---

## 🧱 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript 5.8 | UI framework |
| **Routing** | TanStack Router v1 | File-based routing |
| **State** | TanStack Query v5 | Server state management |
| **Styling** | Tailwind CSS v4 + Radix UI | Design system |
| **Animations** | Framer Motion v12 | UI transitions |
| **Maps** | Leaflet + React-Leaflet | Live location map |
| **Charts** | Recharts v3 | Dashboard analytics |
| **Forms** | React Hook Form + Zod | Form validation |
| **Icons** | Lucide React v0.575 | Icon library |
| **Backend DB** | Supabase (PostgreSQL) | Auth, data, realtime |
| **Real-time** | Socket.io v4.8 | Live location streaming |
| **Push** | Web Push API + web-push | Browser notifications |
| **Mobile** | Capacitor 8 | Native Android APK |
| **Biometrics** | face-api.js + WebAuthn | Face + fingerprint auth |
| **Build** | Vite 7 + TypeScript | Fast dev + production |
| **AI/ML** | ONNX Runtime Web | Face detection model |
| **Audio** | MediaRecorder API | Voice notes in chat |
| **Charts** | Recharts | Dashboard trends |

---

## 📁 Project Structure

```
attendance-hub-pro/
│
├── server.js                    # Socket.io + Express server (Render)
├── server-config.js             # Server environment config
│
├── src/
│   ├── main.tsx                 # App entry point (SW registration)
│   ├── router.tsx               # TanStack Router setup
│   ├── styles.css               # Global Tailwind styles
│   ├── sw.ts                    # Service worker (push + caching)
│   │
│   ├── routes/                  # File-based route pages
│   │   ├── __root.tsx           # Root layout with providers
│   │   ├── index.tsx            # Dashboard (stats, trends, calendar)
│   │   ├── attendance.tsx       # Check-in/out with face + location
│   │   ├── field-tracking.tsx   # Live GPS map for managers
│   │   ├── chat.tsx             # Team chat with rooms & media
│   │   ├── leaves.tsx           # Leave request & balance
│   │   ├── team.tsx             # Staff directory + leave approvals
│   │   ├── shifts.tsx           # Shift management
│   │   ├── holidays.tsx         # Company holidays
│   │   ├── comp-offs.tsx        # Comp-off requests
│   │   ├── advances.tsx         # Salary advances/loans
│   │   ├── payroll.tsx          # Payslip generation
│   │   ├── calendar.tsx         # Attendance calendar
│   │   ├── reports.tsx          # Exportable reports
│   │   ├── meetings.tsx         # Video meetings + direct calls
│   │   ├── settings.tsx         # User settings & notifications
│   │   ├── admin.tsx            # Admin panel (users, system)
│   │   ├── login.tsx            # Authentication page
│   │   └──
│   │
│   ├── components/
│   │   ├── common/              # Shared UI components
│   │   │   ├── LiveTracker.tsx  # GPS → Socket.io + HTTP POST
│   │   │   ├── AppShell.tsx     # Application shell wrapper
│   │   │   ├── Avatar2D.tsx     # User avatar with fallback
│   │   │   ├── IncomingCallScreen.tsx # Full-screen incoming call UI
│   │   │   ├── VideoCall.tsx    # WebRTC video call component
│   │   │   ├── PageHeader.tsx   # Page title/actions
│   │   │   ├── StatCard.tsx     # Dashboard stat card
│   │   │   ├── StatusBadge.tsx  # Status indicator badge
│   │   │   ├── UpdateChecker.tsx # APK update check
│   │   │   ├── PWAInstallPrompt.tsx # PWA install banner
│   │   │   └── Illustrations.tsx # SVG illustrations
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   │   └── Topbar.tsx       # Top bar (branch, search, bell)
│   │   ├── ui/                  # Radix UI primitives (shadcn-style)
│   │   ├── charts/              # Recharts chart components
│   │   └── calendar/            # Month calendar component
│   │
│   └── lib/                     # Core libraries & utilities
│       ├── auth.tsx             # Auth context (Supabase Auth)
│       ├── supabase.ts          # Supabase client singleton
│       ├── config.ts            # Frontend configuration
│       ├── socket-service.ts    # Socket.io client singleton (chat + video call + location)
│       ├── push.ts              # Web Push API helpers
│       ├── push-notifications.ts # Capacitor FCM + Web Push registration
│       ├── notification-service.tsx # App-wide push notifications
│       ├── background-tracker.ts # Native BG tracker bridge
│       ├── face-recognition.ts  # face-api.js integration
│       ├── branch-context.tsx   # Branch selection state
│       ├── settings-context.tsx # User preferences
│       ├── theme.tsx            # Dark/light theme
│       └── utils.ts             # Shared utilities
│
├── android/                     # Capacitor Android project
│   └── app/src/main/java/com/attendly/app/
│       ├── MainActivity.java    # Capacitor bridge activity
│       ├── BackgroundTrackerPlugin.java  # Custom BG tracker plugin
│       └── BackgroundTrackerService.java # Native foreground service
│
├── supabase_schema.sql          # Main DB schema (tables, RLS, RPCs)
├── chat_supabase_schema.sql     # Chat DB schema (messages, rooms)
├── chat_fix_username.sql        # Chat username migration
├── FIX_RLS_POLICIES.sql         # RLS policy migration
├── FIX_STAFF_TRACKING_FK.sql    # FK fix migration
├── MIGRATION_ADD_BIOMETRICS.sql # Biometric passkey migration
├── SUPABASE_TRACKING_RPC_MIGRATION.sql # Tracking RPC migration
├── SUPABASE_LEAVE_CATEGORIES_MIGRATION.sql # Leave categories
│
├── capacitor.config.ts          # Capacitor config (Android)
├── vite.config.ts               # Vite build config (+ PWA)
├── render.yaml                  # Render deployment blueprint
├── vercel.json                  # Vercel deployment config
├── netlify.toml                 # Netlify deployment config
├── ecosystem.config.js          # PM2 process management
├── package.json                 # Dependencies & scripts
└── tsconfig.json                # TypeScript configuration
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 18
- **npm** or **bun**
- A **Supabase** project (main + chat instances)
- (Optional) **Android Studio** for APK builds

### 1. Install dependencies
```bash
npm install
```

### 2. Configure (no .env needed)
All configuration is in two files — edit these before building or deploying:

| File | Purpose |
|------|---------|
| **`src/lib/config.ts`** | Frontend settings (Supabase URLs, keys, VAPID, Socket URL) |
| **`server-config.js`** | Server settings (same values, used by `server.js`) |

### 3. Set up the database
Run the SQL files in your Supabase SQL editor in this order:
1. `supabase_schema.sql` — Main database (all tables, RLS, RPCs, triggers)
2. `chat_supabase_schema.sql` — Chat database (separate Supabase project)

### 4. Start development
```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | `http://localhost:8080` |
| Socket server | `http://localhost:3001` |
| Live map | `http://localhost:8080/field-tracking` |

---

## 📡 How Live Location Tracking Works

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  FOREGROUND (app visible)                                                         │
│                                                                                    │
│  Phone GPS → LiveTracker.tsx → Socket.io → Server → broadcast + Supabase upsert   │
│                                                                                    │
│  BACKGROUND / KILLED (app closed)                                                 │
│                                                                                    │
│  Phone GPS → Foreground Service → native HTTP POST → Server → Supabase upsert     │
│              (BackgroundTrackerService.java)     /api/location   + socket broadcast│
└────────────────────────────────────────────────────────────────────────────────────┘
```

The app uses a **dual-path approach**:

1. **Socket.io path** (foreground): `LiveTracker.tsx` subscribes to the native `BackgroundGeolocation` plugin callback and forwards positions via Socket.io to the server, which broadcasts to all connected clients and persists to Supabase.

2. **Native HTTP path** (killed): A custom Android foreground service (`BackgroundTrackerService.java`) runs independently of the app's activity lifecycle. It uses `FusedLocationProviderClient` for GPS and directly POSTs to the server every 30 seconds with API key authentication. The server maps `latitude/longitude` → `lat/lng` and reads `x-user-id` from headers.

Both paths converge on the same `/api/location` endpoint, upserting into the `staff_tracking` table via `SECURITY DEFINER` RPC (`upsert_staff_tracking`). The map at `/field-tracking` receives live updates through Socket.io.

---

## 🔔 Push Notification System

```
┌────────────┐     ┌──────────────┐     ┌──────────────────────┐     ┌──────────────┐
│  Event     │────▶│  Server.js   │────▶│  FCM (native)  or    │────▶│  Device      │
│  occurs    │     │  Socket.io   │     │  Web Push (PWA)      │     │  Notification│
│            │     │              │     │                      │     │              │
│  • Call    │     │              │     │                      │     │  Accept/     │
│  • Message │     │              │     │                      │     │  Decline     │
│  • Leave   │     │              │     │                      │     │  buttons     │
└────────────┘     └──────────────┘     └──────────────────────┘     └──────────────┘
```

### Delivery channels
| Platform | Technology | Registration |
|----------|-----------|-------------|
| **Android APK** | FCM via `@capacitor/push-notifications` | `PushNotifications.register()` → token stored in `user_push_tokens` |
| **Web / PWA** | Web Push API (VAPID) | Service worker `pushManager.subscribe()` → subscription stored in `user_push_tokens` |
| **Server** | `firebase-admin` SDK + `web-push` | Sends to all registered tokens on event |

### Triggers
- **Incoming video call** — `video:direct-call` socket event → FCM + Web Push sent to callee's tokens. Notification has **Accept/Decline** action buttons and rings with vibration.
- **New chat messages** — app-wide subscription via `notification-service.tsx`
- **Leave approved/rejected** — pushed to the requester from `team.tsx`
- **New leave request** — pushed to all Admin/Manager roles from `leaves.tsx`

### Incoming call flow (Android)
1. Caller taps "Call" → Socket.io emits `video:direct-call`
2. Server looks up callee's push tokens from `user_push_tokens` table
3. Server sends FCM high-priority message with category `INCOMING_CALL`
4. Android shows heads-up notification on lock screen with Accept/Decline
5. User taps Accept → app opens → VideoCall connects via WebRTC
6. User taps Decline → server notifies caller

### Service worker (`sw.ts`)
Handles both push events and notification clicks, routing to `/meetings?call=incoming` for calls or the appropriate page for messages.

---

## 🤖 Native Android Plugins

### Custom Background Tracker
- **`BackgroundTrackerPlugin.java`** — Capacitor plugin bridge (`start`, `stop`)
- **`BackgroundTrackerService.java`** — Foreground service with `START_STICKY`
  - Uses `FusedLocationProviderClient` for high-accuracy GPS
  - POSTs to server via native `HttpURLConnection` (not WebView)
  - Survives activity destruction (not bound to activity lifecycle)
  - Throttled to 30s intervals to conserve battery
  - Notification channel: "Location Tracking"

### Third-party Plugins
| Plugin | Version | Purpose |
|--------|---------|---------|
| `@capacitor-community/background-geolocation` | 1.2.26 | Foreground watcher (app visible) |
| `@capgo/capacitor-native-biometric` | 8.4.5 | Fingerprint + face unlock |
| `@capacitor/android` | 8.3.4 | Android platform |
| `@capacitor/core` | 8.3.4 | Capacitor core |

---

## 📱 Building the APK

The project uses **GitHub Actions** to build the APK automatically. The build workflow:
1. Installs dependencies
2. Syncs Capacitor with `npx cap sync android`
3. Builds the web app with `npm run build`
4. Compiles the Android APK with `./gradlew assembleRelease`
5. Signs with the keystore
6. Uploads as a GitHub Release artifact

### Manual build
```bash
npm run build            # Build web app
npx cap sync android     # Sync Capacitor
npx cap copy android     # Copy web to Android
cd android
./gradlew assembleRelease  # Build APK
```

> **Note:** You need `google-services.json` from Firebase Console for push notifications. Place it in `android/app/`. Without it, the app builds fine but push notifications won't work when the app is killed.

---

## ☁️ Deploying the Socket Server

### Render (recommended)
1. Fork/push to GitHub
2. Go to [Render.com](https://render.com) → New + → Web Service
3. Connect your repo
4. Use the free plan (no env vars needed — config is in `server-config.js`)
5. After deploy, copy the URL (e.g., `https://attendance-socket-server.onrender.com`)
6. Set it in `src/lib/config.ts` → `SOCKET_URL` and rebuild APK

The `render.yaml` blueprint is pre-configured for automatic deployment.

### Alternative: Railway, Fly.io, or your own VPS
```bash
node server.js
```
PM2 config is included in `ecosystem.config.js`:
```bash
pm2 start ecosystem.config.js
```

---

## 🗄 Database Schema (Main Supabase)

### Core Tables
| Table | Description |
|-------|-------------|
| `profiles` | User profiles linked to `auth.users` |
| `branches` | Office locations with GPS coordinates & radius |
| `attendance` | Daily check-in/out records with status |
| `leaves` | Leave requests with approval workflow |
| `leave_categories` | Leave types with annual allowances |
| `staff_tracking` | Real-time GPS positions (upserted by user) |
| `shifts` | Shift definitions (fixed, rotational, open) |
| `shift_schedule` | Per-user weekly shift assignments |
| `company_holidays` | Holiday calendar per branch |
| `payslips` | Monthly payslips with deductions |
| `comp_off_requests` | Compensatory off requests |
| `advances` | Salary advances / loans |
| `announcements` | Company announcements |
| `meetings` | Video meeting schedules with room names and status |
| `meeting_participants` | Meeting attendee list |
| `user_push_tokens` | FCM / Web Push device tokens for push notifications |
| `organisation_settings` | Global config (late fines, currency, etc.) |

### Key RPC Functions (Security Definer — Bypass RLS)
- `upsert_staff_tracking(p_user_id, p_lat, p_lng, ...)` — Insert/update GPS position
- `lookup_profile_for_auth(p_user_id)` — Profile lookup for Socket.io auth
- `admin_update_profile(...)` — Admin user management
- `admin_insert_profile(...)` — Admin user creation

### Chat Database (Separate Supabase Instance)
| Table | Description |
|-------|-------------|
| `profiles` | Chat user profiles (keyed by main app user ID) |
| `rooms` | Chat channels / rooms |
| `messages` | Messages with type (text, image, video, audio, file) |
| `push_subscriptions` | Web Push subscription endpoints |

---

## 🔐 Security

- **Row Level Security** (RLS) enabled on all tables
- **SECURITY DEFINER** RPCs bypass RLS for server-side operations (Socket.io auth, background location POST)
- **API key authentication** for background location endpoint (`x-api-key` header)
- **Socket.io middleware** validates JWT tokens or custom sessions
- **Biometric passkeys** (WebAuthn) for passwordless check-in
- **Anonymous chat auth** via Supabase anonymous sign-in
- **Keystore-signed APK** for Android release builds
- **HTTPS enforced** in production deployments

---

## 🔧 Environment Configuration

| Variable | Location | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | `config.ts` + `server-config.js` | Main Supabase project URL |
| `SUPABASE_ANON_KEY` | `config.ts` + `server-config.js` | Main Supabase anon key |
| `CHAT_SUPABASE_URL` | `config.ts` + `server-config.js` | Chat Supabase project URL |
| `CHAT_SUPABASE_ANON_KEY` | `config.ts` + `server-config.js` | Chat Supabase anon key |
| `SOCKET_URL` | `config.ts` | Socket.io server URL |
| `API_KEY` | `config.ts` + `server-config.js` | Background tracking API key |
| `VAPID_PUBLIC_KEY` | `config.ts` + `server-config.js` | Web Push public key |
| `VAPID_PRIVATE_KEY` | `server-config.js` | Web Push private key (server only) |
| `firebase-service-account.json` | `socket-server/` + `./` (root) | Firebase Admin SDK credentials for FCM |
| `google-services.json` | `android/app/` | Firebase Android config for push registration |
| `PORT` | `server-config.js` | Server port (default: 3001) |
| `FRONTEND_URL` | `server-config.js` | CORS origin for socket server |

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend (8080) + server (3001) concurrently |
| `npm run dev:web` | Start frontend only |
| `npm run dev:server` | Start server only |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |
| `npm run preview` | Preview production build |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) for the incredible BaaS platform
- [Capacitor](https://capacitorjs.com) for native mobile bridge
- [TanStack](https://tanstack.com) for React routing and query tools
- [Radix UI](https://radix-ui.com) for accessible headless components
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) for face detection
- [Leaflet](https://leafletjs.com) for open-source maps
- [Socket.io](https://socket.io) for real-time communication

---

> Built with ❤️ for workforce management. Deploy anywhere — Render, Vercel, Netlify, or your own VPS.
