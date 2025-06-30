import React from 'react';
import { RefreshCw, AlertCircle, Store, Package, ShoppingCart, Clock, CheckCircle, ExternalLink } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import StoreStatusCard from './StoreStatusCard';
import SyncedCountsCard from './SyncedCountsCard';

const StoreDashboard: React.FC = () => {
  const { data, loading, error, refetch } = useDashboardData();

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading store data...</p>
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
              <h3 className="font-semibold text-red-900">Error Loading Store Data</h3>
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
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <Store className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600">No store data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Store Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor your connected stores and synced data</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Stores</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{data.totalStores}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-500">
              <Store className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Connected</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{data.connectedStores}</p>
            </div>
            <div className="p-3 rounded-full bg-green-500">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{data.totalProducts}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-500">
              <Package className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{data.totalOrders}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-500">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Stores List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Connected Stores</h2>
          <p className="text-gray-600 text-sm mt-1">Manage and monitor your store connections</p>
        </div>
        
        <div className="p-6">
          {data.stores.length === 0 ? (
            <div className="text-center py-12">
              <Store className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No stores connected</h3>
              <p className="text-gray-600">Connect your first store to start syncing data</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Store Status Cards Grid */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Store Status Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.stores.map((store) => (
                    <StoreStatusCard
                      key={store.id}
                      store={store}
                      onViewDetails={(storeId) => {
                        console.log('View details for store:', storeId);
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Synced Data Counts - Example Usage */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Data Sync Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.stores.map((store) => (
                    <SyncedCountsCard
                      key={`counts-${store.id}`}
                      productCount={Math.floor(data.totalProducts / data.stores.length)} // Distributed evenly for demo
                      orderCount={Math.floor(data.totalOrders / data.stores.length)} // Distributed evenly for demo
                      storeId={store.id}
                      storeName={store.name}
                      lastSyncAt={store.lastSyncAt}
                      showTrend={true}
                    />
                  ))}
                </div>
              </div>

              {/* Combined View - Alternative Layout */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Detailed Store Information</h3>
                <div className="space-y-6">
                  {data.stores.map((store) => (
                    <div key={`detailed-${store.id}`} className="bg-gray-50 rounded-xl p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <StoreStatusCard
                          store={store}
                          syncStatus={{
                            lastSyncAt: store.lastSyncAt,
                            isRecentSync: store.lastSyncAt ? 
                              (Date.now() - new Date(store.lastSyncAt).getTime()) < (24 * 60 * 60 * 1000) : 
                              false,
                            webhookHealthy: store.status === 'connected',
                            status: store.status === 'connected' ? 'healthy' : 'warning'
                          }}
                          onViewDetails={(storeId) => {
                            console.log('View details for store:', storeId);
                          }}
                        />
                        <SyncedCountsCard
                          productCount={Math.floor(data.totalProducts / data.stores.length)}
                          orderCount={Math.floor(data.totalOrders / data.stores.length)}
                          storeId={store.id}
                          storeName={store.name}
                          lastSyncAt={store.lastSyncAt}
                          showTrend={true}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreDashboard; 