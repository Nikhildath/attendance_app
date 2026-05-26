# Quick Start Guide - Attendance Hub Pro Fixes

## 🚀 Get Started in 5 Minutes

### What Was Fixed
✅ Real-time field staff tracking with socket.io  
✅ Instant branch add/delete updates  
✅ Calendar data cleanup instructions  

---

## 1️⃣ Local Development (Frontend + Socket Server)

### Start Frontend
```bash
npm run dev
# Opens http://localhost:5173
```

### Start Socket Server (New Terminal)
```bash
npm run server:socket
# Server runs on http://localhost:3001
```

**That's it!** Your app now has real-time location tracking.

---

## 2️⃣ Test the Fixes

### A. Test Branch Operations
1. Login as Admin
2. Go to **Admin → Branches**
3. Click **Add Branch**
4. Fill details and click **Create Branch**
5. ✅ Branch appears immediately without page refresh
6. Click delete, confirm
7. ✅ Branch disappears instantly

### B. Test Field Tracking
1. Go to **Field Tracking**
2. Check top-right status indicator
3. If green → Socket.io connected ✅
4. If yellow → Using Supabase Realtime (fallback)
5. See staff locations update in real-time on map

### C. Clean Calendar Data
1. Go to Supabase Dashboard
2. Open `attendance` table
3. Delete any test records (they show as absent/late)
4. Calendar will now show clean data

---

## 3️⃣ Deploy Socket Server (Choose One)

### Option A: Render (Easiest)
```bash
1. Push code to GitHub
2. Go to render.com
3. Click "New" → "Web Service"
4. Connect your repo
5. Build Command: npm install
6. Start Command: node server.js
7. Add Env Variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - FRONTEND_URL=your-frontend-url
```

### Option B: Railway
1. Go to railway.app
2. Create new project → GitHub
3. Set environment variables
4. Deploy

### Option C: Local/VPS
```bash
npm install
npm run server:socket
# Keep terminal running
```

---

## 4️⃣ Update Frontend for Production

When deployed, update `.env`:

```env
VITE_SOCKET_URL=https://your-socket-server-url
FRONTEND_URL=https://your-frontend-url
```

---

## 📋 What Changed

### New Files
- `server.js` - Socket.io server
- `src/lib/socket-service.ts` - Socket client service
- `SOCKET_IO_SETUP.md` - Complete setup guide
- `FIXES_SUMMARY.md` - Detailed fixes
- `QUICK_START.md` - This file

### Modified Files
- `src/lib/branch-context.tsx` - Real-time updates
- `src/routes/admin.tsx` - Better branch handlers
- `src/routes/field-tracking.tsx` - Socket.io integration
- `package.json` - Added server scripts & dependencies

---

## 🔧 Common Commands

```bash
# Start frontend
npm run dev

# Start socket server locally
npm run server:socket

# Watch and restart on changes
npm run server:dev  # (requires: npm install -D nodemon)

# Build for production
npm run build

# Lint code
npm lint
```

---

## ⚙️ Environment Variables

```env
# Supabase (already configured)
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Socket.io (for real-time tracking)
VITE_SOCKET_URL=http://localhost:3001        # Dev
# OR
VITE_SOCKET_URL=https://your-server.onrender.com  # Prod

# Server config
FRONTEND_URL=http://localhost:5173   # Dev
# OR
FRONTEND_URL=https://your-frontend.vercel.app   # Prod

PORT=3001  # Server port
```

---

## 🐛 Troubleshooting

### Socket Connection Shows "Supabase Realtime"
- Check if socket server is running
- Verify `VITE_SOCKET_URL` is correct
- Check browser console for errors

### Branch Changes Not Showing
- Hard refresh page (Ctrl+Shift+R)
- Check browser console for errors
- Verify user has Admin role

### Calendar Shows Old Data
- Delete test records from Supabase `attendance` table
- Refresh page
- Real attendance data will load

### Socket Server Won't Start
```bash
# Check if port 3001 is in use
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Kill process or use different port
PORT=3002 npm run server:socket
```

---

## 📊 Architecture

```
┌─────────────────────────────────────┐
│      Field Staff (Mobile App)       │
│  Sends: location, battery, speed    │
└────────────┬────────────────────────┘
             │
             ├─→ Socket.io Server ─────┬─→ Broadcasts to Admins
             │                        │
             └─→ Supabase Database ───┘

┌──────────────────────────────┐
│   Admin (Web Dashboard)       │
│   - Real-time staff locations │
│   - Branch management         │
│   - Attendance calendar       │
└──────────────────────────────┘
```

---

## ✅ Verification Checklist

- [ ] Socket server runs on localhost:3001
- [ ] Frontend connects to socket at http://localhost:3001
- [ ] Branch add/delete works instantly
- [ ] Field tracking shows staff on map in real-time
- [ ] Calendar shows clean data (no test records)
- [ ] Connection indicator shows Socket.io or Supabase
- [ ] Environment variables are set correctly

---

## 📚 Full Documentation

- **Socket Setup**: See `SOCKET_IO_SETUP.md`
- **All Fixes**: See `FIXES_SUMMARY.md`
- **Database**: See `SUPABASE_SETUP.md`

---

## 🆘 Need Help?

1. Check console for errors (F12)
2. Verify environment variables
3. Ensure Supabase is configured
4. Check server is running
5. Review docs in repo

**Happy tracking! 🚀**
