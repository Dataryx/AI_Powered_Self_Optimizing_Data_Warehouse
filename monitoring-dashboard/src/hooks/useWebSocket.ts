/**
 * WebSocket Hook
 * Custom hook for WebSocket connections and real-time updates.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

interface UseWebSocketOptions {
  clientId?: string;
  channels?: string[];
  autoConnect?: boolean;
}

interface WebSocketMessage {
  channel: string;
  data: any;
  timestamp: string;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { clientId = `client_${Date.now()}`, channels = [], autoConnect = true } = options;
  
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const socket = io(WS_BASE_URL, {
      path: `/ws/${clientId}`,
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      
      // Subscribe to channels
      if (channels.length > 0) {
        socket.emit('message', {
          action: 'subscribe',
          channels,
        });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      setError(err);
      setIsConnected(false);
    });

    socket.on('message', (message: WebSocketMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    socketRef.current = socket;
  }, [clientId, channels]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const subscribe = useCallback((newChannels: string[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message', {
        action: 'subscribe',
        channels: newChannels,
      });
    }
  }, []);

  const unsubscribe = useCallback((channelsToUnsubscribe: string[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message', {
        action: 'unsubscribe',
        channels: channelsToUnsubscribe,
      });
    }
  }, []);

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message', data);
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    messages,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    sendMessage,
  };
}


