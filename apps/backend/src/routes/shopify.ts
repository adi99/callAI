import { Router, Request, Response } from 'express';
import { ShopifyService, ShopifyOAuthParams } from '../services/shopifyService';
import { ApiResponse } from '../types';

const router = Router();
const shopifyService = ShopifyService.getInstance();

// GET /api/auth/shopify/install - Initiate Shopify OAuth flow
router.get('/install', async (req: Request, res: Response): Promise<void> => {
  try {
    const { shop } = req.query;

    if (!shop || typeof shop !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Shop parameter is required',
        message: 'Please provide a valid shop domain'
      } as ApiResponse);
      return;
    }

    const shopDomain = shop.replace('.myshopify.com', '');
    
    if (!shopifyService.validateShopDomain(shopDomain)) {
      res.status(400).json({
        success: false,
        error: 'Invalid shop domain',
        message: 'Please provide a valid Shopify shop domain'
      } as ApiResponse);
      return;
    }

    const state = shopifyService.generateState();
    
    // Store state in session or temporary storage for validation
    req.session = req.session || {};
    (req.session as any).oauthState = state;
    (req.session as any).shopDomain = shopDomain;

    const authUrl = shopifyService.generateOAuthURL(shopDomain, state);

    res.json({
      success: true,
      data: {
        authUrl,
        state,
        shop: shopDomain
      },
      message: 'OAuth URL generated successfully'
    } as ApiResponse);
    
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to initiate OAuth flow'
    } as ApiResponse);
  }
});

// GET /api/auth/shopify/callback - Handle OAuth callback
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, hmac, shop, state, timestamp } = req.query;

    if (!code || !hmac || !shop || !state || !timestamp) {
      res.status(400).json({
        success: false,
        error: 'Missing required OAuth parameters',
        message: 'Invalid OAuth callback'
      } as ApiResponse);
      return;
    }

    // Validate state parameter
    if (!(req.session as any)?.oauthState || (req.session as any).oauthState !== state) {
      res.status(400).json({
        success: false,
        error: 'Invalid state parameter',
        message: 'OAuth state validation failed'
      } as ApiResponse);
      return;
    }

    const oauthParams: ShopifyOAuthParams = {
      shop: shop as string,
      code: code as string,
      state: state as string,
      timestamp: timestamp as string,
      hmac: hmac as string
    };

    // Validate HMAC
    if (!shopifyService.validateOAuthCallback(oauthParams)) {
      res.status(400).json({
        success: false,
        error: 'Invalid HMAC signature',
        message: 'OAuth callback validation failed'
      } as ApiResponse);
      return;
    }

    const shopDomain = (shop as string).replace('.myshopify.com', '');

    // Exchange code for access token
    const tokenData = await shopifyService.exchangeCodeForToken(shopDomain, code as string);
    
    // Get shop information
    const shopInfo = await shopifyService.getShopInfo(shopDomain, tokenData.access_token);

    // Store the connection
    const storeId = await shopifyService.storeShopifyConnection(
      shopDomain,
      tokenData.access_token,
      tokenData.scope,
      shopInfo
    );

    // Clear session state
    if (req.session) {
      delete (req.session as any).oauthState;
      delete (req.session as any).shopDomain;
    }

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/connect-store?success=true&store=${storeId}&shop=${shopDomain}`);

  } catch (error) {
    console.error('Error in OAuth callback:', error);
    
    // Redirect to frontend with error
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`${frontendUrl}/connect-store?error=${encodeURIComponent(errorMessage)}`);
  }
});

// GET /api/auth/shopify/status/:storeId - Check connection status
router.get('/status/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;

    // Get store info
    const storeResult = await require('../services/database').default.getStoreById(storeId);
    
    if (!storeResult.success) {
      res.status(404).json({
        success: false,
        error: 'Store not found',
        message: 'Store connection not found'
      } as ApiResponse);
      return;
    }

    const store = storeResult.data;
    
    // Check if we have a valid access token
    const accessToken = await shopifyService.getAccessToken(storeId);
    
    if (!accessToken) {
      res.status(401).json({
        success: false,
        error: 'No access token found',
        message: 'Store connection is not authenticated'
      } as ApiResponse);
      return;
    }

    // Test the connection by making a simple API call
    try {
      const shopDomain = store.domain.replace('.myshopify.com', '');
      const shopInfo = await shopifyService.getShopInfo(shopDomain, accessToken);
      
      res.json({
        success: true,
        data: {
          store: {
            id: store.id,
            name: store.name,
            domain: store.domain,
            platform: store.platform,
            is_active: store.is_active,
            connected_at: store.created_at,
            last_sync: store.sync_settings?.last_sync || null
          },
          shopInfo: {
            name: shopInfo.name,
            email: shopInfo.email,
            currency: shopInfo.currency,
            timezone: shopInfo.timezone,
            plan: shopInfo.plan_display_name
          },
          connection_status: 'active'
        },
        message: 'Store connection is active'
      } as ApiResponse);
      
    } catch (apiError) {
      res.status(401).json({
        success: false,
        error: 'Connection test failed',
        message: 'Store connection is not working properly',
        data: {
          connection_status: 'failed',
          error: apiError instanceof Error ? apiError.message : 'Unknown API error'
        }
      } as ApiResponse);
    }

  } catch (error) {
    console.error('Error checking connection status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to check connection status'
    } as ApiResponse);
  }
});

// DELETE /api/auth/shopify/disconnect/:storeId - Disconnect store
router.delete('/disconnect/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;

    // Get store info
    const storeResult = await require('../services/database').default.getStoreById(storeId);
    
    if (!storeResult.success) {
      res.status(404).json({
        success: false,
        error: 'Store not found',
        message: 'Store connection not found'
      } as ApiResponse);
      return;
    }

    const store = storeResult.data;
    const accessToken = await shopifyService.getAccessToken(storeId);

    // Revoke webhooks if we have access token
    if (accessToken) {
      try {
        const shopDomain = store.domain.replace('.myshopify.com', '');
        
        // Get existing webhooks
        const webhooks = await shopifyService.makeAPICall(
          shopDomain,
          accessToken,
          'webhooks.json'
        );

        // Delete webhooks
        for (const webhook of webhooks.webhooks || []) {
          await shopifyService.makeAPICall(
            shopDomain,
            accessToken,
            `webhooks/${webhook.id}.json`,
            'DELETE'
          );
        }
      } catch (webhookError) {
        console.error('Error removing webhooks:', webhookError);
      }
    }

    // Delete stored credentials
    const credentials = await shopifyService.credentialService.getStoreCredentials(storeId);
    for (const credential of credentials) {
      await shopifyService.credentialService.deleteCredential(credential.id);
    }

    // Deactivate the store
    await require('../services/database').default.updateStore(storeId, {
      is_active: false,
      sync_settings: {
        ...store.sync_settings,
        auto_sync: false
      }
    });

    res.json({
      success: true,
      message: 'Store disconnected successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error disconnecting store:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to disconnect store'
    } as ApiResponse);
  }
});

// GET /api/shopify/orders/test-connectivity/:storeId - Test order API connectivity
router.get('/orders/test-connectivity/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      res.status(400).json({
        success: false,
        error: 'Store ID is required',
        message: 'Please provide a valid store ID'
      } as ApiResponse);
      return;
    }

    const result = await shopifyService.testOrderAPIConnectivity(storeId);

    res.json({
      success: result.success,
      data: {
        storeId,
        orderCount: result.orderCount,
        connected: result.success
      },
      message: result.message
    } as ApiResponse);

  } catch (error) {
    console.error('Error testing order API connectivity:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to test order API connectivity'
    } as ApiResponse);
  }
});

// GET /api/shopify/orders/recent/:storeId - Fetch most recent order
router.get('/orders/recent/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      res.status(400).json({
        success: false,
        error: 'Store ID is required',
        message: 'Please provide a valid store ID'
      } as ApiResponse);
      return;
    }

    const order = await shopifyService.fetchMostRecentOrder(storeId);

    if (!order) {
      res.json({
        success: true,
        data: null,
        message: 'No orders found in this store'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          total_price: order.total_price,
          currency: order.currency,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          created_at: order.created_at,
          customer: order.customer,
          line_items: order.line_items,
          shipping_address: order.shipping_address
        }
      },
      message: 'Most recent order fetched successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching most recent order:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch most recent order'
    } as ApiResponse);
  }
});

// GET /api/shopify/orders/:storeId/:orderId - Fetch specific order by ID
router.get('/orders/:storeId/:orderId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, orderId } = req.params;

    if (!storeId || !orderId) {
      res.status(400).json({
        success: false,
        error: 'Store ID and Order ID are required',
        message: 'Please provide both store ID and order ID'
      } as ApiResponse);
      return;
    }

    const order = await shopifyService.fetchOrderById(storeId, orderId);

    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          total_price: order.total_price,
          currency: order.currency,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          created_at: order.created_at,
          customer: order.customer,
          line_items: order.line_items,
          shipping_address: order.shipping_address
        }
      },
      message: 'Order fetched successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch order'
    } as ApiResponse);
  }
});

// GET /api/shopify/orders/historical/:storeId - Fetch historical orders with pagination
router.get('/orders/historical/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { 
      limit, 
      sinceDate, 
      untilDate, 
      status, 
      financialStatus, 
      fulfillmentStatus 
    } = req.query;

    if (!storeId) {
      res.status(400).json({
        success: false,
        error: 'Store ID is required',
        message: 'Please provide a valid store ID'
      } as ApiResponse);
      return;
    }

    const options: any = {};
    
    if (limit) options.limit = parseInt(limit as string);
    if (sinceDate) options.sinceDate = new Date(sinceDate as string);
    if (untilDate) options.untilDate = new Date(untilDate as string);
    if (status) options.status = status as string;
    if (financialStatus) options.financialStatus = financialStatus as string;
    if (fulfillmentStatus) options.fulfillmentStatus = fulfillmentStatus as string;

    const result = await shopifyService.fetchHistoricalOrders(storeId, options);

    res.json({
      success: true,
      data: {
        orders: result.orders.map(order => ({
          id: order.id,
          order_number: order.order_number,
          total_price: order.total_price,
          currency: order.currency,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          created_at: order.created_at,
          updated_at: order.updated_at,
          customer: order.customer ? {
            id: order.customer.id,
            email: order.customer.email,
            first_name: order.customer.first_name,
            last_name: order.customer.last_name
          } : null,
          line_items_count: order.line_items?.length || 0
        })),
        totalCount: result.totalCount,
        hasMore: result.hasMore
      },
      message: `Fetched ${result.totalCount} historical orders`
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching historical orders:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch historical orders'
    } as ApiResponse);
  }
});

// GET /api/shopify/orders/all-historical/:storeId - Fetch all historical orders with full pagination
router.get('/orders/all-historical/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { 
      sinceDate, 
      untilDate, 
      status, 
      financialStatus, 
      fulfillmentStatus,
      maxPages
    } = req.query;

    if (!storeId) {
      res.status(400).json({
        success: false,
        error: 'Store ID is required',
        message: 'Please provide a valid store ID'
      } as ApiResponse);
      return;
    }

    const options: any = {};
    
    if (sinceDate) options.sinceDate = new Date(sinceDate as string);
    if (untilDate) options.untilDate = new Date(untilDate as string);
    if (status) options.status = status as string;
    if (financialStatus) options.financialStatus = financialStatus as string;
    if (fulfillmentStatus) options.fulfillmentStatus = fulfillmentStatus as string;
    if (maxPages) options.maxPages = parseInt(maxPages as string);

    const result = await shopifyService.fetchAllHistoricalOrders(storeId, options);

    res.json({
      success: true,
      data: {
        orders: result.orders.map(order => ({
          id: order.id,
          order_number: order.order_number,
          total_price: order.total_price,
          currency: order.currency,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          created_at: order.created_at,
          updated_at: order.updated_at,
          customer: order.customer ? {
            id: order.customer.id,
            email: order.customer.email,
            first_name: order.customer.first_name,
            last_name: order.customer.last_name
          } : null,
          line_items_count: order.line_items?.length || 0
        })),
        totalCount: result.totalCount,
        pagesProcessed: result.pagesProcessed
      },
      message: `Fetched ${result.totalCount} orders from ${result.pagesProcessed} pages`
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching all historical orders:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch all historical orders'
    } as ApiResponse);
  }
});

// GET /api/shopify/orders/since/:storeId - Fetch orders since a specific date
router.get('/orders/since/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { sinceDate, useUpdatedAt, status, limit } = req.query;

    if (!storeId) {
      res.status(400).json({
        success: false,
        error: 'Store ID is required',
        message: 'Please provide a valid store ID'
      } as ApiResponse);
      return;
    }

    if (!sinceDate) {
      res.status(400).json({
        success: false,
        error: 'Since date is required',
        message: 'Please provide a valid since date'
      } as ApiResponse);
      return;
    }

    const options: any = {};
    if (useUpdatedAt === 'true') options.useUpdatedAt = true;
    if (status) options.status = status as string;
    if (limit) options.limit = parseInt(limit as string);

    const result = await shopifyService.fetchOrdersSince(storeId, new Date(sinceDate as string), options);

    res.json({
      success: true,
      data: {
        orders: result.orders.map(order => ({
          id: order.id,
          order_number: order.order_number,
          total_price: order.total_price,
          currency: order.currency,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          created_at: order.created_at,
          updated_at: order.updated_at,
          customer: order.customer ? {
            id: order.customer.id,
            email: order.customer.email,
            first_name: order.customer.first_name,
            last_name: order.customer.last_name
          } : null,
          line_items_count: order.line_items?.length || 0
        })),
        totalCount: result.totalCount,
        sinceDate: sinceDate as string,
        useUpdatedAt: options.useUpdatedAt || false
      },
      message: `Fetched ${result.totalCount} orders since ${sinceDate}`
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching orders since date:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch orders since date'
    } as ApiResponse);
  }
});

// GET /api/shopify/orders/historical/:storeId - Fetch historical orders with pagination
router.get('/orders/historical/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { 
      limit, 
      sinceDate, 
      untilDate, 
      status, 
      financialStatus, 
      fulfillmentStatus 
    } = req.query;

    if (!storeId) {
      res.status(400).json({
        success: false,
        error: 'Store ID is required',
        message: 'Please provide a valid store ID'
      } as ApiResponse);
      return;
    }

    const options: any = {};
    
    if (limit) options.limit = parseInt(limit as string);
    if (sinceDate) options.sinceDate = new Date(sinceDate as string);
    if (untilDate) options.untilDate = new Date(untilDate as string);
    if (status) options.status = status as string;
    if (financialStatus) options.financialStatus = financialStatus as string;
    if (fulfillmentStatus) options.fulfillmentStatus = fulfillmentStatus as string;

    const result = await shopifyService.fetchHistoricalOrders(storeId, options);

    res.json({
      success: true,
      data: {
        orders: result.orders.map(order => ({
          id: order.id,
          order_number: order.order_number,
          total_price: order.total_price,
          currency: order.currency,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          created_at: order.created_at,
          updated_at: order.updated_at,
          customer: order.customer ? {
            id: order.customer.id,
            email: order.customer.email,
            first_name: order.customer.first_name,
            last_name: order.customer.last_name
          } : null,
          line_items_count: order.line_items?.length || 0
        })),
        totalCount: result.totalCount,
        hasMore: result.hasMore
      },
      message: `Fetched ${result.totalCount} historical orders`
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching historical orders:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch historical orders'
    } as ApiResponse);
  }
});

// GET /api/shopify/orders/since/:storeId - Fetch orders since a specific date
router.get('/orders/since/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { sinceDate, useUpdatedAt, status } = req.query;

    if (!storeId) {
      res.status(400).json({
        success: false,
        error: 'Store ID is required',
        message: 'Please provide a valid store ID'
      } as ApiResponse);
      return;
    }

    if (!sinceDate) {
      res.status(400).json({
        success: false,
        error: 'Since date is required',
        message: 'Please provide a valid since date'
      } as ApiResponse);
      return;
    }

    const options: any = {};
    if (useUpdatedAt === 'true') options.useUpdatedAt = true;
    if (status) options.status = status as string;

    const result = await shopifyService.fetchOrdersSince(storeId, new Date(sinceDate as string), options);

    res.json({
      success: true,
      data: {
        orders: result.orders.map(order => ({
          id: order.id,
          order_number: order.order_number,
          total_price: order.total_price,
          currency: order.currency,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          created_at: order.created_at,
          updated_at: order.updated_at
        })),
        totalCount: result.totalCount,
        sinceDate: sinceDate as string
      },
      message: `Fetched ${result.totalCount} orders since ${sinceDate}`
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching orders since date:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch orders since date'
    } as ApiResponse);
  }
});

export default router; 