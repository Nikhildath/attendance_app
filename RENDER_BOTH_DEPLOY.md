# 🚀 Deploy Both Frontend & Socket on Render (Easy!)

Render automatically reads `render.yaml` and deploys both services!

---

## 📋 Step-by-Step

### Step 1: Connect GitHub to Render
1. Go to **https://render.com**
2. Click **"New +"** → **"BluePrint"**
3. Select your GitHub repo
4. Render auto-reads `render.yaml`

### Step 2: Render Shows You Both Services
```
✅ attendance-socket-server  (Node.js)
✅ attendance-frontend        (Static Site)
```

### Step 3: Set Environment Variables

Render will ask for these. Fill them in:

**For Socket Server:**
```
VITE_SUPABASE_URL = https://rrooywngvlmssikmzgse.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
FRONTEND_URL = https://attendance-frontend.onrender.com
```

**For Frontend:**
```
VITE_SUPABASE_URL = https://rrooywngvlmssikmzgse.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SOCKET_URL = https://attendance-socket-server.onrender.com
```

### Step 4: Click "Deploy"
- Both services deploy automatically
- Takes 3-5 minutes
- Both get their own URLs

### Step 5: You're Done! 🎉

```
Frontend: https://attendance-frontend.onrender.com
Socket:   https://attendance-socket-server.onrender.com
```

---

## ⚙️ What Render Does Automatically

| Service | Build | Start | Type |
|---------|-------|-------|------|
| **Socket** | `npm install` | `npm start` | Node.js Web |
| **Frontend** | `npm install && npm run build` | (static) | Static Site |

(All defined in `render.yaml`)

---

## 📝 render.yaml Breakdown

```yaml
services:
  # Service 1: Socket Server
  - type: web              # Node.js web service
    name: attendance-socket-server
    runtime: node
    rootDir: socket-server # Looks for /socket-server
    buildCommand: npm install
    startCommand: npm start
    
  # Service 2: Frontend
  - type: static_site      # Just HTML/JS
    name: attendance-frontend
    buildCommand: npm install && npm run build
    staticPublishPath: dist # Publishes /dist folder
```

✅ Already configured for you!

---

## ✅ Environment Variables Explained

### Socket Server needs to know:
```
VITE_SUPABASE_URL       → Database location
VITE_SUPABASE_ANON_KEY  → Database password
FRONTEND_URL            → Where frontend is hosted
```

### Frontend needs to know:
```
VITE_SUPABASE_URL       → Database location
VITE_SUPABASE_ANON_KEY  → Database password
VITE_SOCKET_URL         → Where socket server is
```

---

## 🔗 They Auto-Connect

Once deployed, they'll communicate via:
- **Frontend** → calls **Socket** via `VITE_SOCKET_URL`
- **Socket** → calls **Supabase** via `VITE_SUPABASE_URL`
- Both ← save to **Supabase**

---

## 💾 After Deployment

Every time you push to GitHub:
```bash
git push origin main
```

Render auto-redeploys both! ✅

---

## 🧪 Test After Deployment

1. Go to `https://attendance-frontend.onrender.com`
2. Log in
3. Go to **Field Tracking**
4. You should see green dots

### If it doesn't work:
- Check Socket URL in browser console (F12)
- Verify `/health` endpoint: `https://attendance-socket-server.onrender.com/health`
- Check logs in Render dashboard

---

## 📊 Both Services Together

```
┌──────────────────────────────────┐
│  Render Blueprint (render.yaml)  │
├──────────────────────────────────┤
│ 1. Socket Server (port 3001)     │
│    └─ Node.js Web Service        │
│    └─ Auto-restarts on crash     │
│                                  │
│ 2. Frontend (Static Site)        │
│    └─ React built app            │
│    └─ Served via CDN             │
└──────────────────────────────────┘
```

---

## 💰 Monthly Cost on Render

| Service | Free Tier | Starter |
|---------|-----------|---------|
| Socket Server | $0 (sleeps after 15 min) | $7/month |
| Frontend | $0 (sleeps after 15 min) | $7/month |
| **Both** | **$0** | **$14/month** |

> **Tip:** Free tier works fine for testing. Upgrade to Starter if you want 24/7 uptime.

---

## 🎯 Summary

✅ Both services in one GitHub repo  
✅ One `render.yaml` file configures both  
✅ Render deploys both automatically  
✅ Auto-connects via environment variables  
✅ Auto-redeploys on every git push  
✅ Both get unique URLs  

**You don't need separate Vercel or Railway!** 🎉

---

## Next Steps

1. ✅ Push to GitHub
2. ✅ Go to Render.com → New Blueprint
3. ✅ Select repo → auto-reads render.yaml
4. ✅ Fill environment variables
5. ✅ Click Deploy
6. ✅ Wait 3-5 minutes
7. ✅ Done! Both services live 🚀
