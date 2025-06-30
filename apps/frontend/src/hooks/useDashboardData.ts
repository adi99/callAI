import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useWebSocket } from './useWebSocket';

interface DashboardData {
  totalStores: number;
  connectedStores: number;
  disconnectedStores: number;
  totalProducts: number;
  totalOrders: number;
  stores: Array<{
    id: string;
    name: string;
    domain: string;
    platform: string;
    status: string;
    lastSyncAt: string | null;
  }>;
}

interface StoreDashboardData {
  store: {
    id: string;
    name: string;
    domain: string;
    platform: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  syncStatus: {
    lastSyncAt: string | null;
    isRecentSync: boolean;
    webhookHealthy: boolean;
    status: 'healthy' | 'warning';
  };
  counts: {
    products: number;
    orders: number;
    totalItems: number;
  };
  metadata: {
    connectionEstablished: string;
    dataFreshness: number | null;
  };
}

interface UseDashboardDataReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isRealTimeConnected: boolean;
  lastUpdate: Date | null;
}

interface UseStoreDashboardDataReturn {
  data: StoreDashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isRealTimeConnected: boolean;
  lastUpdate: Date | null;
}

const getWebSocketUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = window.location.hostname === 'localhost' ? '3001' : window.location.port;
  return `${protocol}//${host}:${port}/api/dashboard/ws`;
};

export const useDashboardData = (userId?: string, storeId?: string): UseDashboardDataReturn => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // WebSocket connection for real-time updates
  const { 
    isConnected: isRealTimeConnected, 
    lastMessage 
  } = useWebSocket({
    url: getWebSocketUrl(),
    userId: userId || 'dashboard-user',
    storeId,
    autoConnect: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getDashboardOverview();
      
      if (response.success && response.data) {
        setData(response.data);
        setLastUpdate(new Date());
      } else {
        setError(response.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle real-time WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      console.log('📊 Received real-time update:', lastMessage.type);
      
      switch (lastMessage.type) {
        case 'store_sync':
        case 'order_update':
        case 'product_update':
          // Refetch data on store-related updates
          fetchData();
          break;
        
        case 'notification':
          // Handle notifications (could show toast, etc.)
          console.log('🔔 Dashboard notification:', lastMessage.payload);
          break;
          
        default:
          break;
      }
    }
  }, [lastMessage]);

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    isRealTimeConnected,
    lastUpdate
  };
};

export const useStoreDashboardData = (storeId: string, userId?: string): UseStoreDashboardDataReturn => {
  const [data, setData] = useState<StoreDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // WebSocket connection for real-time updates
  const { 
    isConnected: isRealTimeConnected, 
    lastMessage 
  } = useWebSocket({
    url: getWebSocketUrl(),
    userId: userId || 'store-dashboard-user',
    storeId,
    autoConnect: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getStoreDashboardStats(storeId);
      
      if (response.success && response.data) {
        setData(response.data);
        setLastUpdate(new Date());
      } else {
        setError(response.error || 'Failed to fetch store dashboard data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle real-time WebSocket messages for this specific store
  useEffect(() => {
    if (lastMessage && (lastMessage.storeId === storeId || !lastMessage.storeId)) {
      console.log(`📊 Store ${storeId} received real-time update:`, lastMessage.type);
      
      switch (lastMessage.type) {
        case 'store_sync':
          if (lastMessage.storeId === storeId) {
            // Update sync status directly from WebSocket data
            if (data) {
              setData(prevData => prevData ? {
                ...prevData,
                syncStatus: {
                  ...prevData.syncStatus,
                  lastSyncAt: new Date().toISOString(),
                  isRecentSync: true,
                  status: 'healthy' as const
                }
              } : null);
              setLastUpdate(new Date());
            }
          }
          break;
          
        case 'order_update':
          if (lastMessage.storeId === storeId) {
            // Incrementally update order count if possible
            if (data && lastMessage.payload?.orderCount !== undefined) {
              setData(prevData => prevData ? {
                ...prevData,
                counts: {
                  ...prevData.counts,
                  orders: lastMessage.payload.orderCount
                }
              } : null);
              setLastUpdate(new Date());
            } else {
              // Fallback to refetch
              fetchData();
            }
          }
          break;
          
        case 'product_update':
          if (lastMessage.storeId === storeId) {
            // Incrementally update product count if possible
            if (data && lastMessage.payload?.productCount !== undefined) {
              setData(prevData => prevData ? {
                ...prevData,
                counts: {
                  ...prevData.counts,
                  products: lastMessage.payload.productCount
                }
              } : null);
              setLastUpdate(new Date());
            } else {
              // Fallback to refetch
              fetchData();
            }
          }
          break;
          
        default:
          break;
      }
    }
  }, [lastMessage, storeId, data]);

  useEffect(() => {
    if (storeId) {
      fetchData();
    }
  }, [storeId]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    isRealTimeConnected,
    lastUpdate
  };
}; 