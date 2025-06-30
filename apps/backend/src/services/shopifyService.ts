import crypto from 'crypto';
import fetch from 'node-fetch';
import { CredentialService } from './credentialService';
import { DatabaseService } from './database';
import { EnvValidator } from '../utils/envValidator';

export interface ShopifyOAuthParams {
  shop: string;
  code: string;
  state: string;
  timestamp: string;
  hmac: string;
}

export interface ShopifyAccessToken {
  access_token: string;
  scope: string;
}

export interface ShopifyShopInfo {
  id: number;
  name: string;
  email: string;
  domain: string;
  province: string;
  country: string;
  address1: string;
  zip: string;
  city: string;
  source: string;
  phone: string;
  latitude: number;
  longitude: number;
  primary_location_id: number;
  primary_locale: string;
  address2: string;
  created_at: string;
  updated_at: string;
  country_code: string;
  country_name: string;
  currency: string;
  customer_email: string;
  timezone: string;
  iana_timezone: string;
  shop_owner: string;
  money_format: string;
  money_with_currency_format: string;
  weight_unit: string;
  province_code: string;
  taxes_included: boolean;
  auto_configure_tax_inclusivity: boolean;
  tax_shipping: boolean;
  county_taxes: boolean;
  plan_display_name: string;
  plan_name: string;
  has_discounts: boolean;
  has_gift_cards: boolean;
  myshopify_domain: string;
  google_apps_domain: string;
  google_apps_login_enabled: boolean;
  money_in_emails_format: string;
  money_with_currency_in_emails_format: string;
  eligible_for_payments: boolean;
  requires_extra_payments_agreement: boolean;
  password_enabled: boolean;
  has_storefront: boolean;
  eligible_for_card_reader_giveaway: boolean;
  finances: boolean;
  primary_location: {
    id: number;
    name: string;
    address1: string;
    address2: string;
    city: string;
    zip: string;
    province: string;
    country: string;
    phone: string;
    created_at: string;
    updated_at: string;
    country_code: string;
    country_name: string;
    province_code: string;
    legacy: boolean;
    active: boolean;
  };
}

export class ShopifyService {
  private static instance: ShopifyService;
  public credentialService: CredentialService;
  private dbService: DatabaseService;
  private config: ReturnType<typeof EnvValidator.getConfig>;

  private constructor() {
    this.credentialService = CredentialService.getInstance();
    this.dbService = DatabaseService.getInstance();
    this.config = EnvValidator.getConfig();
  }

  static getInstance(): ShopifyService {
    if (!ShopifyService.instance) {
      ShopifyService.instance = new ShopifyService();
    }
    return ShopifyService.instance;
  }

  generateOAuthURL(shop: string, state: string): string {
    if (!this.config.SHOPIFY_CLIENT_ID) {
      throw new Error('SHOPIFY_CLIENT_ID not configured');
    }

    const scopes = [
      'read_products',
      'read_orders', 
      'read_customers',
      'read_inventory',
      'read_shipping',
      'read_analytics'
    ].join(',');

    const redirectUri = `${this.config.WEBHOOK_BASE_URL || this.config.FRONTEND_URL}/api/auth/shopify/callback`;

    const params = new URLSearchParams({
      client_id: this.config.SHOPIFY_CLIENT_ID,
      scope: scopes,
      redirect_uri: redirectUri,
      state: state,
      'grant_options[]': 'per-user'
    });

    return `https://${shop}.myshopify.com/admin/oauth/authorize?${params.toString()}`;
  }

  validateOAuthCallback(params: ShopifyOAuthParams): boolean {
    if (!this.config.SHOPIFY_CLIENT_SECRET) {
      throw new Error('SHOPIFY_CLIENT_SECRET not configured');
    }

    const { hmac, ...otherParams } = params;
    
    const queryString = Object.keys(otherParams)
      .sort()
      .map(key => `${key}=${otherParams[key as keyof typeof otherParams]}`)
      .join('&');

    const calculatedHmac = crypto
      .createHmac('sha256', this.config.SHOPIFY_CLIENT_SECRET)
      .update(queryString)
      .digest('hex');

    return calculatedHmac === hmac;
  }

  async exchangeCodeForToken(shop: string, code: string): Promise<ShopifyAccessToken> {
    if (!this.config.SHOPIFY_CLIENT_ID || !this.config.SHOPIFY_CLIENT_SECRET) {
      throw new Error('Shopify client credentials not configured');
    }

    const redirectUri = `${this.config.WEBHOOK_BASE_URL || this.config.FRONTEND_URL}/api/auth/shopify/callback`;

    const response = await fetch(`https://${shop}.myshopify.com/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.SHOPIFY_CLIENT_ID,
        client_secret: this.config.SHOPIFY_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code for token: ${response.status} ${errorText}`);
    }

    return await response.json() as ShopifyAccessToken;
  }

  async getShopInfo(shop: string, accessToken: string): Promise<ShopifyShopInfo> {
    const response = await fetch(`https://${shop}.myshopify.com/admin/api/2023-10/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get shop info: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.shop;
  }

  async storeShopifyConnection(
    shop: string, 
    accessToken: string, 
    scope: string, 
    shopInfo: ShopifyShopInfo
  ): Promise<string> {
    try {
      const storeResult = await this.dbService.createStore({
        name: shopInfo.name,
        domain: shop + '.myshopify.com',
        platform: 'shopify',
        is_active: true,
        sync_settings: {
          auto_sync: true,
          sync_products: true,
          sync_orders: true,
          sync_customers: true,
          last_sync: null
        },
        platform_data: shopInfo
      });

      if (!storeResult.success || !storeResult.data) {
        throw new Error('Failed to create store record');
      }

      const storeId = storeResult.data.id;

      await this.credentialService.storeCredential(
        storeId,
        'shopify',
        'access_token',
        accessToken
      );

      const webhookSecret = crypto.randomBytes(32).toString('hex');
      await this.credentialService.storeCredential(
        storeId,
        'shopify', 
        'webhook_secret',
        webhookSecret
      );

      await this.setupWebhooks(shop, accessToken, webhookSecret);

      return storeId;
    } catch (error) {
      throw new Error(`Failed to store Shopify connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async setupWebhooks(shop: string, accessToken: string, webhookSecret: string): Promise<void> {
    const webhookUrl = `${this.config.WEBHOOK_BASE_URL || this.config.FRONTEND_URL}/api/webhooks/shopify`;
    
    const webhooks = [
      { topic: 'products/create', address: webhookUrl },
      { topic: 'products/update', address: webhookUrl },
      { topic: 'products/delete', address: webhookUrl },
      { topic: 'orders/create', address: webhookUrl },
      { topic: 'orders/updated', address: webhookUrl },
      { topic: 'orders/paid', address: webhookUrl },
      { topic: 'orders/cancelled', address: webhookUrl },
      { topic: 'orders/fulfilled', address: webhookUrl },
      { topic: 'customers/create', address: webhookUrl },
      { topic: 'customers/update', address: webhookUrl }
    ];

    for (const webhook of webhooks) {
      try {
        await fetch(`https://${shop}.myshopify.com/admin/api/2023-10/webhooks.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            webhook: {
              topic: webhook.topic,
              address: webhook.address,
              format: 'json'
            }
          })
        });
      } catch (error) {
        console.error(`Failed to create webhook for ${webhook.topic}:`, error);
      }
    }
  }

  async getAccessToken(storeId: string): Promise<string | null> {
    try {
      const credentials = await this.credentialService.getStoreCredentials(storeId, 'access_token');
      if (credentials.length === 0) {
        return null;
      }
      return await this.credentialService.getCredential(credentials[0].id);
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  async makeAPICall(shop: string, accessToken: string, endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `https://${shop}.myshopify.com/admin/api/2023-10/${endpoint}`;
    
    const options: any = {
      method,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  validateShopDomain(shop: string): boolean {
    const shopPattern = /^[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]$/;
    return shopPattern.test(shop) && shop.length >= 3 && shop.length <= 60;
  }

  // Product Sync Methods

  /**
   * Fetch all products from a Shopify store
   */
  async fetchProducts(storeId: string, limit: number = 250): Promise<any[]> {
    try {
      const credentials = await this.credentialService.getStoreCredentials(storeId, 'access_token');
      if (credentials.length === 0) {
        throw new Error('No access token found for store');
      }

      const accessToken = await this.credentialService.getCredential(credentials[0].id);
      if (!accessToken) {
        throw new Error('Could not retrieve access token');
      }

      const store = await this.getStoreById(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      const response = await fetch(`https://${store.domain}/admin/api/2023-10/products.json?limit=${limit}`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.products || [];
    } catch (error) {
      console.error('Error fetching products from Shopify:', error);
      throw error;
    }
  }

  /**
   * Fetch products with pagination support
   */
  async fetchAllProducts(storeId: string): Promise<any[]> {
    const allProducts: any[] = [];
    let pageInfo: string | null = null;
    const limit = 250;

    try {
      do {
        const products = await this.fetchProductsPage(storeId, limit, pageInfo);
        allProducts.push(...products.products);
        
        // Extract pagination info from Link header if available
        pageInfo = products.pageInfo;
      } while (pageInfo);

      return allProducts;
    } catch (error) {
      console.error('Error fetching all products:', error);
      throw error;
    }
  }

  /**
   * Fetch a single page of products with pagination
   */
  private async fetchProductsPage(storeId: string, limit: number, pageInfo: string | null = null): Promise<{ products: any[], pageInfo: string | null }> {
    try {
      const credentials = await this.credentialService.getStoreCredentials(storeId, 'access_token');
      if (credentials.length === 0) {
        throw new Error('No access token found for store');
      }

      const accessToken = await this.credentialService.getCredential(credentials[0].id);
      if (!accessToken) {
        throw new Error('Could not retrieve access token');
      }

      const store = await this.getStoreById(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      let url = `https://${store.domain}/admin/api/2023-10/products.json?limit=${limit}`;
      if (pageInfo) {
        url += `&page_info=${pageInfo}`;
      }

      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract next page info from Link header
      const linkHeader = response.headers.get('Link');
      let nextPageInfo: string | null = null;
      
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
        if (nextMatch) {
          nextPageInfo = nextMatch[1];
        }
      }

      return {
        products: data.products || [],
        pageInfo: nextPageInfo
      };
    } catch (error) {
      console.error('Error fetching products page:', error);
      throw error;
    }
  }

  /**
   * Sync products from Shopify to database
   */
  async syncProducts(storeId: string): Promise<{ synced: number, errors: string[] }> {
    const errors: string[] = [];
    let syncedCount = 0;

    try {
      console.log(`Starting product sync for store ${storeId}`);
      const products = await this.fetchAllProducts(storeId);
      
      console.log(`Fetched ${products.length} products from Shopify`);

      for (const product of products) {
        try {
          await this.syncSingleProduct(storeId, product);
          syncedCount++;
        } catch (error) {
          const errorMessage = `Failed to sync product ${product.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          errors.push(errorMessage);
        }
      }

      // Update store's last sync timestamp
      await this.dbService.updateStore(storeId, {
        lastSyncAt: new Date()
      });

      console.log(`Product sync completed: ${syncedCount} synced, ${errors.length} errors`);
      return { synced: syncedCount, errors };
    } catch (error) {
      const errorMessage = `Product sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage);
      errors.push(errorMessage);
      return { synced: syncedCount, errors };
    }
  }

  /**
   * Sync a single product to the database
   */
  private async syncSingleProduct(storeId: string, productData: any): Promise<void> {
    try {
      const productRecord = {
        store_id: storeId,
        external_id: productData.id.toString(),
        title: productData.title,
        description: productData.body_html || null,
        vendor: productData.vendor || null,
        product_type: productData.product_type || null,
        handle: productData.handle,
        status: productData.status,
        published_at: productData.published_at,
        tags: productData.tags || null,
        price: productData.variants?.[0]?.price ? parseFloat(productData.variants[0].price) : null,
        compare_at_price: productData.variants?.[0]?.compare_at_price ? parseFloat(productData.variants[0].compare_at_price) : null,
        sku: productData.variants?.[0]?.sku || null,
        inventory_quantity: productData.variants?.[0]?.inventory_quantity || 0,
        weight: productData.variants?.[0]?.weight ? parseFloat(productData.variants[0].weight) : null,
        weight_unit: productData.variants?.[0]?.weight_unit || 'grams',
        requires_shipping: productData.variants?.[0]?.requires_shipping || false,
        taxable: productData.variants?.[0]?.taxable || false,
        images: productData.images || [],
        options: productData.options || [],
        variants: productData.variants || [],
        platform_data: productData,
        created_at: productData.created_at,
        updated_at: productData.updated_at
      };

      // Check if product already exists
      const { data: existingProduct } = await this.dbService.getClient()
        .from('products')
        .select('id')
        .eq('store_id', storeId)
        .eq('external_id', productData.id.toString())
        .single();

      if (existingProduct) {
        // Update existing product
        const { error } = await this.dbService.getClient()
          .from('products')
          .update(productRecord)
          .eq('store_id', storeId)
          .eq('external_id', productData.id.toString());

        if (error) throw error;
        console.log(`Updated product: ${productData.title} (ID: ${productData.id})`);
      } else {
        // Insert new product
        const { error } = await this.dbService.getClient()
          .from('products')
          .insert(productRecord);

        if (error) throw error;
        console.log(`Created product: ${productData.title} (ID: ${productData.id})`);
      }
    } catch (error) {
      console.error(`Error syncing product ${productData.id}:`, error);
      throw error;
    }
  }

  /**
   * Get a store by ID from the database
   */
  private async getStoreById(storeId: string): Promise<any> {
    const storesResult = await this.dbService.getStores();
    if (!storesResult.success || !storesResult.data) {
      throw new Error('Failed to fetch stores');
    }
    
    return storesResult.data.find(store => store.id === storeId);
  }

  /**
   * Perform incremental product sync (for products updated since last sync)
   */
  async syncProductsIncremental(storeId: string, since?: Date): Promise<{ synced: number, errors: string[] }> {
    const errors: string[] = [];
    let syncedCount = 0;

    try {
      const store = await this.getStoreById(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      // Use last sync time if no since date provided
      const sinceDate = since || store.lastSyncAt || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24 hours ago
      
      console.log(`Starting incremental product sync for store ${storeId} since ${sinceDate.toISOString()}`);
      
      const credentials = await this.credentialService.getStoreCredentials(storeId, 'access_token');
      if (credentials.length === 0) {
        throw new Error('No access token found for store');
      }

      const accessToken = await this.credentialService.getCredential(credentials[0].id);
      if (!accessToken) {
        throw new Error('Could not retrieve access token');
      }

      const sinceParam = sinceDate.toISOString();
      const response = await fetch(`https://${store.domain}/admin/api/2023-10/products.json?updated_at_min=${sinceParam}&limit=250`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const products = data.products || [];
      
      console.log(`Fetched ${products.length} updated products from Shopify`);

      for (const product of products) {
        try {
          await this.syncSingleProduct(storeId, product);
          syncedCount++;
        } catch (error) {
          const errorMessage = `Failed to sync product ${product.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          errors.push(errorMessage);
        }
      }

      // Update store's last sync timestamp
      await this.dbService.updateStore(storeId, {
        lastSyncAt: new Date()
      });

      console.log(`Incremental product sync completed: ${syncedCount} synced, ${errors.length} errors`);
      return { synced: syncedCount, errors };
    } catch (error) {
      const errorMessage = `Incremental product sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage);
      errors.push(errorMessage);
      return { synced: syncedCount, errors };
    }
  }

  /**
   * Fetch a single order by ID
   */
  async fetchOrderById(storeId: string, orderId: string): Promise<any> {
    try {
      const credentials = await this.credentialService.getStoreCredentials(storeId, 'access_token');
      if (credentials.length === 0) {
        throw new Error('No access token found for store');
      }

      const accessToken = await this.credentialService.getCredential(credentials[0].id);
      if (!accessToken) {
        throw new Error('Could not retrieve access token');
      }

      const store = await this.getStoreById(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      console.log(`Fetching order ${orderId} from store ${storeId}`);
      
      const response = await fetch(`https://${store.domain}/admin/api/2023-10/orders/${orderId}.json`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Log the response structure for verification
      console.log('Order data structure:', {
        id: data.order?.id,
        order_number: data.order?.order_number,
        total_price: data.order?.total_price,
        currency: data.order?.currency,
        financial_status: data.order?.financial_status,
        fulfillment_status: data.order?.fulfillment_status,
        created_at: data.order?.created_at,
        customer: data.order?.customer ? {
          id: data.order.customer.id,
          email: data.order.customer.email,
          first_name: data.order.customer.first_name,
          last_name: data.order.customer.last_name
        } : null,
        line_items_count: data.order?.line_items?.length || 0,
        shipping_address: data.order?.shipping_address ? {
          city: data.order.shipping_address.city,
          country: data.order.shipping_address.country,
          zip: data.order.shipping_address.zip
        } : null
      });

      return data.order;
    } catch (error) {
      console.error('Error fetching order by ID:', error);
      throw error;  
    }
  }

  /**
   * Fetch the most recent order from the store
   */
  async fetchMostRecentOrder(storeId: string): Promise<any> {
    try {
      const credentials = await this.credentialService.getStoreCredentials(storeId, 'access_token');
      if (credentials.length === 0) {
        throw new Error('No access token found for store');
      }

      const accessToken = await this.credentialService.getCredential(credentials[0].id);
      if (!accessToken) {
        throw new Error('Could not retrieve access token');
      }

      const store = await this.getStoreById(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      console.log(`Fetching most recent order from store ${storeId}`);
      
      // Fetch orders ordered by created_at descending, limit to 1
      const response = await fetch(`https://${store.domain}/admin/api/2023-10/orders.json?limit=1&status=any&order=created_at+desc`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.orders || data.orders.length === 0) {
        console.log('No orders found in the store');
        return null;
      }

      const order = data.orders[0];
      
      // Log the response structure for verification
      console.log('Most recent order data structure:', {
        id: order.id,
        order_number: order.order_number,
        total_price: order.total_price,
        currency: order.currency,
        financial_status: order.financial_status,
        fulfillment_status: order.fulfillment_status,
        created_at: order.created_at,
        customer: order.customer ? {
          id: order.customer.id,
          email: order.customer.email,
          first_name: order.customer.first_name,
          last_name: order.customer.last_name
        } : null,
        line_items_count: order.line_items?.length || 0,
        shipping_address: order.shipping_address ? {
          city: order.shipping_address.city,
          country: order.shipping_address.country,
          zip: order.shipping_address.zip
        } : null
      });

      return order;
    } catch (error) {
      console.error('Error fetching most recent order:', error);
      throw error;
    }
  }

  /**
   * Test order API connectivity by fetching orders list
   */
  async testOrderAPIConnectivity(storeId: string): Promise<{ success: boolean, orderCount: number, message: string }> {
    try {
      const credentials = await this.credentialService.getStoreCredentials(storeId, 'access_token');
      if (credentials.length === 0) {
        return { success: false, orderCount: 0, message: 'No access token found for store' };
      }

      const accessToken = await this.credentialService.getCredential(credentials[0].id);
      if (!accessToken) {
        return { success: false, orderCount: 0, message: 'Could not retrieve access token' };
      }

      const store = await this.getStoreById(storeId);
      if (!store) {
        return { success: false, orderCount: 0, message: 'Store not found' };
      }

      console.log(`Testing order API connectivity for store ${storeId}`);
      
      const response = await fetch(`https://${store.domain}/admin/api/2023-10/orders.json?limit=5&status=any`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return { 
          success: false, 
          orderCount: 0, 
          message: `Shopify API error: ${response.status} ${response.statusText}` 
        };
      }

      const data = await response.json();
      const orderCount = data.orders?.length || 0;
      
      console.log(`Order API connectivity test successful: Found ${orderCount} orders`);
      
      return {
        success: true,
        orderCount,
        message: `Successfully connected to Shopify Orders API. Found ${orderCount} orders.`
      };
    } catch (error) {
      const errorMessage = `Error testing order API connectivity: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage);
      return { success: false, orderCount: 0, message: errorMessage };
    }
  }

  /**
   * Fetch historical orders with pagination support
   */
  async fetchHistoricalOrders(
    storeId: string, 
    options: {
      limit?: number;
      sinceDate?: Date;
      untilDate?: Date;
      status?: string;
      financialStatus?: string;
      fulfillmentStatus?: string;
    } = {}
  ): Promise<{ orders: any[], totalCount: number, hasMore: boolean }> {
    try {
      const credentials = await this.credentialService.getStoreCredentials(storeId, 'access_token');
      if (credentials.length === 0) {
        throw new Error('No access token found for store');
      }

      const accessToken = await this.credentialService.getCredential(credentials[0].id);
      if (!accessToken) {
        throw new Error('Could not retrieve access token');
      }

      const store = await this.getStoreById(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      const {
        limit = 250,
        sinceDate,
        untilDate,
        status = 'any',
        financialStatus,
        fulfillmentStatus
      } = options;

      console.log(`Fetching historical orders from store ${storeId} with options:`, {
        limit,
        sinceDate: sinceDate?.toISOString(),
        untilDate: untilDate?.toISOString(),
        status,
        financialStatus,
        fulfillmentStatus
      });

      // Build query parameters
      const params = new URLSearchParams({
        limit: Math.min(limit, 250).toString(),
        status
      });

      if (sinceDate) {
        params.append('created_at_min', sinceDate.toISOString());
      }

      if (untilDate) {
        params.append('created_at_max', untilDate.toISOString());
      }

      if (financialStatus) {
        params.append('financial_status', financialStatus);
      }

      if (fulfillmentStatus) {
        params.append('fulfillment_status', fulfillmentStatus);
      }

      const response = await fetch(`https://${store.domain}/admin/api/2023-10/orders.json?${params.toString()}`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const orders = data.orders || [];

      // Check for pagination using Link header
      const linkHeader = response.headers.get('Link');
      const hasMore = linkHeader ? linkHeader.includes('rel="next"') : false;

      console.log(`Fetched ${orders.length} historical orders from store ${storeId}, hasMore: ${hasMore}`);

      return {
        orders,
        totalCount: orders.length,
        hasMore
      };

    } catch (error) {
      console.error('Error fetching historical orders:', error);
      throw error;
    }
  }

  /**
   * Fetch all historical orders with automatic pagination
   */
  async fetchAllHistoricalOrders(
    storeId: string,
    options: {
      sinceDate?: Date;
      untilDate?: Date;
      status?: string;
      financialStatus?: string;
      fulfillmentStatus?: string;
      maxPages?: number;
    } = {}
  ): Promise<{ orders: any[], totalCount: number, pagesProcessed: number }> {
    try {
      const credentials = await this.credentialService.getStoreCredentials(storeId, 'access_token');
      if (credentials.length === 0) {
        throw new Error('No access token found for store');
      }

      const accessToken = await this.credentialService.getCredential(credentials[0].id);
      if (!accessToken) {
        throw new Error('Could not retrieve access token');
      }

      const store = await this.getStoreById(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      const {
        sinceDate,
        untilDate,
        status = 'any',
        financialStatus,
        fulfillmentStatus,
        maxPages = 10 // Safety limit to prevent infinite loops
      } = options;

      console.log(`Fetching ALL historical orders from store ${storeId} with pagination`);

      let allOrders: any[] = [];
      let pageInfo: string | null = null;
      let pagesProcessed = 0;

      do {
        const pageResult = await this.fetchOrdersPage(storeId, {
          limit: 250,
          sinceDate,
          untilDate,
          status,
          financialStatus,
          fulfillmentStatus,
          pageInfo
        });

        allOrders.push(...pageResult.orders);
        pageInfo = pageResult.nextPageInfo;
        pagesProcessed++;

        console.log(`Processed page ${pagesProcessed}, got ${pageResult.orders.length} orders, next page info: ${pageInfo ? 'exists' : 'null'}`);

        // Safety check to prevent infinite loops
        if (pagesProcessed >= maxPages) {
          console.warn(`Reached maximum pages limit (${maxPages}), stopping pagination`);
          break;
        }

      } while (pageInfo);

      console.log(`Completed fetching all historical orders: ${allOrders.length} total orders from ${pagesProcessed} pages`);

      return {
        orders: allOrders,
        totalCount: allOrders.length,
        pagesProcessed
      };

    } catch (error) {
      console.error('Error fetching all historical orders:', error);
      throw error;
    }
  }

  /**
   * Fetch a single page of orders with pagination support
   */
  private async fetchOrdersPage(
    storeId: string,
    options: {
      limit?: number;
      sinceDate?: Date;
      untilDate?: Date;
      status?: string;
      financialStatus?: string;
      fulfillmentStatus?: string;
      pageInfo?: string | null;
    }
  ): Promise<{ orders: any[], nextPageInfo: string | null }> {
    try {
      const credentials = await this.credentialService.getStoreCredentials(storeId, 'access_token');
      if (credentials.length === 0) {
        throw new Error('No access token found for store');
      }

      const accessToken = await this.credentialService.getCredential(credentials[0].id);
      if (!accessToken) {
        throw new Error('Could not retrieve access token');
      }

      const store = await this.getStoreById(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      const {
        limit = 250,
        sinceDate,
        untilDate,
        status = 'any',
        financialStatus,
        fulfillmentStatus,
        pageInfo
      } = options;

      // Build query parameters
      const params = new URLSearchParams({
        limit: Math.min(limit, 250).toString(),
        status
      });

      if (sinceDate) {
        params.append('created_at_min', sinceDate.toISOString());
      }

      if (untilDate) {
        params.append('created_at_max', untilDate.toISOString());
      }

      if (financialStatus) {
        params.append('financial_status', financialStatus);
      }

      if (fulfillmentStatus) {
        params.append('fulfillment_status', fulfillmentStatus);
      }

      // Add page_info for pagination if provided
      if (pageInfo) {
        params.append('page_info', pageInfo);
      }

      const response = await fetch(`https://${store.domain}/admin/api/2023-10/orders.json?${params.toString()}`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const orders = data.orders || [];

      // Extract next page info from Link header
      let nextPageInfo: string | null = null;
      const linkHeader = response.headers.get('Link');
      
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
        if (nextMatch) {
          nextPageInfo = nextMatch[1];
        }
      }

      return {
        orders,
        nextPageInfo
      };

    } catch (error) {
      console.error('Error fetching orders page:', error);
      throw error;
    }
  }

  /**
   * Fetch orders created or modified since a specific date
   */
  async fetchOrdersSince(
    storeId: string,
    sinceDate: Date,
    options: {
      useUpdatedAt?: boolean;
      limit?: number;
      status?: string;
    } = {}
  ): Promise<{ orders: any[], totalCount: number }> {
    try {
      const { useUpdatedAt = false, limit = 250, status = 'any' } = options;

      const dateField = useUpdatedAt ? 'updated_at_min' : 'created_at_min';
      
      console.log(`Fetching orders since ${sinceDate.toISOString()} using ${dateField}`);

      const result = await this.fetchAllHistoricalOrders(storeId, {
        sinceDate,
        status,
        maxPages: 20 // Allow more pages for historical sync
      });

      // If using updated_at, we need to filter the results since Shopify API 
      // doesn't have updated_at_min parameter in older API versions
      if (useUpdatedAt) {
        const filteredOrders = result.orders.filter(order => {
          const updatedAt = new Date(order.updated_at);
          return updatedAt >= sinceDate;
        });

        return {
          orders: filteredOrders,
          totalCount: filteredOrders.length
        };
      }

      return {
        orders: result.orders,
        totalCount: result.totalCount
      };

    } catch (error) {
      console.error('Error fetching orders since date:', error);
      throw error;
    }
  }

  /**
   * Map Shopify order data to internal order format
   */
  mapShopifyOrderToInternal(storeId: string, orderData: any) {
    return {
      store_id: storeId,
      external_id: orderData.id.toString(),
      order_number: orderData.order_number,
      email: orderData.email,
      phone: orderData.phone,
      customer_id: orderData.customer?.id?.toString() || null,
      customer_first_name: orderData.customer?.first_name || null,
      customer_last_name: orderData.customer?.last_name || null,
      financial_status: orderData.financial_status,
      fulfillment_status: orderData.fulfillment_status,
      order_status_url: orderData.order_status_url,
      total_price: parseFloat(orderData.total_price || '0'),
      subtotal_price: parseFloat(orderData.subtotal_price || '0'),
      total_tax: parseFloat(orderData.total_tax || '0'),
      total_discounts: parseFloat(orderData.total_discounts || '0'),
      currency: orderData.currency,
      order_date: orderData.created_at,
      updated_at: orderData.updated_at,
      cancelled_at: orderData.cancelled_at,
      closed_at: orderData.closed_at,
      processed_at: orderData.processed_at,
      tags: orderData.tags,
      note: orderData.note,
      note_attributes: orderData.note_attributes || null,
      shipping_address: orderData.shipping_address || null,
      billing_address: orderData.billing_address || null,
      shipping_lines: orderData.shipping_lines || null,
      tax_lines: orderData.tax_lines || null,
      discount_codes: orderData.discount_codes || null,
      payment_gateway_names: orderData.payment_gateway_names || null,
      processing_method: orderData.processing_method,
      checkout_token: orderData.checkout_token,
      reference: orderData.reference,
      source_identifier: orderData.source_identifier,
      source_name: orderData.source_name,
      platform_data: orderData,
      status: orderData.financial_status === 'paid' && orderData.fulfillment_status === 'fulfilled' 
        ? 'completed' 
        : orderData.cancelled_at 
          ? 'cancelled' 
          : 'active'
    };
  }

  /**
   * Store a single order in the database
   */
  async storeOrder(storeId: string, orderData: any): Promise<{ success: boolean, data?: any, error?: string, created?: boolean, skipped?: boolean }> {
    try {
      const mappedOrder = this.mapShopifyOrderToInternal(storeId, orderData);
      const result = await this.dbService.upsertOrder(mappedOrder);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      console.log(`Order ${orderData.id} ${result.created ? 'created' : result.skipped ? 'skipped (not newer)' : 'updated'}`);
      return result;
    } catch (error) {
      console.error(`Error storing order ${orderData.id}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Store multiple orders in the database
   */
  async storeOrders(storeId: string, orders: any[]): Promise<{ success: boolean, stored: number, errors: string[] }> {
    const errors: string[] = [];
    let storedCount = 0;

    for (const order of orders) {
      try {
        const result = await this.storeOrder(storeId, order);
        if (result.success && !result.skipped) {
          storedCount++;
        }
      } catch (error) {
        const errorMessage = `Failed to store order ${order.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    return {
      success: true,
      stored: storedCount,
      errors
    };
  }

  /**
   * Sync orders from Shopify to database
   */
  async syncOrdersToDatabase(storeId: string, orders: any[]): Promise<{ synced: number, errors: string[] }> {
    const errors: string[] = [];
    let syncedCount = 0;

    try {
      console.log(`Starting order sync for ${orders.length} orders to database`);

      for (const order of orders) {
        try {
          // Store the order
          const orderResult = await this.storeOrder(storeId, order);
          
          if (!orderResult.success) {
            throw new Error(`Failed to store order: ${orderResult.error}`);
          }

          if (!orderResult.skipped) {
            syncedCount++;

            // Process line items if the order was stored/updated
            if (order.line_items && order.line_items.length > 0 && orderResult.data) {
              const mappedLineItems = order.line_items.map((item: any) => ({
                order_id: orderResult.data.id,
                external_id: item.id.toString(),
                title: item.title,
                sku: item.sku,
                variant_id: item.variant_id?.toString(),
                product_id: item.product_id?.toString(),
                quantity: parseInt(item.quantity) || 0,
                price: parseFloat(item.price || '0'),
                total_price: parseFloat(item.price || '0') * parseInt(item.quantity || '0'),
                vendor: item.vendor,
                requires_shipping: item.requires_shipping,
                taxable: item.taxable,
                gift_card: item.gift_card,
                fulfillment_service: item.fulfillment_service,
                grams: item.grams,
                properties: item.properties || null,
                variant_title: item.variant_title,
                fulfillment_status: item.fulfillment_status,
                platform_data: item
              }));

              const lineItemsResult = await this.dbService.upsertOrderLineItems(orderResult.data.id, mappedLineItems);
              
              if (!lineItemsResult.success) {
                console.error(`Failed to save line items for order ${order.id}:`, lineItemsResult.error);
                errors.push(`Failed to save line items for order ${order.id}: ${lineItemsResult.error}`);
              }
            }
          }
        } catch (error) {
          const errorMessage = `Failed to sync order ${order.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          errors.push(errorMessage);
        }
      }

      console.log(`Order sync completed: ${syncedCount} synced, ${errors.length} errors`);
      return { synced: syncedCount, errors };

    } catch (error) {
      const errorMessage = `Order sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage);
      errors.push(errorMessage);
      return { synced: syncedCount, errors };
    }
  }
} 