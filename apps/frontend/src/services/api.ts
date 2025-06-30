const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface Store {
  id: string;
  name: string;
  domain: string;
  platform: 'shopify' | 'woocommerce' | 'magento' | 'bigcommerce' | 'custom';
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  owner_email?: string;
  created_at: string;
  updated_at: string;
  access_token?: string;
  platform_store_id?: string;
}

interface Call {
  id: string;
  store_id: string;
  twilio_call_sid: string;
  caller_phone: string;
  direction: 'inbound' | 'outbound';
  status: 'queued' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer';
  start_time: string;
  end_time?: string;
  duration?: number;
  recording_url?: string;
  transcription?: string;
  ai_summary?: string;
  created_at: string;
}

interface Conversation {
  id: string;
  store_id: string;
  call_id?: string;
  channel: 'voice' | 'chat' | 'email' | 'sms' | 'whatsapp';
  status: 'active' | 'resolved' | 'escalated' | 'abandoned';
  customer_phone?: string;
  customer_email?: string;
  start_time: string;
  end_time?: string;
  ai_context?: any;
  tags?: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

interface UserSettings {
  twilioPhone: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  openaiApiKey: string;
  openaiModel: string;
  geminiApiKey: string;
  geminiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
}

interface ElevenLabsVoice {
  id: string;
  name: string;
}

interface Product {
  id: string;
  store_id: string;
  title: string;
  description?: string;
  price: number;
  sku?: string;
  inventory_quantity: number;
  status: 'active' | 'draft' | 'archived' | 'discontinued';
  created_at: string;
}

interface Order {
  id: string;
  store_id: string;
  order_number: string;
  customer_email?: string;
  customer_phone?: string;
  total_price: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  order_date: string;
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const config: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      };

      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Health check
  async checkHealth(): Promise<ApiResponse> {
    return this.request('/health');
  }

  // Test connection to backend
  async testBackendConnection(): Promise<boolean> {
    try {
      const response = await this.checkHealth();
      return response.success === true;
    } catch (error) {
      console.error('Backend connection test failed:', error);
      return false;
    }
  }

  // Store management
  async getStores(): Promise<ApiResponse<Store[]>> {
    return this.request<Store[]>('/stores');
  }

  async getStore(id: string): Promise<ApiResponse<Store>> {
    return this.request<Store>(`/stores/${id}`);
  }

  async createStore(storeData: Partial<Store>): Promise<ApiResponse<Store>> {
    return this.request<Store>('/stores', {
      method: 'POST',
      body: JSON.stringify(storeData),
    });
  }

  async updateStore(id: string, updates: Partial<Store>): Promise<ApiResponse<Store>> {
    return this.request<Store>(`/stores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Products
  async getProducts(storeId: string): Promise<ApiResponse<Product[]>> {
    return this.request<Product[]>(`/stores/${storeId}/products`);
  }

  // Orders
  async getOrders(storeId: string): Promise<ApiResponse<Order[]>> {
    return this.request<Order[]>(`/stores/${storeId}/orders`);
  }

  // Settings
  async getSettings(storeId: string, category?: string): Promise<ApiResponse<any[]>> {
    const params = category ? `?category=${category}` : '';
    return this.request<any[]>(`/stores/${storeId}/settings${params}`);
  }

  // Connection test
  async testConnection(storeId: string): Promise<ApiResponse<{ connected: boolean }>> {
    return this.request<{ connected: boolean }>(`/stores/${storeId}/test-connection`, {
      method: 'POST',
    });
  }

  // Calls
  async getCalls(storeId?: string): Promise<ApiResponse<Call[]>> {
    const endpoint = storeId ? `/calls?store_id=${storeId}` : '/calls';
    return this.request<Call[]>(endpoint);
  }

  async getCall(callId: string): Promise<ApiResponse<Call>> {
    return this.request<Call>(`/calls/${callId}`);
  }

  async getCallHistory(limit = 50, offset = 0): Promise<ApiResponse<{
    calls: Call[];
    total: number;
    hasMore: boolean;
  }>> {
    return this.request(`/calls?limit=${limit}&offset=${offset}`);
  }

  // Conversations
  async getConversations(storeId?: string): Promise<ApiResponse<Conversation[]>> {
    const endpoint = storeId ? `/conversations?store_id=${storeId}` : '/conversations';
    return this.request<Conversation[]>(endpoint);
  }

  async getConversation(conversationId: string): Promise<ApiResponse<Conversation>> {
    return this.request<Conversation>(`/conversations/${conversationId}`);
  }

  // Dashboard Analytics
  async getDashboardStats(storeId?: string): Promise<ApiResponse<{
    totalStores: number;
    totalProducts: number;
    totalOrders: number;
    totalCalls: number;
    recentCalls: Call[];
    callsToday: number;
    resolvedCallsToday: number;
    avgCallDuration: number;
    satisfactionRate: number;
  }>> {
    const endpoint = storeId ? `/stores/${storeId}/dashboard-stats` : '/stores/dashboard-overview';
    return this.request(endpoint);
  }

  // Get comprehensive dashboard stats for a specific store
  async getStoreDashboardStats(storeId: string): Promise<ApiResponse<{
    store: {
      id: string;
      name: string;
      domain: string;
      platform: string;
      status: string;
      created_at: string;
      updated_at: string;
    };
    syncStatus: {
      lastSyncAt: string | null;
      isRecentSync: boolean;
      webhookHealthy: boolean;
      status: 'healthy' | 'warning';
    };
    counts: {
      products: number;
      orders: number;
      totalItems: number;
    };
    metadata: {
      connectionEstablished: string;
      dataFreshness: number | null;
    };
  }>> {
    return this.request(`/stores/${storeId}/dashboard-stats`);
  }

  // Get overview stats for all stores
  async getDashboardOverview(): Promise<ApiResponse<{
    totalStores: number;
    connectedStores: number;
    disconnectedStores: number;
    totalProducts: number;
    totalOrders: number;
    stores: Array<{
      id: string;
      name: string;
      domain: string;
      platform: string;
      status: string;
      lastSyncAt: string | null;
    }>;
  }>> {
    return this.request('/stores/dashboard-overview');
  }

  // Shopify OAuth Integration
  async initiateShopifyConnection(shopDomain: string): Promise<ApiResponse<{ authUrl: string }>> {
    return this.request<{ authUrl: string }>(`/auth/shopify/install?shop=${encodeURIComponent(shopDomain)}`);
  }

  async getShopifyConnectionStatus(storeId: string): Promise<ApiResponse<{ connected: boolean; store: Store }>> {
    return this.request<{ connected: boolean; store: Store }>(`/auth/shopify/status/${storeId}`);
  }

  async disconnectShopifyStore(storeId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(`/auth/shopify/disconnect/${storeId}`, {
      method: 'POST',
    });
  }

  // Product Sync
  async syncProducts(storeId: string): Promise<ApiResponse<{ syncedCount: number; message: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/shopify/sync-products/${storeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return await this.handleResponse(response);
    } catch (error) {
      return this.handleError('sync products', error);
    }
  }

  async getProductSyncStatus(storeId: string): Promise<ApiResponse<{
    storeId: string;
    storeName: string;
    storeDomain: string;
    lastSyncAt?: string;
    productCount: number;
    isConnected: boolean;
  }>> {
    return this.request(`/products/${storeId}/sync-status`);
  }

  async getProductStats(storeId: string): Promise<ApiResponse<{
    totalProducts: number;
    publishedProducts: number;
    draftProducts: number;
    topVendors: Array<{ vendor: string; count: number }>;
    recentProducts: Array<{ id: string; title: string; external_id: string; created_at: string }>;
  }>> {
    return this.request(`/products/${storeId}/stats`);
  }

  async completeShopifyCallback(shop: string, code: string, state: string): Promise<ApiResponse<{ store: Store; message: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/shopify/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shop, code, state }),
      });

      return await this.handleResponse(response);
    } catch (error) {
      return this.handleError('complete Shopify callback', error);
    }
  }

  // User Settings Management
  async getUserSettings(): Promise<ApiResponse<UserSettings>> {
    return this.request<UserSettings>('/settings', {
      headers: {
        'user-id': this.getUserId()
      }
    });
  }

  async saveUserSettings(settings: Partial<UserSettings>): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/settings', {
      method: 'POST',
      headers: {
        'user-id': this.getUserId()
      },
      body: JSON.stringify(settings),
    });
  }

  async testApiKey(provider: 'openai' | 'gemini' | 'elevenlabs' | 'anthropic', apiKey: string): Promise<ApiResponse<{ isValid: boolean; error?: string }>> {
    return this.request<{ isValid: boolean; error?: string }>('/settings/test-api-key', {
      method: 'POST',
      body: JSON.stringify({ provider, apiKey }),
    });
  }

  async getElevenLabsVoices(apiKey: string): Promise<ApiResponse<ElevenLabsVoice[]>> {
    return this.request<ElevenLabsVoice[]>('/settings/elevenlabs/voices', {
      method: 'POST',
      body: JSON.stringify({ apiKey })
    });
  }

  // List models for AI providers
  async listModels(provider: 'openai' | 'gemini' | 'anthropic', apiKey: string): Promise<ApiResponse<{ id: string; name: string }[]>> {
    return this.request<{ id: string; name: string }[]>('/settings/models', {
      method: 'POST',
      headers: { 'user-id': this.getUserId() },
      body: JSON.stringify({ provider, apiKey }),
    });
  }

  private getUserId(): string {
    // For now, use a session-based ID or default
    // In a real app, this would come from authentication
    return sessionStorage.getItem('userId') || 'default';
  }

  private async handleResponse(response: Response): Promise<ApiResponse> {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    return data;
  }

  private handleError(operation: string, error: any): ApiResponse {
    console.error(`Failed to ${operation}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export const apiService = new ApiService();
export type { Store, Product, Order, Call, Conversation, ApiResponse, UserSettings, ElevenLabsVoice };

export const testElevenLabsVoice = async ({ apiKey, voiceId, text }: { apiKey: string, voiceId: string, text: string }): Promise<Blob> => {
  const response = await fetch('/api/settings/elevenlabs/test-voice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-id': 'default' 
    },
    body: JSON.stringify({ apiKey, voiceId, text })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to test voice' }));
    throw new Error(errorData.error);
  }

  return response.blob();
}; 