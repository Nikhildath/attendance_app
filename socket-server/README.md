# Socket.IO Server - Standalone Deployment

This folder contains the Socket.IO server for real-time location tracking.

## How It Works

The Socket.IO server:
- Handles real-time location updates from field staff
- Broadcasts locations to admins/managers
- Authenticates users via Supabase
- Saves data to Supabase database

## Local Testing

```bash
# Install dependencies
npm install

# Start server
npm start
# or with auto-reload
npm run dev

# Test health endpoint
curl http://localhost:3001/health
```

## Deployment on Render

### Option 1: Deploy Socket Server Separately on Render

1. **Create new GitHub repo for just this folder** (or use as subdirectory)
2. Go to https://render.com
3. Click "New +" → "Web Service"
4. Select your repo
5. Choose this `socket-server` folder as the root
6. Set environment variables:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   FRONTEND_URL=https://your-frontend-domain.com
   ```
7. Deploy!

Your Socket server URL will be: `https://attendance-socket-server.onrender.com`

### Option 2: Deploy with Main Repo

If keeping Socket server in same repo:
1. Configure Render to use `socket-server` folder as root
2. Point `FRONTEND_URL` to where your React app is deployed

## Environment Variables

Required:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
- `FRONTEND_URL` - Where your React frontend is deployed

Optional:
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode (default: production)

## Verify Deployment

After deployment, check health:
```bash
curl https://your-socket-server.onrender.com/health
# Should return: {"status":"ok","message":"Socket.io server is running"}
```

## Update Frontend

After deploying the Socket server, update your frontend `.env`:
```env
VITE_SOCKET_URL=https://your-socket-server.onrender.com
```

Then redeploy your frontend with the new Socket URL.

## Monitoring

Check logs in Render Dashboard:
- Go to your service
- Click "Logs" tab
- Look for "Socket.io server running on port 3001"

## Troubleshooting

**Socket connection fails:**
- Check FRONTEND_URL matches your deployed frontend
- Verify Supabase credentials are correct
- Check browser console for connection errors

**Employees show as offline:**
- Verify Supabase staff_tracking table has entries
- Check server logs for authentication errors
- Ensure geolocation permission granted in browser

**Server keeps crashing:**
- Check Supabase credentials are valid
- View Render logs for error messages
- Upgrade to paid Render plan if memory exceeded
