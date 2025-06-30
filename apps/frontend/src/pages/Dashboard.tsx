import React, { useEffect, useState } from 'react';
import { TrendingUp, Store, Phone, DollarSign, Clock, User, CheckCircle, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { apiService, Call } from '../services/api';
import StoreDashboard from '../components/StoreDashboard';
import { useDashboardData } from '../hooks/useDashboardData';

interface DashboardStats {
  totalStores: number;
  totalProducts: number;
  totalOrders: number;
  totalCalls: number;
  recentCalls: Call[];
  callsToday: number;
  resolvedCallsToday: number;
  avgCallDuration: number;
  satisfactionRate: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [callsLoading, setCallsLoading] = useState(false);
  
  // Use the enhanced dashboard data hook with WebSocket support
  const { 
    data: dashboardData, 
    loading: dashboardLoading, 
    error: dashboardError, 
    refetch: refetchDashboard,
    isRealTimeConnected,
    lastUpdate
  } = useDashboardData('dashboard-user');

  useEffect(() => {
    loadCallsData();
  }, []);

  const loadCallsData = async () => {
    setCallsLoading(true);
    
    try {
      const response = await apiService.getDashboardStats();
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        // Fallback to individual API calls if dashboard endpoint doesn't exist
        const [storesRes, callsRes] = await Promise.all([
          apiService.getStores(),
          apiService.getCalls()
        ]);
        
        const mockStats: DashboardStats = {
          totalStores: storesRes.data?.length || 0,
          totalProducts: dashboardData?.totalProducts || 0,
          totalOrders: dashboardData?.totalOrders || 0,
          totalCalls: callsRes.data?.length || 0,
          recentCalls: callsRes.data?.slice(0, 5) || [],
          callsToday: 0,
          resolvedCallsToday: 0,
          avgCallDuration: 0,
          satisfactionRate: 95
        };
        setStats(mockStats);
      }
    } catch (err) {
      console.error('Calls data error:', err);
    } finally {
      setCallsLoading(false);
    }
  };

  // Update stats when dashboard data changes
  useEffect(() => {
    if (dashboardData && stats) {
      setStats(prevStats => prevStats ? {
        ...prevStats,
        totalStores: dashboardData.totalStores,
        totalProducts: dashboardData.totalProducts,
        totalOrders: dashboardData.totalOrders
      } : null);
    }
  }, [dashboardData, stats]);

  const loading = dashboardLoading || callsLoading;
  const error = dashboardError;

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCallStatus = (status: string): { label: string; color: string } => {
    switch (status) {
      case 'completed':
        return { label: 'Resolved', color: 'bg-green-100 text-green-800' };
      case 'in-progress':
        return { label: 'Active', color: 'bg-blue-100 text-blue-800' };
      case 'failed':
      case 'busy':
      case 'no-answer':
        return { label: 'Failed', color: 'bg-red-100 text-red-800' };
      default:
        return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' };
    }
  };

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Error Loading Dashboard</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => {
              refetchDashboard();
              loadCallsData();
            }}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const dashboardCards = [
    {
      title: 'Connected Stores',
      value: (stats?.totalStores ?? 0).toString(),
      change: 'Active connections',
      icon: Store,
      color: 'bg-blue-500',
      trend: 'up'
    },
    {
      title: 'Total Orders',
      value: (stats?.totalOrders ?? 0).toString(),
      change: 'Synced orders',
      icon: DollarSign,
      color: 'bg-green-500',
      trend: 'up'
    },
    {
      title: 'Total Calls',
      value: (stats?.totalCalls ?? 0).toString(),
      change: `${stats?.resolvedCallsToday || 0} resolved today`,
      icon: Phone,
      color: 'bg-purple-500',
      trend: 'up'
    },
    {
      title: 'Satisfaction Rate',
      value: `${stats?.satisfactionRate ?? 0}%`,
      change: 'Customer satisfaction',
      icon: TrendingUp,
      color: 'bg-orange-500',
      trend: 'up'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">Welcome back! 👋</h1>
              {/* Real-time connection status */}
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
                {isRealTimeConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-300" />
                    <span className="text-xs text-green-300">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-300" />
                    <span className="text-xs text-red-300">Offline</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-blue-100 text-lg">
              Your AI assistant handled {stats?.callsToday || 0} calls today with a {stats?.satisfactionRate || 0}% satisfaction rate.
            </p>
            {lastUpdate && (
              <p className="text-blue-200 text-sm mt-2">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="hidden md:block">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats?.satisfactionRate || 0}%</div>
                <div className="text-sm text-blue-100">Satisfaction Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Store Dashboard Component */}
      <StoreDashboard />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <p className="text-sm text-green-600 mt-2 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {stat.change}
                </p>
              </div>
              <div className={`p-3 rounded-full ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Calls Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Calls</h3>
          <p className="text-sm text-gray-600">Latest customer interactions handled by your AI assistant</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Caller
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Intent Detected
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats?.recentCalls && stats.recentCalls.length > 0 ? (
                stats.recentCalls.map((call) => {
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
                              {call.caller_phone || 'Unknown Caller'}
                            </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2" />
                          {getTimeAgo(call.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {call.direction === 'inbound' ? 'Customer Call' : 'Outbound Call'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDuration(call.duration)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${callStatus.color}`}>
                          {callStatus.label === 'Resolved' ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                          ) : callStatus.label === 'Failed' ? (
                            <AlertCircle className="h-3 w-3 mr-1" />
                      ) : (
                            <Clock className="h-3 w-3 mr-1" />
                      )}
                          {callStatus.label}
                    </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recent Calls</h3>
                    <p className="text-gray-600">
                      Call data will appear here once your AI assistant starts handling customer calls.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;