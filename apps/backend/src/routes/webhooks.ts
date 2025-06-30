import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ShopifyService } from '../services/shopifyService';
import { DatabaseService } from '../services/database';
import { CredentialService } from '../services/credentialService';
import { ApiResponse } from '../types';

const router = Router();
const shopifyService = ShopifyService.getInstance();
const dbService = DatabaseService.getInstance();
const credentialService = CredentialService.getInstance();

// Middleware to verify Shopify webhook signature
const verifyShopifyWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const signature = req.get('X-Shopify-Hmac-Sha256');
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    
    if (!signature || !shopDomain) {
      res.status(401).json({
        success: false,
        error: 'Missing required headers',
        message: 'Invalid webhook request'
      });
      return;
    }

    // Find the store by domain
    const storesResult = await dbService.getStores();
    if (!storesResult.success) {
      res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Could not verify webhook'
      });
      return;
    }

    const store = storesResult.data?.find(s => s.domain === shopDomain);
    if (!store) {
      res.status(404).json({
        success: false,
        error: 'Store not found',
        message: 'Webhook from unknown store'
      });
      return;
    }

    // Get webhook secret for this store
    const credentials = await credentialService.getStoreCredentials(store.id, 'webhook_secret');
    if (credentials.length === 0) {
      res.status(401).json({
        success: false,
        error: 'No webhook secret found',
        message: 'Cannot verify webhook signature'
      });
      return;
    }

    const webhookSecret = await credentialService.getCredential(credentials[0].id);
    if (!webhookSecret) {
      res.status(401).json({
        success: false,
        error: 'Could not retrieve webhook secret',
        message: 'Cannot verify webhook signature'
      });
      return;
    }

    // Verify signature
    const body = req.body;
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyString, 'utf8')
      .digest('base64');

    if (signature !== expectedSignature) {
      res.status(401).json({
        success: false,
        error: 'Invalid signature',
        message: 'Webhook signature verification failed'
      });
      return;
    }

    // Add store info to request for handlers to use
    req.store = store;
    next();
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
      message: 'Could not verify webhook'
    });
  }
};

// Map Shopify order data to internal order format
function mapShopifyOrderToInternal(storeId: string, orderData: any) {
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

// Helper function to process line items for an order
async function processOrderLineItems(orderId: string, lineItems: any[]): Promise<void> {
  if (!lineItems || lineItems.length === 0) {
    return;
  }

  const mappedLineItems = lineItems.map((item: any) => ({
    order_id: orderId,
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

  const lineItemsResult = await dbService.upsertOrderLineItems(orderId, mappedLineItems);
  
  if (!lineItemsResult.success) {
    console.error(`Failed to save line items for order:`, lineItemsResult.error);
    throw new Error(`Failed to save line items: ${lineItemsResult.error}`);
  }

  console.log(`Saved ${mappedLineItems.length} line items for order`);
}

// POST /api/webhooks/shopify - Main Shopify webhook endpoint
router.post('/shopify', verifyShopifyWebhook, async (req: Request, res: Response): Promise<void> => {
  try {
    const topic = req.get('X-Shopify-Topic');
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    const webhookId = req.get('X-Shopify-Webhook-Id');
    const webhookData = req.body;
    const store = req.store;

    if (!store) {
      res.status(400).json({
        success: false,
        error: 'Store not found',
        message: 'Invalid store context'
      } as ApiResponse);
      return;
    }

    console.log(`Received webhook: ${topic} from ${shopDomain} (ID: ${webhookId})`);

    // Implement webhook deduplication using webhook ID
    if (webhookId) {
      const isDuplicate = await checkWebhookDuplicate(store.id, webhookId, topic || '');
      if (isDuplicate) {
        console.log(`Duplicate webhook detected: ${webhookId} for topic ${topic}`);
        res.status(200).json({
          success: true,
          message: 'Webhook already processed'
        } as ApiResponse);
        return;
      }
    }

    // Process webhook based on topic
    let processed = false;
    try {
    switch (topic) {
        // Product webhooks
      case 'products/create':
        await handleProductCreate(store, webhookData);
          processed = true;
        break;
      case 'products/update':
        await handleProductUpdate(store, webhookData);
          processed = true;
        break;
      case 'products/delete':
        await handleProductDelete(store, webhookData);
          processed = true;
        break;

        // Order webhooks
      case 'orders/create':
        await handleOrderCreate(store, webhookData);
          processed = true;
        break;
      case 'orders/updated':
        await handleOrderUpdate(store, webhookData);
          processed = true;
        break;
      case 'orders/paid':
        await handleOrderPaid(store, webhookData);
          processed = true;
        break;
      case 'orders/cancelled':
        await handleOrderCancelled(store, webhookData);
          processed = true;
        break;
      case 'orders/fulfilled':
        await handleOrderFulfilled(store, webhookData);
          processed = true;
        break;
      case 'orders/delete':
        await handleOrderDelete(store, webhookData);
          processed = true;
        break;

        // Customer webhooks
      case 'customers/create':
        await handleCustomerCreate(store, webhookData);
          processed = true;
        break;
      case 'customers/update':
        await handleCustomerUpdate(store, webhookData);
          processed = true;
        break;

      default:
        console.log(`Unhandled webhook topic: ${topic}`);
          res.status(200).json({
            success: true,
            message: `Webhook topic ${topic} acknowledged but not processed`
          } as ApiResponse);
          return;
    }

      // Record successful webhook processing
      if (webhookId && processed) {
        await recordWebhookProcessed(store.id, webhookId, topic);
      }

    res.status(200).json({
      success: true,
        message: `Webhook ${topic} processed successfully`
    } as ApiResponse);

    } catch (processingError) {
      console.error(`Error processing webhook ${topic}:`, processingError);
      
      // Return 200 to prevent Shopify from retrying, but log the error
      res.status(200).json({
        success: false,
        error: 'Processing failed',
        message: `Failed to process ${topic} webhook`
      } as ApiResponse);
    }

  } catch (error) {
    console.error('Webhook endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Webhook processing failed'
    } as ApiResponse);
  }
});

/**
 * Check if a webhook has already been processed (deduplication)
 */
async function checkWebhookDuplicate(storeId: string, webhookId: string, topic: string): Promise<boolean> {
  try {
    const { data, error } = await dbService.getClient()
      .from('webhook_logs')
      .select('id')
      .eq('store_id', storeId)
      .eq('webhook_id', webhookId)
      .eq('topic', topic)
      .eq('status', 'processed')
      .single();

    return !!data && !error;
  } catch (error) {
    // If table doesn't exist or other error, assume not duplicate
    console.warn('Error checking webhook duplicate:', error);
    return false;
  }
}

/**
 * Record that a webhook has been successfully processed
 */
async function recordWebhookProcessed(storeId: string, webhookId: string, topic: string): Promise<void> {
  try {
    await dbService.getClient()
      .from('webhook_logs')
      .upsert({
        store_id: storeId,
        webhook_id: webhookId,
        topic: topic,
        status: 'processed',
        processed_at: new Date().toISOString()
      });
  } catch (error) {
    // Non-critical error - webhook was processed successfully
    console.warn('Error recording webhook processed:', error);
  }
}

// Product webhook handlers
async function handleProductCreate(store: any, productData: any): Promise<void> {
  try {
    const productRecord = {
      store_id: store.id,
      external_id: productData.id.toString(),
      title: productData.title,
      description: productData.body_html,
      vendor: productData.vendor,
      product_type: productData.product_type,
      handle: productData.handle,
      status: productData.status,
      published_at: productData.published_at,
      tags: productData.tags,
      price: productData.variants?.[0]?.price || null,
      compare_at_price: productData.variants?.[0]?.compare_at_price || null,
      sku: productData.variants?.[0]?.sku || null,
      inventory_quantity: productData.variants?.[0]?.inventory_quantity || 0,
      weight: productData.variants?.[0]?.weight || null,
      weight_unit: productData.variants?.[0]?.weight_unit || 'grams',
      requires_shipping: productData.variants?.[0]?.requires_shipping || false,
      taxable: productData.variants?.[0]?.taxable || false,
      images: productData.images || [],
      options: productData.options || [],
      variants: productData.variants || [],
      platform_data: productData
    };

    await dbService.getClient()
      .from('products')
      .insert(productRecord);

    console.log(`Created product: ${productData.title} (ID: ${productData.id})`);
  } catch (error) {
    console.error('Error creating product:', error);
  }
}

async function handleProductUpdate(store: any, productData: any): Promise<void> {
  try {
    const updateData = {
      title: productData.title,
      description: productData.body_html,
      vendor: productData.vendor,
      product_type: productData.product_type,
      handle: productData.handle,
      status: productData.status,
      published_at: productData.published_at,
      tags: productData.tags,
      price: productData.variants?.[0]?.price || null,
      compare_at_price: productData.variants?.[0]?.compare_at_price || null,
      sku: productData.variants?.[0]?.sku || null,
      inventory_quantity: productData.variants?.[0]?.inventory_quantity || 0,
      weight: productData.variants?.[0]?.weight || null,
      weight_unit: productData.variants?.[0]?.weight_unit || 'grams',
      requires_shipping: productData.variants?.[0]?.requires_shipping || false,
      taxable: productData.variants?.[0]?.taxable || false,
      images: productData.images || [],
      options: productData.options || [],
      variants: productData.variants || [],
      platform_data: productData,
      updated_at: new Date().toISOString()
    };

    await dbService.getClient()
      .from('products')
      .update(updateData)
      .eq('store_id', store.id)
      .eq('external_id', productData.id.toString());

    console.log(`Updated product: ${productData.title} (ID: ${productData.id})`);
  } catch (error) {
    console.error('Error updating product:', error);
  }
}

async function handleProductDelete(store: any, productData: any): Promise<void> {
  try {
    await dbService.getClient()
      .from('products')
      .delete()
      .eq('store_id', store.id)
      .eq('external_id', productData.id.toString());

    console.log(`Deleted product: ID ${productData.id}`);
  } catch (error) {
    console.error('Error deleting product:', error);
  }
}

// Order webhook handlers
async function handleOrderCreate(store: any, orderData: any): Promise<void> {
  try {
    console.log(`Processing order create webhook: ${orderData.id} for store ${store.domain}`);
    
    // Use ShopifyService for consistent processing
    const orderResult = await shopifyService.storeOrder(store.id, orderData);
    
    if (!orderResult.success) {
      throw new Error(`Failed to create/update order: ${orderResult.error}`);
    }

    if (orderResult.skipped) {
      console.log(`Order ${orderData.id} creation skipped - already processed with newer data`);
      return;
    }

    const savedOrder = orderResult.data;
    console.log(`Order ${orderData.id} ${orderResult.created ? 'created' : 'updated'} successfully`);

    // Process line items if they exist
    if (orderData.line_items && orderData.line_items.length > 0 && savedOrder) {
      const mappedLineItems = orderData.line_items.map((item: any) => ({
        order_id: savedOrder.id,
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

      const lineItemsResult = await dbService.upsertOrderLineItems(savedOrder.id, mappedLineItems);
      
      if (!lineItemsResult.success) {
        console.error(`Failed to save line items for order ${orderData.id}:`, lineItemsResult.error);
        throw new Error(`Failed to save line items: ${lineItemsResult.error}`);
      }

      console.log(`Saved ${mappedLineItems.length} line items for order ${orderData.id}`);
    }

  } catch (error) {
    console.error('Error handling order create webhook:', error);
    throw error;
  }
}

async function handleOrderUpdate(store: any, orderData: any): Promise<void> {
  try {
    console.log(`Processing order update webhook: ${orderData.id} for store ${store.domain}`);
    
    // Use ShopifyService for consistent processing
    const orderResult = await shopifyService.storeOrder(store.id, orderData);
    
    if (!orderResult.success) {
      throw new Error(`Failed to update order: ${orderResult.error}`);
    }

    if (orderResult.skipped) {
      console.log(`Order ${orderData.id} update skipped - not newer than existing data`);
      return;
    }

    const savedOrder = orderResult.data;
    console.log(`Order ${orderData.id} updated successfully`);

    // Process line items (they might have changed)
    if (orderData.line_items && orderData.line_items.length > 0 && savedOrder) {
      const mappedLineItems = orderData.line_items.map((item: any) => ({
        order_id: savedOrder.id,
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

      const lineItemsResult = await dbService.upsertOrderLineItems(savedOrder.id, mappedLineItems);
      
      if (!lineItemsResult.success) {
        console.error(`Failed to save line items for order ${orderData.id}:`, lineItemsResult.error);
        throw new Error(`Failed to save line items: ${lineItemsResult.error}`);
      }

      console.log(`Saved ${mappedLineItems.length} line items for order ${orderData.id}`);
    }

  } catch (error) {
    console.error('Error handling order update webhook:', error);
    throw error;
  }
}

async function handleOrderPaid(store: any, orderData: any): Promise<void> {
  // Delegate to handleOrderUpdate since paid status is part of order data
  console.log(`Processing order paid webhook: ${orderData.id} for store ${store.domain}`);
  await handleOrderUpdate(store, orderData);
}

async function handleOrderCancelled(store: any, orderData: any): Promise<void> {
  // Delegate to handleOrderUpdate since cancelled status is part of order data
  console.log(`Processing order cancelled webhook: ${orderData.id} for store ${store.domain}`);
  await handleOrderUpdate(store, orderData);
}

async function handleOrderFulfilled(store: any, orderData: any): Promise<void> {
  // Delegate to handleOrderUpdate since fulfillment status is part of order data
  console.log(`Processing order fulfilled webhook: ${orderData.id} for store ${store.domain}`);
  await handleOrderUpdate(store, orderData);
}

// Handle order deletion webhook
async function handleOrderDelete(store: any, orderData: any): Promise<void> {
  try {
    console.log(`Processing order delete webhook: ${orderData.id} for store ${store.domain}`);
    
    // Mark order as deleted (soft delete)
    const deleteResult = await dbService.markOrderDeleted(store.id, orderData.id.toString());
    
    if (!deleteResult.success) {
      throw new Error(`Failed to delete order: ${deleteResult.error}`);
    }

    if (deleteResult.notFound) {
      console.log(`Order ${orderData.id} not found for deletion - may have already been deleted`);
      return;
    }

    console.log(`Order ${orderData.id} marked as deleted successfully`);

  } catch (error) {
    console.error('Error handling order delete webhook:', error);
    throw error;
  }
}

// Customer webhook handlers
async function handleCustomerCreate(store: any, customerData: any): Promise<void> {
  try {
    const customerRecord = {
      store_id: store.id,
      external_id: customerData.id.toString(),
      email: customerData.email,
      first_name: customerData.first_name,
      last_name: customerData.last_name,
      phone: customerData.phone,
      accepts_marketing: customerData.accepts_marketing,
      accepts_marketing_updated_at: customerData.accepts_marketing_updated_at,
      marketing_opt_in_level: customerData.marketing_opt_in_level,
      tax_exempt: customerData.tax_exempt,
      verified_email: customerData.verified_email,
      state: customerData.state,
      note: customerData.note,
      tags: customerData.tags,
      currency: customerData.currency,
      created_at: customerData.created_at,
      updated_at: customerData.updated_at,
      addresses: customerData.addresses || [],
      default_address: customerData.default_address,
      orders_count: customerData.orders_count || 0,
      total_spent: parseFloat(customerData.total_spent || '0'),
      last_order_id: customerData.last_order_id?.toString(),
      last_order_name: customerData.last_order_name,
      platform_data: customerData
    };

    await dbService.getClient()
      .from('customers')
      .insert(customerRecord);

    console.log(`Created customer: ${customerData.email} (ID: ${customerData.id})`);
  } catch (error) {
    console.error('Error creating customer:', error);
  }
}

async function handleCustomerUpdate(store: any, customerData: any): Promise<void> {
  try {
    const updateData = {
      email: customerData.email,
      first_name: customerData.first_name,
      last_name: customerData.last_name,
      phone: customerData.phone,
      accepts_marketing: customerData.accepts_marketing,
      accepts_marketing_updated_at: customerData.accepts_marketing_updated_at,
      marketing_opt_in_level: customerData.marketing_opt_in_level,
      tax_exempt: customerData.tax_exempt,
      verified_email: customerData.verified_email,
      state: customerData.state,
      note: customerData.note,
      tags: customerData.tags,
      currency: customerData.currency,
      updated_at: customerData.updated_at,
      addresses: customerData.addresses || [],
      default_address: customerData.default_address,
      orders_count: customerData.orders_count || 0,
      total_spent: parseFloat(customerData.total_spent || '0'),
      last_order_id: customerData.last_order_id?.toString(),
      last_order_name: customerData.last_order_name,
      platform_data: customerData
    };

    await dbService.getClient()
      .from('customers')
      .update(updateData)
      .eq('store_id', store.id)
      .eq('external_id', customerData.id.toString());

    console.log(`Updated customer: ${customerData.email} (ID: ${customerData.id})`);
  } catch (error) {
    console.error('Error updating customer:', error);
  }
}

// GET /api/webhooks/shopify/test - Test endpoint for debugging
router.get('/shopify/test', async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Shopify webhook endpoint is ready',
    timestamp: new Date().toISOString()
  } as ApiResponse);
});

export default router; 