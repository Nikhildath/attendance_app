# 🌟 Attendly Pro: The Ultimate Workforce Management Ecosystem

![Attendly Pro Banner](./public/banner.png)

**Attendly Pro** is a premium, high-performance attendance and field workforce management platform. Engineered for the modern distributed workforce, it goes far beyond simple clock-ins to provide a complete, interconnected suite for HR, payroll, and team management.

---

## ✨ Comprehensive Feature Breakdown

### 📸 AI-Powered Face Recognition Attendance
*The ultimate defense against buddy-punching and time theft.*
- **Biometric Verification**: Users must verify their identity using real-time facial recognition via `face-api.js` (ResNet-34) before marking attendance.
- **Passkey Support (Biometrics)**: Mobile users can register their device biometrics (Fingerprint/FaceID) via WebAuthn/Passkeys for rapid, secure attendance marking.
- **Paranoid Mode Security**: Implemented a strict 0.40 distance threshold and multi-frame consensus logic to prevent identity spoofing and family-member matching.
- **Admin Enrollment**: Face descriptors can only be registered and approved by an Administrator during the onboarding process.

### 🔔 Mobile-Native PWA & Push Notifications
*Stay connected even when the app is closed.*
- **Installable PWA**: Add Attendly to your home screen on iOS, Android, and Desktop for a full-screen, native-app experience.
- **Real-Time Push Alerts**: OS-level notifications for leave approvals, chat messages, and system updates.
- **Notification Opt-In**: Easy one-tap activation via the Topbar Bell icon.
- **Background Readiness**: Built-in support for service worker-based updates and offline-first performance.

### 📡 Real-Time Field Tracking & Geospatial Intelligence
*Complete visibility into your mobile workforce.*
- **Live Interactive Maps**: Plot staff locations on a live map in real-time using Leaflet and CartoDB Voyager.
- **Smart Zoom & Interaction**: Instant centering and zooming for precise tracking of mobile employees.
- **Telemetry Data**: Monitor device battery health, speed, and last-sync time directly from the map.
- **Geofence Protection**: Automatically flags records marked outside the office radius (configurable per branch).

### 🏢 Multi-Branch & Shift Management
*Scalable architecture for complex organizations.*
- **Geofenced Branches**: Define office locations with custom coordinates and tracking radii.
- **Dynamic Shift Engine**: Assign custom timings, late thresholds, and "Work on Holiday" overrides.
- **Holiday Syncing**: Automated integration with Google Calendar for local public holidays.

### 🗓️ Advanced HR & Payroll Workflows
*From attendance to payslip in one click.*
- **Leave & Comp-Off**: Full workflow for leave requests, approvals, and compensatory time off tracking.
- **Automated Fine Engine**: Calculates late fines based on shift thresholds and company policies.
- **One-Click Payroll**: Bulk-generate professional PDF payslips with automated deduction and OT logic.
- **Workforce Intelligence**: Detailed reports and trend charts for attendance rate and absenteeism.

### 💬 Premium Communication Hub
*Stand-alone, secure, and fully-featured team chat.*
- **WhatsApp-Style Interface**: Supports images, videos, files, and voice notes with native playback.
- **Data Retention Policy**: Mandatory 30-day auto-purge of messages for privacy and performance.
- **Channel Management**: Admin tools to create, edit, and manage team rooms with real-time sync.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, TanStack Router |
| **Backend** | Supabase (Postgres, Auth, Edge Functions) |
| **Styling** | Vanilla CSS, Tailwind, Framer Motion |
| **Maps & AI** | Leaflet.js, face-api.js (ResNet-34) |
| **Notification** | Web Push API, Service Workers |

---

## 🚀 Quick Start Guide

### 1. Installation
```bash
git clone <repository-url>
cd attendance-hub-pro-main
npm install --legacy-peer-deps
```

### 2. Environment Configuration
Create a `.env` file in the root:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GOOGLE_CALENDAR_API_KEY=your_google_calendar_key
```

### 3. Database Setup
Apply the latest `supabase_schema.sql` in the Supabase SQL Editor to provision all tables, RLS policies, and functions.

### 4. Development
```bash
npm run dev
```

This single command starts:
- the Vite frontend on `http://localhost:8080`
- the Node backend on `http://localhost:3001`

The frontend proxies `/api/*` requests to the backend automatically, so local push-notification send endpoints behave the same way they will on Render.

### 5. Single-Service Render Deployment
The app is now configured to run as one Render web service:
- `npm run build` builds the frontend into `dist`
- `npm run start` launches `server.js`
- `server.js` serves the frontend, Socket.IO, and push endpoints from the same host

Required Render environment variables:
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_CHAT_SUPABASE_URL=...
VITE_CHAT_SUPABASE_ANON_KEY=...
VITE_CHAT_STORAGE_BUCKET=chat-media
VITE_GOOGLE_CALENDAR_API_KEY=...
VITE_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
FRONTEND_URL=https://your-render-app.onrender.com
```

---

## 📄 License & Credits
Built with ❤️ for high-performance workforce management.
Licensed under the MIT License.

*Maintained by the Nikhil Dath team.*
