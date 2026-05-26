# Quick Start: Socket.IO Live Location Fix

## What Was Wrong ❌
Only Nikhil showed as active because the Socket.IO server rejected authentication from employees using custom login (storing session in localStorage). Only Supabase JWT token users (like Nikhil) could connect.

## What's Fixed ✅
The Socket.IO server now accepts BOTH:
- **Supabase JWT tokens** (for `supabase.auth.signIn` users)
- **Custom session userId** (for employees with custom login)

## Files Changed
1. `server.js` - Enhanced authentication middleware + logging
2. `src/lib/socket-service.ts` - Support for userId parameter
3. `src/components/common/LiveTracker.tsx` - Detect auth method and pass correct credentials

## How to Test

### Option 1: Local Testing
```bash
# Terminal 1: Start Socket.IO server
node server.js

# Terminal 2: Start frontend (if not running)
npm run dev

# Then:
# 1. Login with custom credentials (non-Supabase)
# 2. Go to Field Tracking page
# 3. All employees should show green dots
# 4. Check browser console for "Socket connected successfully"
```

### Option 2: Check Server Logs
When users are online, you should see:
```
[Socket Auth] JWT verified for: <user_id>
[Location Update] User: <user_id>, Broadcasting to all clients
```

### Option 3: Quick Verification
1. Open `Field Tracking` page as Admin/Manager
2. Check if all logged-in employees have green status dots
3. Dots should update in real-time as they move

## Deployment

### For Render/Railway:
Just push to Git - auto-deploy will restart the Socket.IO server with new code

### For Local/Custom Hosting:
1. Pull latest changes
2. Restart `node server.js`
3. Users may need to refresh browser once

## Debugging

### If still not working:

**Check 1: Is Socket server running?**
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","message":"Socket.io server is running"}
```

**Check 2: Open browser console (F12) on Field Tracking page**
Look for messages like:
```
Attempting Socket connection to: http://localhost:3001
Socket connected successfully
Received batch locations: 5
```

Red errors? Check if:
- Socket URL is correct in `.env` (`VITE_SOCKET_URL`)
- Server is actually running
- Firewall isn't blocking port 3001

**Check 3: Database has data**
```sql
SELECT id, name, status FROM staff_tracking;
```

---

## FAQ

**Q: Do I need to restart anything?**  
A: Yes, restart the Socket.IO server (`node server.js`)

**Q: Will existing users be affected?**  
A: No, Supabase auth users (like Nikhil) continue working as before

**Q: When will I see the green dots?**  
A: Immediately after logging in and going to Field Tracking page

**Q: What if Socket connection fails?**  
A: App falls back to Supabase Realtime - locations still update, just slower

---

## Support

If employees still show as "offline":
1. Check if their device location permission is enabled
2. Ensure they're logged in (check profile shows in sidebar)
3. Check server logs for authentication errors
4. Verify `VITE_SOCKET_URL` points to correct server

See `SOCKET_IO_FIX_SUMMARY.md` for detailed technical info.
