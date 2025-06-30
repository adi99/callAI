import React, { useEffect, useState } from 'react';
import { Package, Search, Filter, Store, RefreshCw, AlertCircle, DollarSign, Archive } from 'lucide-react';
import { apiService, Store as StoreType, Product } from '../services/api';

const Products: React.FC = () => {
  const [stores, setStores] = useState<StoreType[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      loadProducts();
    }
  }, [selectedStore]);

  const loadStores = async () => {
    try {
      const response = await apiService.getStores();
      if (response.success && response.data) {
        const connectedStores = response.data.filter(store => store.status === 'connected');
        setStores(connectedStores);
        if (connectedStores.length > 0 && !selectedStore) {
          setSelectedStore(connectedStores[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load stores:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!selectedStore) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.getProducts(selectedStore);
      if (response.success && response.data) {
        setProducts(response.data);
      } else {
        setError(response.error || 'Failed to load products');
      }
    } catch (err) {
      setError('Failed to load products');
      console.error('Products error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatProductStatus = (status: string): { label: string; color: string } => {
    switch (status) {
      case 'active':
        return { label: 'Active', color: 'bg-green-100 text-green-800' };
      case 'draft':
        return { label: 'Draft', color: 'bg-yellow-100 text-yellow-800' };
      case 'archived':
        return { label: 'Archived', color: 'bg-gray-100 text-gray-800' };
      case 'discontinued':
        return { label: 'Discontinued', color: 'bg-red-100 text-red-800' };
      default:
        return { label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.vendor?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const currentStore = stores.find(store => store.id === selectedStore);

  if (loading && stores.length === 0) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading stores...</p>
        </div>
      </div>
    );
  }

  if (stores.length === 0) {
  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-600 rounded-full">
            <Package className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600 mt-2">
              Manage your product catalog and AI recommendations
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="text-center py-12">
            <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Connected Stores</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              Connect a store first to view and manage your product catalog.
            </p>
            <a
              href="/connect-store"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Store className="h-5 w-5 mr-2" />
              Connect Store
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-600 rounded-full">
              <Package className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Products</h1>
              <p className="text-gray-600 mt-2">
                Manage your product catalog and AI recommendations
              </p>
            </div>
          </div>
          
          <button
            onClick={loadProducts}
            disabled={!selectedStore}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Store Selection */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <Store className="h-5 w-5 text-gray-400" />
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a store</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} ({store.platform})
              </option>
            ))}
          </select>
          
          {currentStore && (
            <div className="text-sm text-gray-600">
              {filteredProducts.length} products
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Error Loading Products</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={loadProducts}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {selectedStore && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search products by name, SKU, or vendor..."
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
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Product Catalog ({filteredProducts.length} products)
              </h3>
            </div>
            
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-gray-600">Loading products...</p>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
                {filteredProducts.map((product) => {
                  const status = formatProductStatus(product.status);
                  
                  return (
                    <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {product.title}
                          </h4>
                          {product.sku && (
                            <p className="text-xs text-gray-500 mt-1">SKU: {product.sku}</p>
                          )}
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      
                      {product.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-900">
                            {formatPrice(product.price)}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <Archive className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {product.inventory_quantity || 0}
                          </span>
                        </div>
                      </div>
                      
                      {product.vendor && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-500">
                            Vendor: {product.vendor}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Found</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  {products.length === 0 
                    ? "No products have been synced from this store yet. Try syncing your store data."
                    : "No products match your current search criteria. Try adjusting your filters."
                  }
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Products;