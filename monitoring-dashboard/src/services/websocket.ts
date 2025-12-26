/**
 * WebSocket Service
 * Alternative WebSocket client implementation (can use instead of hook).
 */

import { io, Socket } from 'socket.io-client';

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

class WebSocketService {
  private socket: Socket | null = null;
  private clientId: string;

  constructor(clientId?: string) {
    this.clientId = clientId || `client_${Date.now()}`;
  }

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(WS_BASE_URL, {
      path: `/ws/${this.clientId}`,
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribe(channels: string[]): void {
    if (this.socket?.connected) {
      this.socket.emit('message', {
        action: 'subscribe',
        channels,
      });
    }
  }

  unsubscribe(channels: string[]): void {
    if (this.socket?.connected) {
      this.socket.emit('message', {
        action: 'unsubscribe',
        channels,
      });
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();
export default websocketService;
