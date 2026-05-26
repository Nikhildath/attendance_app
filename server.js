// Real-time Location Tracking Server using Socket.io
// This server handles real-time location updates for field staff
// Deploy on Render, Railway, or any Node.js hosting platform

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import webpush from 'web-push';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  CHAT_SUPABASE_URL,
  CHAT_SUPABASE_ANON_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  PORT,
  FRONTEND_URL,
  API_KEY,
} from './server-config.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL || '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

const chatSupabase = createClient(CHAT_SUPABASE_URL || '', CHAT_SUPABASE_ANON_KEY || '');

const vapidPublicKey = VAPID_PUBLIC_KEY;
const vapidPrivateKey = VAPID_PRIVATE_KEY;
const vapidSubject = VAPID_SUBJECT || 'mailto:support@attendly.local';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('[Push] VAPID keys are not configured. Web push delivery is disabled.');
}

// Firebase Admin SDK (optional — enables FCM for native push when app is killed)
let fcmAvailable = false;
try {
  const fcmKeyPath = resolve('firebase-service-account.json');
  if (existsSync(fcmKeyPath)) {
    const serviceAccount = JSON.parse(readFileSync(fcmKeyPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    fcmAvailable = true;
    console.log('[FCM] Firebase Admin initialized. Native push enabled.');
  } else {
    console.warn('[FCM] firebase-service-account.json not found. Native FCM push disabled.');
  }
} catch (e) {
  console.warn('[FCM] Failed to initialize Firebase Admin:', e.message);
}

// Rate limiter for background location endpoint
const locationLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 5,
  keyGenerator: (req) => req.headers['x-user-id'] || req.body?.userId || req.ip,
  message: { error: 'Too many location updates. Please slow down.' },
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Socket.io live location server', port: PORT });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Socket.io server is running' });
});

app.post('/api/push/register-fcm', async (req, res) => {
  const { userId, token } = req.body || {};
  if (!userId || !token) {
    return res.status(400).json({ error: 'userId and token are required.' });
  }
  try {
    const { error } = await chatSupabase
      .from('push_subscriptions')
      .upsert({ user_id: userId, fcm_token: token, updated_at: new Date().toISOString() });
    if (error) {
      console.error('[FCM] Failed to save token:', error.message);
      return res.status(500).json({ error: 'Failed to save FCM token.' });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('[FCM] Registration error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/push/send', async (req, res) => {
  const { userId, payload } = req.body || {};
  if (!userId || !payload?.title || !payload?.body) {
    return res.status(400).json({ error: 'userId, payload.title and payload.body are required.' });
  }
  if (!vapidPublicKey || !vapidPrivateKey) {
    return res.status(503).json({ error: 'Push notifications are not configured on the server.' });
  }
  try {
    const { data: subscriptionRow, error } = await chatSupabase
      .from('push_subscriptions')
      .select('subscription, fcm_token')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('[Push] Failed to fetch subscription:', error);
      return res.status(500).json({ error: 'Failed to load push subscription.' });
    }

    let webPushSent = false;
    let fcmSent = false;

    // Send via Web Push (for browser/foreground delivery)
    if (subscriptionRow?.subscription) {
      try {
        await webpush.sendNotification(
          subscriptionRow.subscription,
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icon-192.png',
            badge: payload.badge || '/icon-192.png',
            data: payload.data || { url: '/chat' },
          })
        );
        webPushSent = true;
      } catch (webError) {
        console.warn('[Push] Web push failed:', webError.message);
      }
    }

    // Send via FCM (for native delivery when app is killed)
    if (fcmAvailable && subscriptionRow?.fcm_token) {
      try {
        await admin.messaging().send({
          token: subscriptionRow.fcm_token,
          notification: { title: payload.title, body: payload.body },
          data: { url: JSON.stringify(payload.data?.url || '/chat') },
        });
        fcmSent = true;
      } catch (fcmError) {
        console.warn('[FCM] Send failed:', fcmError.message);
      }
    }

    if (!webPushSent && !fcmSent) {
      return res.status(404).json({ error: 'No active push channel found for this user.' });
    }

    return res.json({ ok: true, webPushSent, fcmSent });
  } catch (error) {
    console.error('[Push] Delivery failed:', error);
    return res.status(500).json({ error: error?.body || error?.message || 'Push delivery failed.' });
  }
});

// Background location update endpoint (used by native geolocation plugin when app is in background/killed)
app.post('/api/location', locationLimiter, async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Support both the native plugin body format (latitude/longitude) and the custom body format (lat/lng)
    // Also accept userId from header as fallback (used by native plugin's HTTP POST)
    const userId = req.body.userId || req.body.user_id || req.headers['x-user-id'];
    const lat = req.body.lat ?? req.body.latitude;
    const lng = req.body.lng ?? req.body.longitude;

    if (!userId || lat == null || lng == null) {
      return res.status(400).json({ error: 'userId, lat/latitude, and lng/longitude are required' });
    }

    // Accept additional fields with fallback names
    const battery = req.body.battery ?? 0;
    const speed = req.body.speed_kmh ?? req.body.speed ?? 0;
    const accuracy = req.body.accuracy ?? 0;
    const task = req.body.task || req.body.current_task || 'Tracking in background';
    const status = req.body.status || 'active';

    console.log(`[HTTP Location] User: ${userId}, Lat: ${lat}, Lng: ${lng}`);

    // Upsert using RPC
    try {
      const { error: rpcError } = await supabase.rpc('upsert_staff_tracking', {
        p_user_id: userId,
        p_lat: lat,
        p_lng: lng,
        p_battery: battery || 0,
        p_speed_kmh: speed || 0,
        p_accuracy: accuracy || 0,
        p_current_task: task || 'Tracking in background',
        p_status: status || 'active',
      });

      if (rpcError) {
        console.error(`[HTTP Location] RPC error:`, rpcError.message);
        // Fallback to direct upsert
        const { error: upsertError } = await supabase.from('staff_tracking').upsert(
          { user_id: userId, lat, lng, battery: battery || 0, speed_kmh: speed || 0, accuracy: accuracy || 0, current_task: task || 'Tracking in background', status: status || 'active', last_update: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
        if (upsertError) {
          console.error(`[HTTP Location] Upsert error:`, upsertError.message);
        }
      }
    } catch (dbError) {
      console.error(`[HTTP Location] DB error:`, dbError.message);
    }

    // Broadcast to all connected socket clients
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
        // Fallback: direct query in case RPC doesn't exist yet
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
      const { userId, lat, lng, battery, speed, accuracy, task, status } = data;
      
      console.log(`[Location Update] User: ${socket.userId}, Payload UserId: ${userId}, Data:`, { lat, lng, battery, status });

      // Validate userId matches authenticated socket user
      if (userId !== socket.userId) {
        console.warn(`[Location Update] userId mismatch: ${userId} vs ${socket.userId}`);
        return;
      }

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
      };
      locationCache.set(userId, updated);
      
      console.log(`[Location Update] Broadcasting to all clients:`, updated);

      // Update Supabase (use RPC to bypass RLS)
      try {
        const { error: rpcError } = await supabase.rpc('upsert_staff_tracking', {
          p_user_id: userId,
          p_lat: lat,
          p_lng: lng,
          p_battery: battery,
          p_speed_kmh: speed || 0,
          p_accuracy: accuracy || 0,
          p_current_task: task || '',
          p_status: status || 'active',
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

export default httpServer;
