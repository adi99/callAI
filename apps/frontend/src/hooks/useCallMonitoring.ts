import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { apiService, Call } from '../services/api';

interface ActiveCall extends Call {
  liveTranscription?: string;
  lastTranscriptionUpdate?: Date;
  participants?: {
    customer: string;
    agent: string;
  };
}

interface CallMonitoringData {
  activeCalls: ActiveCall[];
  totalActiveCalls: number;
  avgCallDuration: number;
  lastUpdate: Date | null;
}

interface UseCallMonitoringReturn {
  data: CallMonitoringData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isRealTimeConnected: boolean;
}

const getWebSocketUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = window.location.hostname === 'localhost' ? '3001' : window.location.port;
  return `${protocol}//${host}:${port}/api/dashboard/ws`;
};

export const useCallMonitoring = (userId = 'monitoring-user'): UseCallMonitoringReturn => {
  const [data, setData] = useState<CallMonitoringData>({
    activeCalls: [],
    totalActiveCalls: 0,
    avgCallDuration: 0,
    lastUpdate: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection for real-time updates
  const { 
    isConnected: isRealTimeConnected, 
    lastMessage,
    subscribe
  } = useWebSocket({
    url: getWebSocketUrl(),
    userId,
    autoConnect: true
  });

  const fetchActiveCalls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch active calls from API
      const response = await apiService.getCalls();
      
      if (response.success && response.data) {
        const allCalls = response.data;
        const activeCalls = allCalls.filter(call => 
          call.status === 'in-progress' || call.status === 'queued'
        );

        // Calculate analytics
        const totalActiveCalls = activeCalls.length;
        const avgCallDuration = activeCalls.length > 0
          ? activeCalls.reduce((sum, call) => {
              const startTime = new Date(call.start_time).getTime();
              const now = Date.now();
              const duration = Math.floor((now - startTime) / 1000);
              return sum + duration;
            }, 0) / activeCalls.length
          : 0;

        setData({
          activeCalls: activeCalls.map(call => ({
            ...call,
            liveTranscription: '',
            lastTranscriptionUpdate: new Date()
          })),
          totalActiveCalls,
          avgCallDuration,
          lastUpdate: new Date()
        });
      } else {
        setError(response.error || 'Failed to fetch active calls');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle real-time WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'call_status':
          // Update call status in real-time
          const callUpdate = lastMessage.payload;
          setData(prevData => {
            const updatedCalls = prevData.activeCalls.map(call => {
              if (call.id === callUpdate.id || call.twilio_call_sid === callUpdate.twilio_call_sid) {
                return {
                  ...call,
                  ...callUpdate,
                  lastTranscriptionUpdate: new Date()
                };
              }
              return call;
            });

            // If it's a new active call, add it
            if (callUpdate.status === 'in-progress' && 
                !updatedCalls.find(call => call.id === callUpdate.id)) {
              updatedCalls.push({
                ...callUpdate,
                liveTranscription: '',
                lastTranscriptionUpdate: new Date()
              });
            }

            // Remove calls that are no longer active
            const stillActiveCalls = updatedCalls.filter(call => 
              call.status === 'in-progress' || call.status === 'queued'
            );

            return {
              ...prevData,
              activeCalls: stillActiveCalls,
              totalActiveCalls: stillActiveCalls.length,
              lastUpdate: new Date()
            };
          });
          break;

        case 'transcription_update':
          // Update live transcription
          const transcriptionUpdate = lastMessage.payload;
          setData(prevData => ({
            ...prevData,
            activeCalls: prevData.activeCalls.map(call => {
              if (call.id === transcriptionUpdate.callId || 
                  call.twilio_call_sid === transcriptionUpdate.callSid) {
                return {
                  ...call,
                  liveTranscription: transcriptionUpdate.transcription,
                  lastTranscriptionUpdate: new Date()
                };
              }
              return call;
            }),
            lastUpdate: new Date()
          }));
          break;

        default:
          break;
      }
    }
  }, [lastMessage]);

  // Subscribe to relevant channels when connected
  useEffect(() => {
    if (isRealTimeConnected) {
      subscribe('call_monitoring');
      subscribe('transcription_updates');
    }
  }, [isRealTimeConnected, subscribe]);

  // Initial data fetch
  useEffect(() => {
    fetchActiveCalls();
    
    // Set up periodic refresh for active calls
    const interval = setInterval(fetchActiveCalls, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [fetchActiveCalls]);

  return {
    data,
    loading,
    error,
    refetch: fetchActiveCalls,
    isRealTimeConnected
  };
}; 