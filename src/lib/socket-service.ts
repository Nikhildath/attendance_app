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
  deviceInfo?: string;
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
  deviceInfo?: string;
}

export interface ChatMessageData {
  id?: string;
  room_id: string;
  user_id: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  file_url?: string;
  created_at?: string;
  profiles?: {
    id: string;
    username: string;
    avatar_url: string;
    full_name: string;
  };
}

export interface TypingData {
  roomId: string;
  userId: string;
  username: string;
}

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  connect(url: string, token: string, userId?: string): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    if (this.isConnecting && this.connectionPromise) {
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

        // Staff location events
        this.socket.on('staff_location_update', (data: StaffLocation) => {
          this.emit('staff_location', data);
        });

        this.socket.on('staff_locations', (data: StaffLocation[]) => {
          this.emit('staff_locations', data);
        });

        this.socket.on('staff_status_change', (data: { userId: string; status: 'active' | 'idle' | 'offline' }) => {
          this.emit('status_change', data);
        });

        this.socket.on('staff_connected', (data: StaffLocation & { branch_id?: string; role?: string; name?: string }) => {
          this.emit('staff_connected', data);
        });

        this.socket.on('staff_disconnected', (data: { userId: string }) => {
          this.emit('staff_disconnected', data);
        });

        // Chat events
        this.socket.on('chat:new_message', (data: ChatMessageData) => {
          this.emit('chat_message', data);
        });

        this.socket.on('chat:typing', (data: TypingData) => {
          this.emit('chat_typing', data);
        });

        this.socket.on('chat:notification', (data: { message: string; roomId: string; roomName: string; senderName: string }) => {
          this.emit('chat_notification', data);
        });

        // Video call events
        this.socket.on('video:user-joined', (data: { userId: string; name: string }) => {
          this.emit('video_user_joined', data);
        });

        this.socket.on('video:user-left', (data: { userId: string }) => {
          this.emit('video_user_left', data);
        });

        this.socket.on('video:signal', (data: { from: string; signal: any; name: string }) => {
          this.emit('video_signal', data);
        });

        this.socket.on('video:incoming-call', (data: { from: string; name: string; roomId: string }) => {
          this.emit('video_incoming_call', data);
        });

        this.socket.on('video:call-ended', (data: { from: string }) => {
          this.emit('video_call_ended', data);
        });

        this.socket.on('video:screen-share', (data: { userId: string; sharing: boolean }) => {
          this.emit('video_screen_share', data);
        });

        this.socket.on('video:toggle-video', (data: { userId: string; videoOff: boolean }) => {
          this.emit('video_toggle', data);
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

  // Location tracking
  updateLocation(location: LocationUpdate): void {
    if (this.socket?.connected) {
      this.socket.emit('location_update', location);
    }
  }

  requestStaffLocations(): void {
    if (this.socket?.connected) {
      this.socket.emit('request_staff_locations');
    }
  }

  onStaffLocationUpdate(callback: (data: StaffLocation) => void): () => void {
    this.on('staff_location', callback);
    return () => this.off('staff_location', callback);
  }

  onStaffLocations(callback: (data: StaffLocation[]) => void): () => void {
    this.on('staff_locations', callback);
    return () => this.off('staff_locations', callback);
  }

  onStatusChange(callback: (data: { userId: string; status: 'active' | 'idle' | 'offline' }) => void): () => void {
    this.on('status_change', callback);
    return () => this.off('status_change', callback);
  }

  onStaffConnected(callback: (data: StaffLocation & { branch_id?: string; role?: string; name?: string }) => void): () => void {
    this.on('staff_connected', callback);
    return () => this.off('staff_connected', callback);
  }

  onStaffDisconnected(callback: (data: { userId: string }) => void): () => void {
    this.on('staff_disconnected', callback);
    return () => this.off('staff_disconnected', callback);
  }

  // Chat methods
  joinChatRoom(roomId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('chat:join_room', roomId);
    }
  }

  leaveChatRoom(roomId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('chat:leave_room', roomId);
    }
  }

  sendChatMessage(data: ChatMessageData): void {
    if (this.socket?.connected) {
      this.socket.emit('chat:send_message', data);
    }
  }

  emitTyping(data: TypingData): void {
    if (this.socket?.connected) {
      this.socket.emit('chat:typing', data);
    }
  }

  onChatMessage(callback: (data: ChatMessageData) => void): () => void {
    this.on('chat_message', callback);
    return () => this.off('chat_message', callback);
  }

  onChatTyping(callback: (data: TypingData) => void): () => void {
    this.on('chat_typing', callback);
    return () => this.off('chat_typing', callback);
  }

  onChatNotification(callback: (data: { message: string; roomId: string; roomName: string; senderName: string }) => void): () => void {
    this.on('chat_notification', callback);
    return () => this.off('chat_notification', callback);
  }

  // Video call methods
  joinVideoRoom(roomId: string, name: string): void {
    if (this.socket?.connected) {
      this.socket.emit('video:join-room', { roomId, name });
    }
  }

  leaveVideoRoom(roomId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('video:leave-room', { roomId });
    }
  }

  sendVideoSignal(to: string, signal: any, name: string): void {
    if (this.socket?.connected) {
      this.socket.emit('video:signal', { to, signal, name });
    }
  }

  initiateDirectCall(to: string, name: string, roomId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('video:direct-call', { to, name, roomId });
    }
  }

  endCall(to: string): void {
    if (this.socket?.connected) {
      this.socket.emit('video:end-call', { to });
    }
  }

  setScreenShare(roomId: string, sharing: boolean): void {
    if (this.socket?.connected) {
      this.socket.emit('video:screen-share', { roomId, sharing });
    }
  }

  setVideoToggle(roomId: string, videoOff: boolean): void {
    if (this.socket?.connected) {
      this.socket.emit('video:toggle-video', { roomId, videoOff });
    }
  }

  onVideoUserJoined(callback: (data: { userId: string; name: string }) => void): () => void {
    this.on('video_user_joined', callback);
    return () => this.off('video_user_joined', callback);
  }

  onVideoUserLeft(callback: (data: { userId: string }) => void): () => void {
    this.on('video_user_left', callback);
    return () => this.off('video_user_left', callback);
  }

  onVideoSignal(callback: (data: { from: string; signal: any; name: string }) => void): () => void {
    this.on('video_signal', callback);
    return () => this.off('video_signal', callback);
  }

  onIncomingCall(callback: (data: { from: string; name: string; roomId: string }) => void): () => void {
    this.on('video_incoming_call', callback);
    return () => this.off('video_incoming_call', callback);
  }

  onCallEnded(callback: (data: { from: string }) => void): () => void {
    this.on('video_call_ended', callback);
    return () => this.off('video_call_ended', callback);
  }

  onScreenShare(callback: (data: { userId: string; sharing: boolean }) => void): () => void {
    this.on('video_screen_share', callback);
    return () => this.off('video_screen_share', callback);
  }

  onVideoToggle(callback: (data: { userId: string; videoOff: boolean }) => void): () => void {
    this.on('video_toggle', callback);
    return () => this.off('video_toggle', callback);
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

export const socketService = new SocketService();
