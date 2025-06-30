import React from 'react';
import { Store, CheckCircle, AlertCircle, Clock, ExternalLink, Wifi, WifiOff } from 'lucide-react';

interface StoreStatusCardProps {
  store: {
    id: string;
    name: string;
    domain: string;
    platform: string;
    status: string;
    lastSyncAt: string | null;
  };
  syncStatus?: {
    lastSyncAt: string | null;
    isRecentSync: boolean;
    webhookHealthy: boolean;
    status: 'healthy' | 'warning';
  };
  onViewDetails?: (storeId: string) => void;
  className?: string;
}

const StoreStatusCard: React.FC<StoreStatusCardProps> = ({
  store,
  syncStatus,
  onViewDetails,
  className = ''
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'disconnected':
        return 'bg-red-100 text-red-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4" />;
      case 'disconnected':
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatLastSync = (lastSyncAt: string | null) => {
    if (!lastSyncAt) return 'Never';
    
    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  const getSyncStatusColor = (status?: 'healthy' | 'warning') => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getPlatformIcon = (platform: string) => {
    return <Store className="h-5 w-5 text-blue-600" />;
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              {getPlatformIcon(store.platform)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{store.name}</h3>
              <p className="text-sm text-gray-600">{store.domain}</p>
            </div>
          </div>
          
          <div className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(store.status)}`}>
            {getStatusIcon(store.status)}
            <span className="capitalize">{store.status}</span>
          </div>
        </div>

        {/* Platform and Store Info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div>
              <p className="text-xs text-gray-500">Platform</p>
              <p className="text-sm font-medium text-gray-900 capitalize">{store.platform}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Store ID</p>
              <p className="text-sm font-medium text-gray-900">{store.id.slice(0, 8)}...</p>
            </div>
          </div>
        </div>

        {/* Sync Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Last Sync</p>
              <p className="text-sm font-medium text-gray-900">
                {formatLastSync(store.lastSyncAt || syncStatus?.lastSyncAt)}
              </p>
            </div>
            
            {syncStatus && (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  {syncStatus.webhookHealthy ? (
                    <Wifi className="h-4 w-4 text-green-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-xs text-gray-600">
                    Webhook {syncStatus.webhookHealthy ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sync Health Indicator */}
          {syncStatus && (
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                syncStatus.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
              }`}></div>
              <span className={`text-xs font-medium ${getSyncStatusColor(syncStatus.status)}`}>
                Sync Status: {syncStatus.status === 'healthy' ? 'Healthy' : 'Needs Attention'}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {syncStatus?.isRecentSync ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  <span className="text-xs">Recently synced</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-yellow-600">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">Sync pending</span>
                </div>
              )}
            </div>
            
            {onViewDetails && (
              <button
                onClick={() => onViewDetails(store.id)}
                className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-xs font-medium transition-colors"
              >
                <span>View Details</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreStatusCard; 