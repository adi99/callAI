import React from 'react';
import { Package, ShoppingCart, TrendingUp, Database } from 'lucide-react';

interface SyncedCountsCardProps {
  productCount: number;
  orderCount: number;
  storeId?: string;
  storeName?: string;
  lastSyncAt?: string | null;
  showTrend?: boolean;
  className?: string;
}

const SyncedCountsCard: React.FC<SyncedCountsCardProps> = ({
  productCount,
  orderCount,
  storeId,
  storeName,
  lastSyncAt,
  showTrend = false,
  className = ''
}) => {
  const totalItems = productCount + orderCount;

  const formatLastSync = (lastSyncAt: string | null) => {
    if (!lastSyncAt) return 'Never synced';
    
    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Synced just now';
    if (diffInMinutes < 60) return `Synced ${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `Synced ${Math.floor(diffInMinutes / 60)} hours ago`;
    return `Synced ${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${className}`}>
      <div className="p-6">
        {/* Header */}
        {(storeName || storeId) && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {storeName || `Store ${storeId?.slice(0, 8)}`}
            </h3>
            {lastSyncAt && (
              <p className="text-sm text-gray-600 mt-1">
                {formatLastSync(lastSyncAt)}
              </p>
            )}
          </div>
        )}

        {/* Count Cards */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Products Count */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Products</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{productCount.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Orders Count */}
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Orders</p>
                <p className="text-2xl font-bold text-green-900 mt-1">{orderCount.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Total Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Synced Items</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{totalItems.toLocaleString()}</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gray-200 rounded-lg">
                <Database className="h-5 w-5 text-gray-600" />
              </div>
              {showTrend && totalItems > 0 && (
                <div className="flex items-center space-x-1 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">Active</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Info */}
        {(productCount > 0 || orderCount > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">Products: {((productCount / totalItems) * 100).toFixed(1)}%</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Orders: {((orderCount / totalItems) * 100).toFixed(1)}%</span>
                </div>
              </div>
              <span className="text-gray-500 text-xs">
                {totalItems === 0 ? 'No data synced' : 'Data synced successfully'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncedCountsCard; 