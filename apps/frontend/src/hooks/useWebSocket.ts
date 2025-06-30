import { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketMessage {
  type: 'connected' | 'auth_success' | 'auth_error' | 'subscribed' | 'unsubscribed' | 'pong' | 'call_status' | 'store_sync' | 'order_update' | 'product_update' | 'notification';
  payload?: any;
  timestamp?: string;
  storeId?: string;
}

interface WebSocketHookOptions {
  url: string;
  userId?: string;
  storeId?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface WebSocketHookReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
}

export const useWebSocket = (options: WebSocketHookOptions): WebSocketHookReturn => {
  const {
    url,
    userId,
    storeId,
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const authenticate = useCallback(() => {
    if (userId) {
      sendMessage({
        type: 'auth',
        payload: { userId, storeId }
      });
    }
  }, [userId, storeId, sendMessage]);

  const startPing = useCallback(() => {
    clearPingInterval();
    pingIntervalRef.current = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, 30000);
  }, [sendMessage, clearPingInterval]);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => {
        console.log('📊 WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        clearReconnectTimeout();
        authenticate();
        startPing();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          
          if (message.type === 'connected') {
            console.log('📊 Dashboard WebSocket connection established');
          } else if (message.type === 'auth_success') {
            console.log('✅ Dashboard WebSocket authenticated');
          } else if (message.type === 'auth_error') {
            console.error('❌ Dashboard WebSocket auth failed:', message.payload);
            setError('Authentication failed');
          }
        } catch (err) {
          console.error('❌ Error parsing WebSocket message:', err);
        }
      };

      wsRef.current.onclose = () => {
        console.log('📊 WebSocket disconnected');
        setIsConnected(false);
        clearPingInterval();
        
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          console.log(`🔄 Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          setError('Connection lost. Max reconnection attempts reached.');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setError('WebSocket connection error');
      };

    } catch (err) {
      console.error('❌ Failed to create WebSocket connection:', err);
      setError('Failed to create WebSocket connection');
    }
  }, [url, authenticate, startPing, maxReconnectAttempts, reconnectInterval, clearReconnectTimeout, clearPingInterval]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    clearPingInterval();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setError(null);
  }, [clearReconnectTimeout, clearPingInterval]);

  const subscribe = useCallback((channel: string) => {
    sendMessage({
      type: 'subscribe',
      payload: { channel }
    });
  }, [sendMessage]);

  const unsubscribe = useCallback((channel: string) => {
    sendMessage({
      type: 'unsubscribe',
      payload: { channel }
    });
  }, [sendMessage]);

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
    lastMessage,
    error,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    unsubscribe
  };
}; 