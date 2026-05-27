// Real-time Location Tracking Server using Socket.io
// This server handles real-time location updates for field staff
// Deploy on Render, Railway, or any Node.js hosting platform

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import webPush from 'web-push';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  PORT,
  FRONTEND_URL,
  API_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
} from '../server-config.js';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT || 'mailto:support@attendly.local', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('[Push] VAPID keys are not configured. Web push delivery is disabled.');
}

// Firebase Admin SDK (optional — enables FCM for native push when app is killed)
let fcmAvailable = false;
try {
  const fcmKeyPath = resolve('firebase-service-account.json');
  const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (existsSync(fcmKeyPath)) {
    const serviceAccount = JSON.parse(readFileSync(fcmKeyPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    fcmAvailable = true;
    console.log('[FCM] Firebase Admin initialized from file.');
  } else if (envServiceAccount) {
    const serviceAccount = JSON.parse(Buffer.from(envServiceAccount, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    fcmAvailable = true;
    console.log('[FCM] Firebase Admin initialized from environment variable.');
  } else {
    console.warn('[FCM] Firebase Service Account not found. Native FCM push disabled.');
  }
} catch (e) {
  console.warn('[FCM] Failed to initialize Firebase Admin:', e.message);
}

async function sendFcmPush(token, payload) {
  if (!fcmAvailable) return;
  try {
    await admin.messaging().send({
      token,
      data: payload.data || {},
      notification: {
        title: payload.title || 'Incoming Call',
        body: payload.body || '',
      },
      android: {
        priority: 'high',
        ttl: 0, 
        notification: {
          channelId: 'incoming_calls',
          priority: 'max',
          sound: 'ringtone',
          vibrationPattern: [200, 100, 200, 100, 200, 100, 200],
          color: '#22c55e',
          sticky: true,
          visibility: 'public',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'ringtone',
            category: 'INCOMING_CALL',
            'content-available': 1,
            priority: 10,
          },
        },
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          vibrate: [200, 100, 200, 100, 200],
          requireInteraction: true,
          actions: payload.actions || [],
          tag: payload.data?.roomId || 'call',
        },
        fcmOptions: { link: payload.data?.url || '' },
      },
    });
    console.log('[FCM] High-priority call push sent');
  } catch (err) {
    console.warn('[FCM] Send failed:', err.message);
    if (err.errorInfo?.code === 'messaging/registration-token-not-registered') {
      return false;
    }
  }
  return true;
}

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Initialize Supabase client
const supabase = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || ''
);

// Rate limiter for background location endpoint
const locationLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 20, // raised — native plugin + Java service may both post simultaneously
  keyGenerator: (req) => req.headers['x-user-id'] || req.body?.userId || req.ip,
  message: { error: 'Too many location updates. Please slow down.' },
  validate: { xForwardedForHeader: false },
});

app.use(cors());
app.use(express.json());

// Root endpoint — show live server status when visited in browser
app.get('/', (req, res) => {
  const uptime = Math.floor(process.uptime());
  const hours = Math.floor(uptime / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const secs = uptime % 60;

  const totalSockets = io.engine?.clientsCount || 0;
  const connectedUserIds = [...connectedUsers.keys()].slice(0, 20);
  const connectedCount = connectedUsers.size;

  // Collect active Socket.IO rooms (video rooms)
  const allRooms = io.sockets?.adapter?.rooms;
  const videoRooms = [];
  if (allRooms) {
    allRooms.forEach((sockets, room) => {
      const isSocketId = room.length < 25 && /^[A-Za-z0-9_-]+$/.test(room);
      const isUserRoom = connectedUserIds.includes(room);
      if (!isSocketId && !isUserRoom) videoRooms.push(room);
    });
  }

  const userList = connectedUserIds.length
    ? connectedUserIds.map(id => `<span class="tag blue" style="margin:2px">${id.slice(0, 8)}</span>`).join('')
    : '<span style="color:#64748b">None</span>';

  const roomList = videoRooms.length
    ? videoRooms.map(r => `<div style="margin:4px 0; font-size:0.85rem;">📞 <code>${r.slice(0, 30)}...</code></div>`).join('')
    : '<span style="color:#64748b">None</span>';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Attendly Socket Server</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta http-equiv="refresh" content="10">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 680px; margin: 40px auto; padding: 0 20px; background: #0f172a; color: #e2e8f0; }
        h1 { color: #22c55e; font-size: 1.8rem; }
        .card { background: #1e293b; border-radius: 12px; padding: 20px; margin: 16px 0; }
        .card h2 { margin: 0 0 12px 0; font-size: 1.1rem; }
        .tag { display: inline-block; background: #22c55e20; color: #22c55e; padding: 2px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; margin-right: 6px; }
        .tag.blue { background: #3b82f620; color: #60a5fa; }
        .tag.purple { background: #a855f720; color: #c084fc; }
        dt { font-weight: 600; color: #94a3b8; margin-top: 12px; font-size: 0.85rem; }
        dd { margin-left: 0; margin-top: 2px; }
        a { color: #60a5fa; }
        .num { font-size: 2rem; font-weight: 800; color: #22c55e; }
        .num-label { color: #64748b; font-size: 0.8rem; }
        .stat-row { display: flex; gap: 24px; flex-wrap: wrap; }
        .stat { text-align: center; min-width: 80px; }
        .ref { text-align: center; color: #475569; font-size: 0.75rem; margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <h1>Attendly Socket Server</h1>
      <p style="color: #94a3b8; margin-top: -8px;">Real-time engine</p>
      <div class="ref">Auto-refreshes every 10s</div>

      <div class="card">
        <h2>Live Now</h2>
        <div class="stat-row">
          <div class="stat"><div class="num">${totalSockets}</div><div class="num-label">Socket Connections</div></div>
          <div class="stat"><div class="num">${connectedCount}</div><div class="num-label">Connected Users</div></div>
          <div class="stat"><div class="num">${videoRooms.length}</div><div class="num-label">Active Calls</div></div>
        </div>
        <div style="margin-top:8px; color:#94a3b8; font-size:0.9rem;">
          Uptime: ${hours}h ${mins}m ${secs}s
        </div>
      </div>

      <div class="card">
        <h2>Active Video Calls</h2>
        ${roomList}
      </div>

      <div class="card">
        <h2>Connected Users (${connectedCount})</h2>
        <div>${userList}</div>
      </div>

      <div class="card">
        <h2>Services</h2>
        <dt>Live Location Tracking</dt>
        <dd style="color:#94a3b8; font-size:0.9rem;">Field staff GPS positions.</dd>
        <dt>Direct Video Calls</dt>
        <dd style="color:#94a3b8; font-size:0.9rem;">WebRTC signaling relay for one-to-one calls.</dd>
        <dt>Push Notifications</dt>
        <dd style="color:#94a3b8; font-size:0.9rem;">
          Web Push + FCM for incoming calls.<br>
          <span class="tag">FCM ${fcmAvailable ? 'Connected' : 'Not configured'}</span>
          <span class="tag blue">Web Push</span>
        </dd>
      </div>

      <div class="card">
        <h2>Endpoints</h2>
        <span class="tag purple">GET</span> <a href="/health">/health</a> — Health check<br>
        <span class="tag purple" style="margin-top:6px; display:inline-block;">POST</span> /api/location — Background location (requires API key)
      </div>

      <div style="text-align:center; color:#475569; font-size:0.8rem; margin-top:24px;">
        Powered by Socket.IO &middot; Deployed on Render
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), message: 'Socket.io server is running' });
});

// Background location update endpoint (used by native geolocation plugin when app is in background/killed)
app.post('/api/location', locationLimiter, async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const body = req.body || {};

    // Accept userId from body OR from x-user-id header (sent by @capacitor-community/background-geolocation)
    const userId = body.userId || req.headers['x-user-id'];

    // Accept lat/lng OR latitude/longitude (community plugin sends the latter)
    const lat = body.lat != null ? body.lat : body.latitude;
    const lng = body.lng != null ? body.lng : body.longitude;

    const battery = body.battery;
    const speed   = body.speed;
    const accuracy = body.accuracy;
    const task    = body.task;
    const status  = body.status;
    const deviceInfo = body.deviceInfo;

    if (!userId || lat == null || lng == null) {
      return res.status(400).json({ error: 'userId, lat, and lng are required' });
    }

    console.log(`[HTTP Location] User: ${userId}, Lat: ${lat}, Lng: ${lng}`);

    const deviceModel = deviceInfo ? deviceInfo.split(' | ')[0] || null : null;
    const deviceOs = deviceInfo ? deviceInfo.split(' | ')[1]?.split(' ')[0] || null : null;
    const deviceOsVersion = deviceInfo ? deviceInfo.split(' | ')[1]?.split(' ').slice(1).join(' ') || null : null;

    try {
      const { error: rpcError } = await supabase.rpc('upsert_staff_tracking', {
        p_id: userId,
        p_lat: lat,
        p_lng: lng,
        p_battery: battery || 0,
        p_speed_kmh: speed || 0,
        p_accuracy: accuracy || 0,
        p_current_task: task || 'Tracking in background',
        p_status: status || 'active',
        p_device_model: deviceModel,
        p_device_os: deviceOs,
        p_device_os_version: deviceOsVersion,
      });

      if (rpcError) {
        console.error(`[HTTP Location] RPC error:`, rpcError.message);
        await supabase.from('staff_tracking').upsert(
          { user_id: userId, lat, lng, battery: battery || 0, speed_kmh: speed || 0, accuracy: accuracy || 0, current_task: task || 'Tracking in background', status: status || 'active', last_update: new Date().toISOString(), device_model: deviceModel, device_os: deviceOs, device_os_version: deviceOsVersion },
          { onConflict: 'user_id' }
        );
      }
    } catch (dbError) {
      console.error(`[HTTP Location] DB error:`, dbError.message);
    }

    const update = {
      id: userId,
      lat: Number(lat),
      lng: Number(lng),
      battery: battery || 0,
      speed: speed || 0,
      accuracy: accuracy || 0,
      task: task || 'Tracking in background',
      status: status || 'active',
      lastUpdate: new Date().toISOString(),
      deviceInfo: deviceInfo || '',
    };
    io.emit('staff_location_update', update);

    return res.json({ ok: true });
  } catch (error) {
    console.error('[HTTP Location] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Store connected users and their locations
const connectedUsers = new Map();
const locationCache = new Map();

// Authenticate socket connection with support for both Supabase JWT and custom sessions
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const userId = socket.handshake.auth.userId; // For custom session fallback
    
    console.log(`[Socket Auth] Connection attempt. Token: ${!!token}, UserId: ${!!userId}`);
    
    // Try JWT verification first (for Supabase auth users)
    if (token) {
      try {
        const { data, error } = await supabase.auth.getUser(token);
        
        if (!error && data.user) {
          socket.userId = data.user.id;
          socket.user = data.user;
          socket.authType = 'jwt';
          console.log(`[Socket Auth] JWT verified for: ${socket.userId}`);
          return next();
        } else {
          console.warn(`[Socket Auth] JWT verification failed: ${error?.message || 'No user found'}`);
        }
      } catch (jwtError) {
        console.warn(`[Socket Auth] JWT verification exception:`, jwtError.message);
      }
    }
    
    // Fallback: Accept custom session with userId
    if (userId) {
      try {
        // Use RPC to bypass RLS (profiles table has RLS on auth.uid())
        const { data: profile, error } = await supabase
          .rpc('lookup_profile_for_auth', { p_user_id: userId })
          .maybeSingle();
        
        if (!error && profile) {
          socket.userId = userId;
          socket.user = profile;
          socket.authType = 'custom';
          console.log(`[Socket Auth] Custom session verified for: ${socket.userId}`);
          return next();
        } else {
          console.warn(`[Socket Auth] Custom session verification failed: user ${userId} not found`);
        }
      } catch (rpcError) {
        console.warn(`[Socket Auth] RPC lookup failed, falling back to direct query:`, rpcError.message);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, name, email')
          .eq('id', userId)
          .maybeSingle();
        
        if (!error && profile) {
          socket.userId = userId;
          socket.user = profile;
          socket.authType = 'custom';
          return next();
        }
      }
    }
    
    console.error('[Socket Auth] Authentication failed: no valid token or userId');
    next(new Error('Authentication required: provide token or userId'));
  } catch (error) {
    console.error('[Socket Auth] Unexpected error:', error);
    next(new Error('Authentication error: ' + error.message));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);
  connectedUsers.set(socket.userId, socket.id);
  socket.join(socket.userId); // Join personal room for direct messaging

  // Request all staff locations
  socket.on('request_staff_locations', async () => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, role');

      const { data: tracking } = await supabase
        .from('staff_tracking')
        .select('*');

      const locations = profiles?.map(p => {
        const t = tracking?.find(tr => tr.user_id === p.id);
        const deviceParts = [t?.device_model, t?.device_os && t?.device_os_version ? `${t.device_os} ${t.device_os_version}` : t?.device_os].filter(Boolean);
        return {
          id: p.id,
          name: p.name,
          lat: Number(t?.lat || 12.9716),
          lng: Number(t?.lng || 77.5946),
          battery: t?.battery || 0,
          speed: Number(t?.speed_kmh || 0),
          task: t?.current_task || 'No active task',
          status: t?.status || 'offline',
          lastUpdate: t?.last_update || new Date().toISOString(),
          accuracy: t?.accuracy || 0,
          deviceInfo: deviceParts.length ? deviceParts.join(' | ') : '',
        };
      }) || [];

      socket.emit('staff_locations', locations);
      locations.forEach(loc => locationCache.set(loc.id, loc));
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  });

  // Receive location update from field staff
  socket.on('location_update', async (data) => {
    try {
      const { userId, lat, lng, battery, speed, accuracy, task, status, deviceInfo } = data;
      
      console.log(`[Location Update] User: ${socket.userId}, Payload UserId: ${userId}, Data:`, { lat, lng, battery, status });

      // Validate userId matches authenticated socket user
      if (userId !== socket.userId) {
        console.warn(`[Location Update] userId mismatch: ${userId} vs ${socket.userId}`);
        return;
      }

      // Check if this is a new user starting to track
      const isNewUser = !locationCache.has(userId);
      
      // Update location cache
      const existing = locationCache.get(userId) || {};
      const updated = {
        id: userId,
        ...existing,
        lat,
        lng,
        battery,
        speed: speed || 0,
        accuracy: accuracy || 0,
        task: task || existing.task || 'No active task',
        status: status || existing.status || 'active',
        lastUpdate: new Date().toISOString(),
        deviceInfo: deviceInfo || existing.deviceInfo || '',
      };
      locationCache.set(userId, updated);
      
      // Broadcast staff_connected for new trackers so all clients add them
      if (isNewUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, name, role, branch_id, avatar_url')
          .eq('id', userId)
          .maybeSingle();
        if (profile) {
          io.emit('staff_connected', {
            ...profile,
            lat, lng, battery,
            speed: speed || 0,
            accuracy: accuracy || 0,
            task: task || 'No active task',
            status: status || 'active',
            lastUpdate: updated.lastUpdate,
            deviceInfo: deviceInfo || '',
          });
        }
      }
      
      console.log(`[Location Update] Broadcasting to all clients:`, updated);

      const deviceModel = deviceInfo ? deviceInfo.split(' | ')[0] || null : null;
      const deviceOs = deviceInfo ? deviceInfo.split(' | ')[1]?.split(' ')[0] || null : null;
      const deviceOsVersion = deviceInfo ? deviceInfo.split(' | ')[1]?.split(' ').slice(1).join(' ') || null : null;

      // Update Supabase (use RPC to bypass RLS)
      try {
        const { error: rpcError } = await supabase.rpc('upsert_staff_tracking', {
          p_id: userId,
          p_lat: lat,
          p_lng: lng,
          p_battery: battery,
          p_speed_kmh: speed || 0,
          p_accuracy: accuracy || 0,
          p_current_task: task || '',
          p_status: status || 'active',
          p_device_model: deviceModel,
          p_device_os: deviceOs,
          p_device_os_version: deviceOsVersion,
        });
        
        if (rpcError) {
          console.warn(`[Location Update] RPC failed, falling back to direct upsert:`, rpcError.message);
          const { error: upsertError } = await supabase
            .from('staff_tracking')
            .upsert(
              {
                user_id: userId,
                lat,
                lng,
                battery,
                speed_kmh: speed,
                accuracy,
                current_task: task,
                status: status || 'active',
                last_update: new Date().toISOString(),
                device_model: deviceModel,
                device_os: deviceOs,
                device_os_version: deviceOsVersion,
              },
              { onConflict: 'user_id' }
            );
          
          if (upsertError) {
            console.error(`[Location Update] Supabase upsert error:`, upsertError);
          }
        }
      } catch (rpcError) {
        console.error(`[Location Update] RPC exception:`, rpcError.message);
      }

      // Broadcast to all connected clients
      io.emit('staff_location_update', updated);
    } catch (error) {
      console.error('[Location Update] Error:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
    connectedUsers.delete(socket.userId);
    locationCache.delete(socket.userId);
    io.emit('staff_disconnected', { userId: socket.userId });
  });

  // Handle status change
  socket.on('status_change', async (data) => {
    try {
      const { status } = data;
      
      // Update Supabase
      await supabase
        .from('staff_tracking')
        .update({ status })
        .eq('user_id', socket.userId);

      // Broadcast to all
      io.emit('staff_status_change', {
        userId: socket.userId,
        status,
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  });

  // ===================== CHAT EVENTS =====================

  // Join a chat room
  socket.on('chat:join_room', (roomId) => {
    if (!socket.userId || !roomId) return;
    socket.join(roomId);
    console.log(`💬 User ${socket.userId} joined chat room: ${roomId}`);
  });

  // Leave a chat room
  socket.on('chat:leave_room', (roomId) => {
    if (!roomId) return;
    socket.leave(roomId);
    console.log(`💬 User ${socket.userId} left chat room: ${roomId}`);
  });

  // Send a chat message (broadcast to room after sender persists to DB)
  socket.on('chat:send_message', (data) => {
    if (!socket.userId || !data?.room_id) return;

    // Broadcast the message to everyone in the room (including sender, who ignores their own)
    io.to(data.room_id).emit('chat:new_message', data);
  });

  // Typing indicator
  socket.on('chat:typing', (data) => {
    if (!socket.userId || !data?.roomId) return;

    // Broadcast to everyone in the room EXCEPT the sender
    socket.to(data.roomId).emit('chat:typing', {
      roomId: data.roomId,
      userId: socket.userId,
      username: data.username || 'Someone',
    });
  });

  // ===================== VIDEO CALL EVENTS =====================

  // Join a video meeting room
  socket.on('video:join-room', (data) => {
    if (!socket.userId || !data?.roomId) return;
    socket.join(data.roomId);
    console.log(`🎥 User ${socket.userId} joined video room: ${data.roomId}`);
    socket.to(data.roomId).emit('video:user-joined', {
      userId: socket.userId,
      name: data.name || 'Unknown',
    });
  });

  // Leave a video meeting room
  socket.on('video:leave-room', (data) => {
    if (!data?.roomId) return;
    socket.leave(data.roomId);
    socket.to(data.roomId).emit('video:user-left', {
      userId: socket.userId,
    });
    console.log(`🎥 User ${socket.userId} left video room: ${data.roomId}`);
  });

  // WebRTC signal forwarding
  socket.on('video:signal', (data) => {
    if (!socket.userId || !data?.to || !data?.signal) return;
    io.to(data.to).emit('video:signal', {
      from: socket.userId,
      signal: data.signal,
      name: data.name || 'Unknown',
    });
  });

  // Direct call initiation
  socket.on('video:direct-call', async (data) => {
    if (!socket.userId || !data?.to) return;

    // Always emit to socket if callee is connected
    io.to(data.to).emit('video:incoming-call', {
      from: socket.userId,
      name: data.name || 'Unknown',
      roomId: data.roomId,
    });

    // Send push notification for background/closed app
    try {
      const { data: tokens } = await supabase
        .from('user_push_tokens')
        .select('token, subscription_json, platform')
        .eq('user_id', data.to);

      if (tokens && tokens.length > 0) {
        const callUrl = `/meetings?call=incoming&room=${data.roomId}&from=${socket.userId}&name=${encodeURIComponent(data.name || 'Unknown')}`;

        const payload = {
          title: 'Incoming Call',
          body: `${data.name || 'Someone'} is calling you`,
          data: {
            url: callUrl,
            type: 'call',
            callerName: data.name || 'Unknown',
            callerId: socket.userId,
            roomId: data.roomId,
          },
          actions: [
            { action: 'accept', title: 'Accept' },
            { action: 'reject', title: 'Decline' },
          ],
        };

        for (const t of tokens) {
          try {
            if (t.platform === 'web' && t.subscription_json) {
              const webPayload = JSON.stringify({ ...payload, icon: '/icon-192.png', badge: '/favicon.ico', vibrate: [200, 100, 200, 100, 200], tag: `call-${data.roomId}`, renotify: true, requireInteraction: true, silent: false });
              await webPush.sendNotification(t.subscription_json as any, webPayload);
            } else if ((t.platform === 'android' || t.platform === 'ios') && t.token) {
              const valid = await sendFcmPush(t.token, payload);
              if (valid === false) {
                await supabase.from('user_push_tokens').delete().eq('token', t.token);
              }
            }
          } catch (pushErr) {
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await supabase.from('user_push_tokens').delete().eq('token', t.token);
            }
            console.warn(`[Push] Failed to send to ${t.platform}:${(t.token || '').slice(0, 20)}...`, pushErr.message);
          }
        }
      }
    } catch (dbErr) {
      console.error('[Push] Error fetching tokens or sending:', dbErr.message);
    }
  });

  // Call ended
  socket.on('video:end-call', (data) => {
    if (!data?.to) return;
    io.to(data.to).emit('video:call-ended', {
      from: socket.userId,
    });
  });

  // Screen share state
  socket.on('video:screen-share', (data) => {
    if (!socket.userId || !data?.roomId) return;
    socket.to(data.roomId).emit('video:screen-share', {
      userId: socket.userId,
      sharing: data.sharing,
    });
  });

  // Video toggle notification (camera on/off)
  socket.on('video:toggle-video', (data) => {
    if (!socket.userId || !data?.roomId) return;
    socket.to(data.roomId).emit('video:toggle-video', {
      userId: socket.userId,
      videoOff: data.videoOff,
    });
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
  console.log(`Frontend URL: ${FRONTEND_URL || 'http://localhost:5173'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
