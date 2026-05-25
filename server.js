// Real-time Location Tracking Server using Socket.io
// This server handles real-time location updates for field staff
// Deploy on Render, Railway, or any Node.js hosting platform

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import webpush from 'web-push';

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

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Socket.io server is running' });
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
      .select('subscription')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('[Push] Failed to fetch subscription:', error);
      return res.status(500).json({ error: 'Failed to load push subscription.' });
    }
    if (!subscriptionRow?.subscription) {
      return res.status(404).json({ error: 'No push subscription found for this user.' });
    }
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
    return res.json({ ok: true });
  } catch (error) {
    console.error('[Push] Delivery failed:', error);
    return res.status(500).json({ error: error?.body || error?.message || 'Push delivery failed.' });
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
      // Verify user exists in database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', userId)
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

      // Update Supabase
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
