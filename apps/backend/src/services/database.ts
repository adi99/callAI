import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Helper function to extract error message safely
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error occurred';
};

export class DatabaseService {
  private supabase: SupabaseClient;
  private static instance: DatabaseService;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    try {
      const { data, error } = await this.supabase.rpc('execute_sql', { 
        sql_query: sql, 
        parameters: params 
      });
      
      if (error) throw error;
      return { rows: data || [] };
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('stores')
        .select('id')
        .limit(1);
      
      return !error;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  async getStores() {
    try {
      const { data, error } = await this.supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching stores:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async getStoreById(id: string) {
    try {
      const { data, error } = await this.supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching store:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async createStore(storeData: any) {
    try {
      const { data, error } = await this.supabase
        .from('stores')
        .insert([storeData])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error creating store:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async updateStore(id: string, updates: any) {
    try {
      const { data, error } = await this.supabase
        .from('stores')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating store:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async getProducts(storeId: string) {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching products:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async getOrders(storeId: string) {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select(`
          *,
          order_line_items (
            id,
            title,
            sku,
            price,
            quantity,
            total_price
          )
        `)
        .eq('store_id', storeId)
        .order('order_date', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching orders:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async getSettings(storeId: string, category?: string) {
    try {
      let query = this.supabase
        .from('settings')
        .select('*')
        .eq('store_id', storeId);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query.order('category');

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching settings:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async updateSetting(storeId: string, category: string, key: string, value: any) {
    try {
      const { data, error } = await this.supabase
        .from('settings')
        .upsert({
          store_id: storeId,
          category,
          key,
          value: typeof value === 'object' ? value : JSON.stringify(value)
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating setting:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async searchProducts(storeId: string, searchTerm: string) {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
        .order('title');

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error searching products:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async getOrderById(storeId: string, orderId: string) {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select(`
          *,
          order_line_items (
            id,
            title,
            sku,
            price,
            quantity,
            total_price
          )
        `)
        .eq('store_id', storeId)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching order:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async updateOrderStatus(storeId: string, orderId: string, status: string) {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .update({ fulfillment_status: status })
        .eq('store_id', storeId)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating order status:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Upsert order with idempotency check
   * Returns { success: boolean, data: order, created: boolean, skipped: boolean }
   */
  async upsertOrder(orderData: any) {
    try {
      const { store_id, external_id, updated_at } = orderData;
      
      // First, check if order already exists
      const { data: existingOrder, error: selectError } = await this.supabase
        .from('orders')
        .select('id, updated_at')
        .eq('store_id', store_id)
        .eq('external_id', external_id)
        .single();

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 is "not found"
        throw selectError;
      }

      // If order exists, check if the incoming data is newer
      if (existingOrder) {
        const existingUpdatedAt = new Date(existingOrder.updated_at);
        const incomingUpdatedAt = new Date(updated_at);
        
        // Skip if incoming data is not newer
        if (incomingUpdatedAt <= existingUpdatedAt) {
          console.log(`Order ${external_id} skipped - incoming data is not newer`);
          return { 
            success: true, 
            data: existingOrder, 
            created: false, 
            skipped: true 
          };
        }

        // Update existing order
        const { data, error } = await this.supabase
          .from('orders')
          .update(orderData)
          .eq('store_id', store_id)
          .eq('external_id', external_id)
          .select()
          .single();

        if (error) throw error;
        return { 
          success: true, 
          data, 
          created: false, 
          skipped: false 
        };
      } else {
        // Insert new order
        const { data, error } = await this.supabase
          .from('orders')
          .insert([orderData])
          .select()
          .single();

        if (error) throw error;
        return { 
          success: true, 
          data, 
          created: true, 
          skipped: false 
        };
      }
    } catch (error) {
      console.error('Error upserting order:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Upsert order line items with complete replacement
   */
  async upsertOrderLineItems(orderId: string, lineItems: any[]) {
    try {
      // First, delete existing line items for this order
      const { error: deleteError } = await this.supabase
        .from('order_line_items')
        .delete()
        .eq('order_id', orderId);

      if (deleteError) throw deleteError;

      // Insert new line items
      if (lineItems.length > 0) {
        const { data, error } = await this.supabase
          .from('order_line_items')
          .insert(lineItems)
          .select();

        if (error) throw error;
        return { success: true, data };
      }

      return { success: true, data: [] };
    } catch (error) {
      console.error('Error upserting order line items:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Soft delete order by marking it as deleted
   */
  async softDeleteOrder(storeId: string, externalId: string) {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('store_id', storeId)
        .eq('external_id', externalId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error soft deleting order:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Hard delete order (for order/delete webhooks)
   */
  async hardDeleteOrder(storeId: string, externalId: string) {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .delete()
        .eq('store_id', storeId)
        .eq('external_id', externalId)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error hard deleting order:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Mark order as deleted (for order/delete webhooks)
   * Returns { success: boolean, data: order, notFound: boolean }
   */
  async markOrderDeleted(storeId: string, externalId: string) {
    try {
      // First check if order exists
      const { data: existingOrder, error: selectError } = await this.supabase
        .from('orders')
        .select('id, status')
        .eq('store_id', storeId)
        .eq('external_id', externalId)
        .single();

      if (selectError && selectError.code === 'PGRST116') { // Order not found
        return { 
          success: true, 
          data: null, 
          notFound: true 
        };
      }

      if (selectError) throw selectError;

      // Mark order as deleted
      const { data, error } = await this.supabase
        .from('orders')
        .update({ 
          status: 'deleted',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('store_id', storeId)
        .eq('external_id', externalId)
        .select()
        .single();

      if (error) throw error;
      return { 
        success: true, 
        data, 
        notFound: false 
      };
    } catch (error) {
      console.error('Error marking order as deleted:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }
} 