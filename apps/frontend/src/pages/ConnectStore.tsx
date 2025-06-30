import React, { useEffect, useState } from 'react';
import { 
  Store as StoreIcon, 
  Key, 
  Zap, 
  ArrowRight, 
  CheckCircle, 
  Globe, 
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Plus,
  ShoppingBag,
  Users,
  Package
} from 'lucide-react';
import { apiService, Store } from '../services/api';

interface PlatformOption {
  id: Store['platform'];
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  status: 'available' | 'coming_soon' | 'beta';
}

const platforms: PlatformOption[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Connect your Shopify store to sync products, orders, and customer data.',
    icon: StoreIcon,
    color: 'bg-green-500',
    status: 'available'
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'WordPress-based e-commerce platform integration.',
    icon: Globe,
    color: 'bg-purple-500',
    status: 'coming_soon'
  },
  {
    id: 'magento',
    name: 'Magento',
    description: 'Adobe Commerce and Magento Open Source integration.',
    icon: Package,
    color: 'bg-orange-500',
    status: 'coming_soon'
  },
  {
    id: 'bigcommerce',
    name: 'BigCommerce',
    description: 'Enterprise e-commerce platform integration.',
    icon: ShoppingBag,
    color: 'bg-blue-500',
    status: 'coming_soon'
  }
];

const ConnectStore: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<Store['platform'] | null>(null);
  const [showNewConnectionForm, setShowNewConnectionForm] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    loadStores();
    
    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop');
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (shop && code && state) {
      // OAuth callback detected - clear URL params and refresh stores
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        loadStores();
      }, 2000); // Give backend time to process the callback
    }
  }, []);

  const loadStores = async () => {
    setLoading(true);
    try {
      const res = await apiService.getStores();
      if (res.success && res.data) {
        setStores(res.data);
      }
    } catch (error) {
      console.error('Failed to load stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectPlatform = async (platform: Store['platform']) => {
    if (platform !== 'shopify') {
      setConnectionError(`${platform} integration is coming soon!`);
      return;
    }

    setConnectingPlatform(platform);
    setShowNewConnectionForm(true);
    setConnectionError(null);
  };

  const handleShopifyConnect = async () => {
    if (!shopDomain.trim()) {
      setConnectionError('Please enter your shop domain');
      return;
    }

    setConnectingPlatform('shopify');
    setConnectionError(null);

    try {
      const cleanDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\.myshopify\.com.*$/, '');
      const fullDomain = cleanDomain.includes('.') ? cleanDomain : `${cleanDomain}.myshopify.com`;
      
      const response = await apiService.initiateShopifyConnection(fullDomain);
      
      if (response.success && response.data?.authUrl) {
        // Redirect to Shopify OAuth
        window.location.href = response.data.authUrl;
      } else {
        setConnectionError(response.error || 'Failed to initiate connection');
        setConnectingPlatform(null);
      }
    } catch (error) {
      setConnectionError('Failed to connect to Shopify. Please try again.');
      setConnectingPlatform(null);
    }
  };

  const handleDisconnectStore = async (storeId: string) => {
    if (!confirm('Are you sure you want to disconnect this store?')) {
      return;
    }

    try {
      const response = await apiService.disconnectShopifyStore(storeId);
      if (response.success) {
        await loadStores();
      } else {
        setConnectionError(response.error || 'Failed to disconnect store');
      }
    } catch (error) {
      setConnectionError('Failed to disconnect store. Please try again.');
    }
  };

  const handleSyncProducts = async (storeId: string) => {
    try {
      const response = await apiService.syncProducts(storeId);
      if (response.success) {
        alert(`Successfully synced ${response.data?.syncedCount || 0} products!`);
      } else {
        setConnectionError(response.error || 'Failed to sync products');
      }
    } catch (error) {
      setConnectionError('Failed to sync products. Please try again.');
    }
  };

  const connectedStores = stores.filter(store => store.status === 'connected');
  const pendingStores = stores.filter(store => store.status === 'pending');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-600 rounded-full">
              <StoreIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Connect Your Store</h1>
              <p className="text-gray-600 mt-2">
                Integrate your e-commerce platforms to enable AI-powered customer service
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowNewConnectionForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Store
          </button>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <div className="flex items-start space-x-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">Quick Setup</h3>
              <p className="text-blue-700 text-sm mt-1">
                Our AI assistant will automatically sync with your store data to provide intelligent customer support, 
                handle order inquiries, and recommend products based on your inventory.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {connectionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Connection Error</h3>
              <p className="text-red-700 text-sm mt-1">{connectionError}</p>
            </div>
          </div>
        </div>
      )}

      {/* New Connection Form */}
      {showNewConnectionForm && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Add New Store Connection</h2>
            <button
              onClick={() => {
                setShowNewConnectionForm(false);
                setShopDomain('');
                setConnectionError(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          {/* Platform Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {platforms.map((platform) => {
              const Icon = platform.icon;
              const isAvailable = platform.status === 'available';
              const isConnecting = connectingPlatform === platform.id;
              
              return (
                <div
                  key={platform.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    isAvailable 
                      ? 'hover:border-blue-300 hover:shadow-sm' 
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                  onClick={() => isAvailable && handleConnectPlatform(platform.id)}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${platform.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-gray-900">{platform.name}</h3>
                        {platform.status === 'coming_soon' && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            Coming Soon
                          </span>
                        )}
                        {platform.status === 'beta' && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded">
                            Beta
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{platform.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Shopify Connection Form */}
          {connectingPlatform === 'shopify' && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Connect Shopify Store</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shop Domain
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      placeholder="your-shop-name.myshopify.com or your-shop-name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleShopifyConnect}
                      disabled={!shopDomain.trim()}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Connect
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    You'll be redirected to Shopify to authorize the connection
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connected Stores */}
      {connectedStores.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Connected Stores</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {connectedStores.map((store) => {
              const platform = platforms.find(p => p.id === store.platform);
              const Icon = platform?.icon || StoreIcon;
              const color = platform?.color || 'bg-gray-500';
              
              return (
                <div key={store.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-3 rounded-lg ${color}`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{store.name}</h3>
                        <p className="text-sm text-green-600 flex items-center mt-1">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Connected
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4">{store.domain}</p>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSyncProducts(store.id)}
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </button>
                    <button
                      onClick={() => handleDisconnectStore(store.id)}
                      className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Connections */}
      {pendingStores.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Pending Connections</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {pendingStores.map((store) => {
              const platform = platforms.find(p => p.id === store.platform);
              const Icon = platform?.icon || StoreIcon;
              const color = platform?.color || 'bg-gray-500';
              
              return (
                <div key={store.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 border-orange-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-3 rounded-lg ${color} opacity-75`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{store.name}</h3>
                        <p className="text-sm text-orange-600 flex items-center mt-1">
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          Connecting...
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      Pending
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4">{store.domain}</p>
                  
                  <button
                    onClick={() => handleDisconnectStore(store.id)}
                    className="w-full px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Cancel Connection
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && stores.length === 0 && !showNewConnectionForm && (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200 text-center">
          <StoreIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No stores connected</h3>
          <p className="text-gray-600 mb-6">Get started by connecting your first e-commerce store</p>
          <button
            onClick={() => setShowNewConnectionForm(true)}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Connect Your First Store
          </button>
        </div>
      )}

      {/* Connection Stats */}
      {connectedStores.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Connected</p>
                  <p className="text-2xl font-bold text-green-900">{connectedStores.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800">Pending</p>
                  <p className="text-2xl font-bold text-orange-900">{pendingStores.length}</p>
                </div>
                <RefreshCw className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Platforms</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {new Set(stores.map(s => s.platform)).size}
                  </p>
                </div>
                <Zap className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">Available</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {platforms.filter(p => p.status === 'available').length}
                  </p>
                </div>
                <StoreIcon className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center text-gray-600 py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          Loading stores...
        </div>
      )}
    </div>
  );
};

export default ConnectStore;