import React, { useEffect, useState, useMemo } from 'react';
import { Phone, Clock, User, PlayCircle, Download, Search, Filter, RefreshCw, AlertCircle, BarChart3, TrendingUp, CheckCircle } from 'lucide-react';
import { apiService, Call } from '../services/api';

const CallHistory: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadCalls();
  }, []);

  const loadCalls = async (reset = true) => {
    if (reset) {
      setLoading(true);
      setError(null);
      setPage(0);
    }

    try {
      const currentPage = reset ? 0 : page;
      const response = await apiService.getCallHistory(50, currentPage * 50);
      
      if (response.success && response.data) {
        const newCalls = response.data.calls || [];
        setCalls(reset ? newCalls : [...calls, ...newCalls]);
        setHasMore(response.data.hasMore || false);
        setPage(currentPage + 1);
      } else {
        setError(response.error || 'Failed to load call history');
      }
    } catch (err) {
      setError('Failed to load call history');
      console.error('Call history error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCallStatus = (status: string): { label: string; color: string } => {
    switch (status) {
      case 'completed':
        return { label: 'Completed', color: 'bg-green-100 text-green-800' };
      case 'in-progress':
        return { label: 'In Progress', color: 'bg-blue-100 text-blue-800' };
      case 'failed':
        return { label: 'Failed', color: 'bg-red-100 text-red-800' };
      case 'busy':
        return { label: 'Busy', color: 'bg-yellow-100 text-yellow-800' };
      case 'no-answer':
        return { label: 'No Answer', color: 'bg-gray-100 text-gray-800' };
      default:
        return { label: 'Queued', color: 'bg-blue-100 text-blue-800' };
    }
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const filteredCalls = calls.filter(call => {
    const matchesSearch = !searchTerm || 
      call.caller_phone?.includes(searchTerm) ||
      call.twilio_call_sid?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Analytics calculations
  const analytics = useMemo(() => {
    const totalCalls = calls.length;
    const completedCalls = calls.filter(call => call.status === 'completed').length;
    const failedCalls = calls.filter(call => call.status === 'failed' || call.status === 'no-answer' || call.status === 'busy').length;
    const avgDuration = calls.length > 0 
      ? calls.reduce((sum, call) => sum + (call.duration || 0), 0) / calls.length 
      : 0;
    
    const resolutionRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
    const failureRate = totalCalls > 0 ? (failedCalls / totalCalls) * 100 : 0;

    // Today's calls
    const today = new Date().toISOString().split('T')[0];
    const todaysCalls = calls.filter(call => call.start_time.startsWith(today));
    
    return {
      totalCalls,
      completedCalls,
      failedCalls,
      resolutionRate: Math.round(resolutionRate),
      failureRate: Math.round(failureRate),
      avgDuration: Math.round(avgDuration),
      todaysCalls: todaysCalls.length,
      inProgressCalls: calls.filter(call => call.status === 'in-progress').length
    };
  }, [calls]);

  if (loading && calls.length === 0) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading call history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-orange-600 rounded-full">
            <Phone className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Call History</h1>
            <p className="text-gray-600 mt-2">
              Detailed logs of all customer calls handled by your AI assistant
            </p>
            </div>
          </div>
          
          <button
            onClick={() => loadCalls(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Error Loading Calls</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => loadCalls(true)}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Calls</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.totalCalls}</p>
              <p className="text-sm text-blue-600 mt-2">{analytics.todaysCalls} today</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Phone className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Resolution Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.resolutionRate}%</p>
              <p className="text-sm text-green-600 mt-2">{analytics.completedCalls} resolved</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Duration</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{formatDuration(analytics.avgDuration)}</p>
              <p className="text-sm text-purple-600 mt-2">per call</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Calls</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.inProgressCalls}</p>
              <p className="text-sm text-orange-600 mt-2">in progress</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by phone number or call ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="in-progress">In Progress</option>
              <option value="failed">Failed</option>
              <option value="busy">Busy</option>
              <option value="no-answer">No Answer</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Call History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Call Records ({filteredCalls.length} calls)
          </h3>
        </div>
        
        {filteredCalls.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Caller
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Direction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCalls.map((call) => {
                  const callStatus = formatCallStatus(call.status);
                  return (
                    <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {call.caller_phone || 'Unknown'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {call.twilio_call_sid?.substring(0, 10)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-2" />
                          {formatDateTime(call.start_time)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDuration(call.duration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          call.direction === 'inbound' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${callStatus.color}`}>
                          {callStatus.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          {call.recording_url && (
                            <button className="text-blue-600 hover:text-blue-800">
                              <PlayCircle className="h-4 w-4" />
                            </button>
                          )}
                          {call.transcription && (
                            <button className="text-green-600 hover:text-green-800">
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {hasMore && (
              <div className="px-6 py-4 border-t border-gray-200">
                <button
                  onClick={() => loadCalls(false)}
                  disabled={loading}
                  className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More Calls'}
                </button>
              </div>
            )}
          </div>
        ) : (
        <div className="text-center py-12">
          <Phone className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Calls Found</h3>
          <p className="text-gray-600 max-w-md mx-auto">
              {calls.length === 0 
                ? "Call history will appear here once your AI assistant starts handling customer calls."
                : "No calls match your current search criteria. Try adjusting your filters."
              }
          </p>
        </div>
        )}
      </div>
    </div>
  );
};

export default CallHistory;