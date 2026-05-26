// Real-time Location Tracking Server using Socket.io
// This server handles real-time location updates for field staff
// Deploy on Render, Railway, or any Node.js hosting platform

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  PORT,
  FRONTEND_URL,
  API_KEY,
} from '../server-config.js';

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
  max: 5,
  keyGenerator: (req) => req.headers['x-user-id'] || req.body?.userId || req.ip,
  message: { error: 'Too many location updates. Please slow down.' },
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Socket.io server is running' });
});

// Background location update endpoint (used by native geolocation plugin when app is in background/killed)
app.post('/api/location', locationLimiter, async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const { userId, lat, lng, battery, speed, accuracy, task, status } = req.body;
    if (!userId || lat == null || lng == null) {
      return res.status(400).json({ error: 'userId, lat, and lng are required' });
    }

    console.log(`[HTTP Location] User: ${userId}, Lat: ${lat}, Lng: ${lng}`);

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
      });

      if (rpcError) {
        console.error(`[HTTP Location] RPC error:`, rpcError.message);
        await supabase.from('staff_tracking').upsert(
          { user_id: userId, lat, lng, battery: battery || 0, speed_kmh: speed || 0, accuracy: accuracy || 0, current_task: task || 'Tracking in background', status: status || 'active', last_update: new Date().toISOString() },
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
          });
        }
      }
      
      console.log(`[Location Update] Broadcasting to all clients:`, updated);

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
