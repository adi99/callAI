import React from 'react';
import { Phone, Clock, User, Mic, MicOff, Wifi, WifiOff, RefreshCw, AlertCircle, Activity, PhoneCall, PlayCircle } from 'lucide-react';
import { useCallMonitoring } from '../hooks/useCallMonitoring';
import WebSocketStatus from '../components/WebSocketStatus';

const CallMonitoring: React.FC = () => {
  const { 
    data, 
    loading, 
    error, 
    refetch, 
    isRealTimeConnected 
  } = useCallMonitoring('call-monitor-user');

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCallStatus = (status: string): { label: string; color: string; icon: React.ReactNode } => {
    switch (status) {
      case 'in-progress':
        return { 
          label: 'Live', 
          color: 'bg-green-100 text-green-800 border-green-200', 
          icon: <Activity className="h-3 w-3 animate-pulse" />
        };
      case 'queued':
        return { 
          label: 'Queued', 
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: <Clock className="h-3 w-3" />
        };
      default:
        return { 
          label: 'Unknown', 
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: <Phone className="h-3 w-3" />
        };
    }
  };

  const getCallDuration = (startTime: string): number => {
    const start = new Date(startTime).getTime();
    const now = Date.now();
    return Math.floor((now - start) / 1000);
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  };

  if (loading && data.activeCalls.length === 0) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading call monitoring...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-600 rounded-full">
              <Activity className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Call Monitoring</h1>
              <p className="text-gray-600 mt-2">
                Real-time monitoring of active customer calls with live transcription
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <WebSocketStatus 
              isConnected={isRealTimeConnected}
              lastUpdate={data.lastUpdate}
              size="md"
            />
            <button
              onClick={refetch}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Error Loading Active Calls</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={refetch}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Calls</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{data.totalActiveCalls}</p>
              <p className="text-sm text-green-600 mt-2">Live monitoring</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <PhoneCall className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Duration</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatDuration(data.avgCallDuration)}
              </p>
              <p className="text-sm text-blue-600 mt-2">Current calls</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Connection Status</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {isRealTimeConnected ? 'Live' : 'Offline'}
              </p>
              <p className="text-sm text-purple-600 mt-2">Real-time data</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              {isRealTimeConnected ? (
                <Wifi className="h-6 w-6 text-purple-600" />
              ) : (
                <WifiOff className="h-6 w-6 text-purple-600" />
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Active Calls List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Active Calls ({data.totalActiveCalls})
          </h3>
        </div>
        
        {data.activeCalls.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {data.activeCalls.map((call) => {
              const callStatus = formatCallStatus(call.status);
              const duration = getCallDuration(call.start_time);
              
              return (
                <div key={call.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {call.caller_phone || 'Unknown Caller'}
                          </h4>
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${callStatus.color}`}>
                            {callStatus.icon}
                            {callStatus.label}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-6 text-sm text-gray-600 mb-4">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>Started: {formatDateTime(call.start_time)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Activity className="h-4 w-4" />
                            <span>Duration: {formatDuration(duration)}</span>
                          </div>
                          {call.twilio_call_sid && (
                            <div className="text-xs text-gray-500">
                              ID: {call.twilio_call_sid.substring(0, 10)}...
                            </div>
                          )}
                        </div>
                        
                        {/* Live Transcription */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <Mic className="h-4 w-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-700">Live Transcription</span>
                              {call.lastTranscriptionUpdate && (
                                <span className="text-xs text-gray-500">
                                  {call.lastTranscriptionUpdate.toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                            {call.status === 'in-progress' && (
                              <div className="flex items-center space-x-1 text-green-600">
                                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs">Recording</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="bg-white rounded p-3 border border-gray-100 min-h-[60px]">
                            {call.liveTranscription ? (
                              <p className="text-gray-800 text-sm leading-relaxed">
                                {call.liveTranscription}
                              </p>
                            ) : (
                              <p className="text-gray-500 text-sm italic">
                                {call.status === 'in-progress' 
                                  ? 'Waiting for transcription...'
                                  : 'No transcription available'
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {call.recording_url && (
                        <button className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors">
                          <PlayCircle className="h-5 w-5" />
                        </button>
                      )}
                      <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                        <RefreshCw className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <PhoneCall className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Calls</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              When customers start calling, their active conversations and live transcriptions will appear here for real-time monitoring.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallMonitoring; 