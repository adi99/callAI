import { Router, Request, Response } from 'express';
import { ShopifyService } from '../services/shopifyService';
import { DatabaseService } from '../services/database';
import { ApiResponse } from '../types';

const router = Router();
const shopifyService = ShopifyService.getInstance();
const dbService = DatabaseService.getInstance();

// GET /api/products/:storeId - Get products for a specific store
router.get('/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const { data: products, error, count } = await dbService.getClient()
      .from('products')
      .select('*', { count: 'exact' })
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        products: products || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum)
        }
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch products'
    } as ApiResponse);
  }
});

// POST /api/products/:storeId/sync - Trigger full product sync for a store
router.post('/:storeId/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { incremental = false } = req.body;

    console.log(`Starting ${incremental ? 'incremental' : 'full'} product sync for store ${storeId}`);

    let result;
    if (incremental) {
      result = await shopifyService.syncProductsIncremental(storeId);
    } else {
      result = await shopifyService.syncProducts(storeId);
    }

    const response: ApiResponse = {
      success: true,
      message: `Product sync completed: ${result.synced} products synced`,
      data: {
        syncedCount: result.synced,
        errors: result.errors,
        hasErrors: result.errors.length > 0
      }
    };

    if (result.errors.length > 0) {
      response.message += ` with ${result.errors.length} errors`;
    }

    res.json(response);

  } catch (error) {
    console.error('Error syncing products:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to sync products'
    } as ApiResponse);
  }
});

// GET /api/products/:storeId/sync-status - Get sync status for a store
router.get('/:storeId/sync-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;

    // Get store info including last sync time
    const storesResult = await dbService.getStores();
    if (!storesResult.success || !storesResult.data) {
      throw new Error('Failed to fetch stores');
    }

    const store = storesResult.data.find(s => s.id === storeId);
    if (!store) {
      res.status(404).json({
        success: false,
        error: 'Store not found',
        message: 'Store not found'
      } as ApiResponse);
      return;
    }

    // Get product count
    const { count: productCount } = await dbService.getClient()
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId);

    res.json({
      success: true,
      data: {
        storeId,
        storeName: store.name,
        storeDomain: store.domain,
        lastSyncAt: store.lastSyncAt,
        productCount: productCount || 0,
        isConnected: store.status === 'connected'
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to get sync status'
    } as ApiResponse);
  }
});

// GET /api/products/:storeId/:productId - Get specific product details
router.get('/:storeId/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, productId } = req.params;

    const { data: product, error } = await dbService.getClient()
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('external_id', productId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({
          success: false,
          error: 'Product not found',
          message: 'Product not found'
        } as ApiResponse);
        return;
      }
      throw error;
    }

    res.json({
      success: true,
      data: product
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch product details'
    } as ApiResponse);
  }
});

// DELETE /api/products/:storeId/:productId - Delete a product
router.delete('/:storeId/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, productId } = req.params;

    const { error } = await dbService.getClient()
      .from('products')
      .delete()
      .eq('store_id', storeId)
      .eq('external_id', productId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Product deleted successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to delete product'
    } as ApiResponse);
  }
});

// GET /api/products/:storeId/stats - Get product statistics for a store  
router.get('/:storeId/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;

    // Get total product count
    const { count: totalProducts } = await dbService.getClient()
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId);

    // Get published product count
    const { count: publishedProducts } = await dbService.getClient()
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('status', 'active');

    // Get product count by vendor (top 10)
    const { data: vendorStats } = await dbService.getClient()
      .from('products')
      .select('vendor')
      .eq('store_id', storeId)
      .not('vendor', 'is', null);

    const vendorCounts: Record<string, number> = {};
    vendorStats?.forEach(product => {
      if (product.vendor) {
        vendorCounts[product.vendor] = (vendorCounts[product.vendor] || 0) + 1;
      }
    });

    const topVendors = Object.entries(vendorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([vendor, count]) => ({ vendor, count }));

    // Get recent products (last 10)
    const { data: recentProducts } = await dbService.getClient()
      .from('products')
      .select('id, title, external_id, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      success: true,
      data: {
        totalProducts: totalProducts || 0,
        publishedProducts: publishedProducts || 0,
        draftProducts: (totalProducts || 0) - (publishedProducts || 0),
        topVendors,
        recentProducts: recentProducts || []
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch product statistics'
    } as ApiResponse);
  }
});

// GET /api/products/test - Test endpoint to verify products API is working
router.get('/test', async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Products API is ready',
    timestamp: new Date().toISOString(),
    endpoints: {
      getProducts: 'GET /api/products/:storeId',
      syncProducts: 'POST /api/products/:storeId/sync',
      getSyncStatus: 'GET /api/products/:storeId/sync-status',
      getProductDetails: 'GET /api/products/:storeId/:productId',
      deleteProduct: 'DELETE /api/products/:storeId/:productId',
      getStats: 'GET /api/products/:storeId/stats'
    }
  } as ApiResponse);
});

export default router; 