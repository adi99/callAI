import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database';
import { ApiResponse } from '../types';

const router = Router();
const dbService = DatabaseService.getInstance();

// GET /api/stores - Get all stores
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await dbService.getStores();
    
    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to fetch stores'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Stores fetched successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Internal server error'
    } as ApiResponse);
  }
});

// GET /api/stores/dashboard-overview - Get overview stats for all stores
router.get('/dashboard-overview', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get all stores
    const storesResult = await dbService.getStores();
    if (!storesResult.success) {
      res.status(500).json({
        success: false,
        error: storesResult.error,
        message: 'Failed to fetch stores'
      } as ApiResponse);
      return;
    }

    const stores = storesResult.data || [];
    
    let totalProducts = 0;
    let totalOrders = 0;
    let connectedStores = 0;

    // Aggregate data from all stores
    for (const store of stores) {
      if (store.status === 'connected') {
        connectedStores++;
      }

      // Get products count for this store
      const productsResult = await dbService.getProducts(store.id);
      if (productsResult.success && productsResult.data) {
        totalProducts += productsResult.data.length;
      }

      // Get orders count for this store
      const ordersResult = await dbService.getOrders(store.id);
      if (ordersResult.success && ordersResult.data) {
        totalOrders += ordersResult.data.length;
      }
    }

    const overviewStats = {
      totalStores: stores.length,
      connectedStores,
      disconnectedStores: stores.length - connectedStores,
      totalProducts,
      totalOrders,
      stores: stores.map(store => ({
        id: store.id,
        name: store.name,
        domain: store.domain,
        platform: store.platform,
        status: store.status,
        lastSyncAt: store.last_sync_at || store.updated_at
      }))
    };

    res.json({
      success: true,
      data: overviewStats,
      message: 'Dashboard overview fetched successfully'
    } as ApiResponse);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch dashboard overview'
    } as ApiResponse);
  }
});

// GET /api/stores/:id - Get store by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await dbService.getStoreById(id);
    
    if (!result.success) {
      res.status(404).json({
        success: false,
        error: result.error,
        message: 'Store not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Store fetched successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Internal server error'
    } as ApiResponse);
  }
});

// POST /api/stores - Create new store
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const storeData = req.body;
    
    const requiredFields = ['name', 'domain', 'platform'];
    for (const field of requiredFields) {
      if (!storeData[field]) {
        res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`,
          message: 'Invalid store data'
        } as ApiResponse);
        return;
      }
    }

    const result = await dbService.createStore(storeData);
    
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        message: 'Failed to create store'
      } as ApiResponse);
      return;
    }

    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Store created successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Internal server error'
    } as ApiResponse);
  }
});

// PUT /api/stores/:id - Update store
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const result = await dbService.updateStore(id, updates);
    
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        message: 'Failed to update store'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Store updated successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Internal server error'
    } as ApiResponse);
  }
});

// GET /api/stores/:id/products - Get products for store
router.get('/:id/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await dbService.getProducts(id);
    
    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to fetch products'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Products fetched successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Internal server error'
    } as ApiResponse);
  }
});

// GET /api/stores/:id/orders - Get orders for store
router.get('/:id/orders', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await dbService.getOrders(id);
    
    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to fetch orders'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Orders fetched successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Internal server error'
    } as ApiResponse);
  }
});

// GET /api/stores/:id/settings - Get settings for store
router.get('/:id/settings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { category } = req.query;
    
    const result = await dbService.getSettings(id, category as string);
    
    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to fetch settings'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Settings fetched successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Internal server error'
    } as ApiResponse);
  }
});

// PUT /api/stores/:id/settings - Update store setting
router.put('/:id/settings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { category, key, value } = req.body;
    
    if (!category || !key || value === undefined) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: category, key, value',
        message: 'Invalid setting data'
      } as ApiResponse);
      return;
    }

    const result = await dbService.updateSetting(id, category, key, value);
    
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        message: 'Failed to update setting'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Setting updated successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Internal server error'
    } as ApiResponse);
  }
});

// GET /api/stores/:id/test-connection - Test store connection
router.get('/:id/test-connection', async (req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = await dbService.testConnection();
    
    res.json({
      success: true,
      data: { isHealthy },
      message: isHealthy ? 'Database connection is healthy' : 'Database connection issues detected'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Connection test failed'
    } as ApiResponse);
  }
});

// GET /api/stores/:id/dashboard-stats - Get comprehensive dashboard stats for a store
router.get('/:id/dashboard-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Get store info
    const storeResult = await dbService.getStoreById(id);
    if (!storeResult.success) {
      res.status(404).json({
        success: false,
        error: 'Store not found',
        message: 'Invalid store ID'
      } as ApiResponse);
      return;
    }

    const store = storeResult.data;

    // Get products count
    const productsResult = await dbService.getProducts(id);
    const productCount = productsResult.success ? (productsResult.data?.length || 0) : 0;

    // Get orders count
    const ordersResult = await dbService.getOrders(id);
    const orderCount = ordersResult.success ? (ordersResult.data?.length || 0) : 0;

    // Calculate sync status
    const lastSyncAt = store.last_sync_at || store.updated_at;
    const isRecentSync = lastSyncAt ? 
      (Date.now() - new Date(lastSyncAt).getTime()) < (24 * 60 * 60 * 1000) : // Within 24 hours
      false;

    // Get webhook health (simplified - check if store has webhook credentials)
    const webhookHealthy = store.status === 'connected';

    const dashboardStats = {
      store: {
        id: store.id,
        name: store.name,
        domain: store.domain,
        platform: store.platform,
        status: store.status,
        created_at: store.created_at,
        updated_at: store.updated_at
      },
      syncStatus: {
        lastSyncAt,
        isRecentSync,
        webhookHealthy,
        status: isRecentSync && webhookHealthy ? 'healthy' : 'warning'
      },
      counts: {
        products: productCount,
        orders: orderCount,
        totalItems: productCount + orderCount
      },
      metadata: {
        connectionEstablished: store.created_at,
        dataFreshness: lastSyncAt ? 
          Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60)) : // Hours since last sync
          null
      }
    };

    res.json({
      success: true,
      data: dashboardStats,
      message: 'Dashboard stats fetched successfully'
    } as ApiResponse);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch dashboard stats'
    } as ApiResponse);
  }
});

export default router; 