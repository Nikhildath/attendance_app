# Real-Time Location Tracking Setup Guide

This document explains how to set up and deploy the real-time location tracking system with socket.io support.

## Overview

The attendance hub now supports two real-time tracking mechanisms:

1. **Socket.io** (Primary) - High-frequency location updates, more efficient for real-time tracking
2. **Supabase Realtime** (Fallback) - If socket.io server is unavailable, automatically falls back to Supabase

## Prerequisites

- Node.js 16+ (for running the socket server)
- Supabase project with proper tables (`staff_tracking`, `profiles`)
- Frontend deployed on a web server

## Local Development Setup

### 1. Frontend Setup

```bash
# Install dependencies
npm install

# Add environment variables
# Update .env file with:
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SOCKET_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```

### 2. Start Frontend

```bash
npm run dev
# Frontend will run on http://localhost:5173
```

### 3. Socket.io Server Setup

```bash
# The server.js file is pre-configured with socket.io server
# To run the server locally:
node server.js

# Or with auto-restart on changes (install nodemon first):
npm install -D nodemon
npx nodemon server.js
```

The server will start on `http://localhost:3001`

## Deployment Options

### Option 1: Deploy on Render (Recommended)

1. **Create a Render Account**
   - Go to [render.com](https://render.com)
   - Sign in with GitHub

2. **Create New Web Service**
   - Click "New +" > "Web Service"
   - Connect your repository
   - Build Command: `npm install && npm install express cors dotenv socket.io`
   - Start Command: `node server.js`

3. **Set Environment Variables**
   In Render dashboard, add:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   FRONTEND_URL=https://your-frontend-url.vercel.app (or Netlify URL)
   PORT=3001
   ```

4. **Update Frontend Environment**
   - After deployment, update your frontend `.env`:
   ```
   VITE_SOCKET_URL=https://your-socket-server.onrender.com
   ```

### Option 2: Deploy on Railway

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Connect GitHub repository

2. **Configure Service**
   - Build Command: `npm install && npm install express cors dotenv socket.io`
   - Start Command: `node server.js`

3. **Add Environment Variables**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `FRONTEND_URL`

### Option 3: Deploy on Heroku

```bash
# Create Procfile in root directory
echo "web: node server.js" > Procfile

# Deploy using Heroku CLI
heroku create your-app-name
heroku config:set VITE_SUPABASE_URL=your-url
heroku config:set VITE_SUPABASE_ANON_KEY=your-key
heroku config:set FRONTEND_URL=https://your-frontend-url
git push heroku main
```

## Frontend Configuration

### Update .env for Production

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_SOCKET_URL=https://your-socket-server.onrender.com
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

### How It Works

1. **Connection Flow**
   - Frontend connects to socket.io server
   - Server authenticates using Supabase token
   - All connections are authenticated before data transfer

2. **Real-Time Location Updates**
   - Mobile/field staff app sends location updates to socket server
   - Socket server broadcasts to all connected admins
   - Supabase database is updated automatically
   - Map updates in real-time

3. **Fallback Mechanism**
   - If socket server is down, frontend automatically switches to Supabase Realtime
   - Supabase Realtime uses WebSockets (slightly less frequent updates)
   - Application remains functional with or without socket.io

## Database Setup

Ensure these tables exist in Supabase:

```sql
-- Staff Tracking Table
CREATE TABLE staff_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  battery INTEGER DEFAULT 100,
  speed_kmh DECIMAL(5, 2),
  accuracy DECIMAL(5, 2),
  current_task TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('active', 'idle', 'offline')),
  last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE staff_tracking ENABLE ROW LEVEL SECURITY;

-- Allow users to see own tracking data
CREATE POLICY "Users can view own tracking" ON staff_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- Allow admins to see all
CREATE POLICY "Admins can view all tracking" ON staff_tracking
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );

-- Allow admins to update
CREATE POLICY "Admins can update tracking" ON staff_tracking
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );
```

## Monitoring

### Health Check Endpoint

```bash
curl https://your-socket-server.onrender.com/health
# Response: { "status": "ok", "message": "Socket.io server is running" }
```

### Logs

- **Render**: View logs in dashboard
- **Railway**: Railway dashboard > Deployments > Logs
- **Local**: Console output from `node server.js`

## Troubleshooting

### Socket.io Not Connecting

**Issue**: Frontend shows "Supabase Realtime" instead of "Socket.io"

**Solution**:
1. Check if socket server is running
2. Verify `VITE_SOCKET_URL` in .env
3. Check CORS settings in server.js
4. Verify Supabase token is valid

### Location Updates Not Appearing

**Issue**: Staff locations not updating on the map

**Solution**:
1. Check if staff are sending location updates
2. Verify Supabase `staff_tracking` table has data
3. Check browser console for errors
4. Ensure user has permission to read/write tracking data

### CORS Errors

**Issue**: "Origin not allowed" error

**Solution**:
Update server.js with correct frontend URL:
```javascript
const io = new Server(httpServer, {
  cors: {
    origin: 'https://your-actual-frontend-url.com',
    credentials: true,
  },
});
```

## Mobile Implementation

For mobile field staff to send location updates:

```typescript
// Pseudo-code for mobile implementation
const locationUpdate = {
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  battery: navigator.getBattery().level,
  speed: position.coords.speed,
  accuracy: position.coords.accuracy,
  task: currentTask,
  status: isWorking ? 'active' : 'idle'
};

socketService.updateLocation(locationUpdate);
```

## Performance Tips

1. **Location Update Frequency**
   - Adjust update interval based on requirements
   - High frequency (every 5s): More accurate but higher bandwidth
   - Low frequency (every 30s): Less bandwidth but less accurate

2. **Marker Clustering**
   - For many staff members (>100), implement marker clustering on map
   - Reduces map rendering performance issues

3. **Caching**
   - Server caches location data in memory
   - Reduces database queries
   - Trades memory for performance

## Security Considerations

1. **Authentication**
   - All socket connections require valid Supabase JWT token
   - Tokens are verified before processing data

2. **Data Protection**
   - Use RLS policies to prevent unauthorized access
   - Only admins can see all staff locations
   - Staff can only see their own location

3. **HTTPS/WSS**
   - Always use HTTPS/WSS in production
   - Never use HTTP/WS for sensitive data

## Next Steps

1. Deploy socket.io server on Render/Railway
2. Update frontend `.env` with production socket URL
3. Test location tracking in field
4. Monitor logs for any errors
5. Configure alerts for offline status

For more help, check the Supabase documentation or socket.io docs.
