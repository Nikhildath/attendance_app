import { io, Socket } from 'socket.io-client';
import { SOCKET_URL as CONFIG_SOCKET_URL } from './config';

export interface StaffLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  battery: number;
  speed: number;
  task: string;
  status: 'active' | 'idle' | 'offline';
  lastUpdate: string;
  accuracy: number;
}

export interface LocationUpdate {
  userId: string;
  lat: number;
  lng: number;
  battery: number;
  speed: number;
  accuracy: number;
  task?: string;
  status?: 'active' | 'idle' | 'offline';
}

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  connect(url: string, token: string, userId?: string): Promise<void> {
    // If already connected, return immediately
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return Promise.resolve();
    }

    // If currently connecting, return the existing promise
    if (this.isConnecting && this.connectionPromise) {
      console.log('Connection already in progress, returning existing promise');
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const socketUrl =
          url ||
          (CONFIG_SOCKET_URL?.startsWith('http') ? CONFIG_SOCKET_URL : '') ||
          (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
        
        console.log('🔌 Connecting to Socket server at:', socketUrl);
        console.log('🔑 Auth - Token:', !!token, 'UserId:', !!userId);
        
        // Prepare auth object
        const auth: any = {};
        if (token) auth.token = token;
        if (userId) auth.userId = userId;
        
        this.socket = io(socketUrl, {
          auth,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10,
          transports: ['websocket', 'polling'],
        });

        this.socket.on('connect', () => {
          console.log('✅ Socket connected successfully:', this.socket?.id);
          this.isConnecting = false;
          this.emit('connected', this.socket?.id);
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('❌ Socket disconnected:', reason);
          this.emit('disconnected', reason);
        });

        this.socket.on('connect_error', (error: any) => {
          console.error('⚠️ Socket connection error:', error.message || error);
          this.emit('connection_error', error);
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(error);
          }
        });

        // Listen for staff location updates
        this.socket.on('staff_location_update', (data: StaffLocation) => {
          console.log('📍 Received location update:', data);
          this.emit('staff_location', data);
        });

        // Listen for batch location updates
        this.socket.on('staff_locations', (data: StaffLocation[]) => {
          console.log('📍 Received batch locations:', data.length);
          this.emit('staff_locations', data);
        });

        // Listen for status changes
        this.socket.on('staff_status_change', (data: { userId: string; status: 'active' | 'idle' | 'offline' }) => {
          console.log('🔄 Status change:', data);
          this.emit('status_change', data);
        });
      } catch (error) {
        console.error('💥 Socket connection exception:', error);
        this.isConnecting = false;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Emit location update to server
  updateLocation(location: LocationUpdate): void {
    if (this.socket?.connected) {
      this.socket.emit('location_update', location);
    }
  }

  // Request all staff locations
  requestStaffLocations(): void {
    if (this.socket?.connected) {
      this.socket.emit('request_staff_locations');
    }
  }

  // Subscribe to location updates
  onStaffLocationUpdate(callback: (data: StaffLocation) => void): () => void {
    this.on('staff_location', callback);
    return () => this.off('staff_location', callback);
  }

  // Subscribe to batch location updates
  onStaffLocations(callback: (data: StaffLocation[]) => void): () => void {
    this.on('staff_locations', callback);
    return () => this.off('staff_locations', callback);
  }

  // Subscribe to status changes
  onStatusChange(callback: (data: { userId: string; status: 'active' | 'idle' | 'offline' }) => void): () => void {
    this.on('status_change', callback);
    return () => this.off('status_change', callback);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  private on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  private off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();
