import { DatabaseService } from './database';
import { CallLoggingService } from './callLoggingService';

interface ConversationContext {
  userId?: string;
  storeId?: string;
  conversationHistory: ConversationMessage[];
  relevantProducts: Product[];
  relevantOrders: Order[];
  userProfile?: UserProfile;
  contextSummary: string;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: any;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  status: string;
  storeId: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  customerEmail?: string;
  customerPhone?: string;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
  storeId: string;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

interface UserProfile {
  phone?: string;
  email?: string;
  name?: string;
  recentOrders: Order[];
  preferences?: any;
}

export class ContextManagerService {
  private static instance: ContextManagerService;
  private databaseService: DatabaseService;
  private callLoggingService: CallLoggingService;

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.callLoggingService = CallLoggingService.getInstance();
  }

  public static getInstance(): ContextManagerService {
    if (!ContextManagerService.instance) {
      ContextManagerService.instance = new ContextManagerService();
    }
    return ContextManagerService.instance;
  }

  /**
   * Build comprehensive context for LLM based on conversation and user data
   */
  async buildContext(params: {
    conversationId?: string;
    callSid?: string;
    userPhone?: string;
    userEmail?: string;
    storeId?: string;
    topic?: string;
    maxHistoryMessages?: number;
  }): Promise<ConversationContext> {
    const { conversationId, callSid, userPhone, userEmail, storeId, topic, maxHistoryMessages = 10 } = params;

    try {
      // Get conversation history
      const conversationHistory = await this.getConversationHistory(conversationId, callSid, maxHistoryMessages);
      
      // Identify user and get profile
      const userProfile = await this.getUserProfile(userPhone, userEmail);
      
      // Determine store context
      const effectiveStoreId = storeId || await this.inferStoreFromContext(conversationHistory, userProfile);
      
      // Get relevant products and orders based on topic and user
      const relevantProducts = await this.getRelevantProducts(topic, effectiveStoreId, conversationHistory);
      const relevantOrders = await this.getRelevantOrders(userProfile, effectiveStoreId, topic, conversationHistory);
      
      // Generate context summary
      const contextSummary = this.generateContextSummary({
        conversationHistory,
        relevantProducts,
        relevantOrders,
        userProfile,
        topic
      });

      return {
        userId: userProfile?.phone || userProfile?.email,
        storeId: effectiveStoreId,
        conversationHistory,
        relevantProducts,
        relevantOrders,
        userProfile,
        contextSummary
      };
    } catch (error) {
      console.error('Error building context:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to build conversation context: ${errorMessage}`);
    }
  }

  /**
   * Get conversation history from database
   */
  private async getConversationHistory(
    conversationId?: string, 
    callSid?: string, 
    maxMessages: number = 10
  ): Promise<ConversationMessage[]> {
    try {
      let messages: ConversationMessage[] = [];

      if (conversationId) {
        // Get messages from conversation_messages table
        const { data, error } = await this.databaseService.getClient()
          .from('conversation_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('message_index', { ascending: true })
          .limit(maxMessages);

        if (error) throw error;

        messages = data?.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          metadata: msg.metadata
        })) || [];
      } else if (callSid) {
        // Get conversation from call logs
        const callLog = await this.callLoggingService.getCallLog(callSid);
        if (callLog && (callLog as any).conversation_history) {
          messages = (callLog as any).conversation_history.slice(-maxMessages);
        }
      }

      return messages;
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Get user profile based on phone or email
   */
  private async getUserProfile(phone?: string, email?: string): Promise<UserProfile | undefined> {
    if (!phone && !email) return undefined;

    try {
      // Look for recent orders by this user
      let query = this.databaseService.getClient()
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (phone) {
        query = query.eq('customer_phone', phone);
      } else if (email) {
        query = query.eq('customer_email', email);
      }

      const { data: orders, error } = await query;
      if (error) throw error;

      const recentOrders: Order[] = orders?.map((order: any) => ({
        id: order.id,
        orderNumber: order.platform_order_id,
        status: order.status,
        totalAmount: parseFloat(order.total_amount),
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        items: order.line_items || [],
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        storeId: order.store_id
      })) || [];

      return {
        phone,
        email,
        recentOrders
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return { phone, email, recentOrders: [] };
    }
  }

  /**
   * Infer store context from conversation history and user profile
   */
  private async inferStoreFromContext(
    conversationHistory: ConversationMessage[], 
    userProfile?: UserProfile
  ): Promise<string | undefined> {
    // If user has recent orders, use the store from the most recent order
    if (userProfile?.recentOrders && userProfile.recentOrders.length > 0) {
      return userProfile.recentOrders[0].storeId;
    }

    // Could add more sophisticated inference logic here
    // For now, return undefined to use default store
    return undefined;
  }

  /**
   * Get relevant products based on conversation topic and context
   */
  private async getRelevantProducts(
    topic?: string, 
    storeId?: string, 
    conversationHistory?: ConversationMessage[]
  ): Promise<Product[]> {
    if (!storeId && !topic) return [];

    try {
      let query = this.databaseService.getClient()
        .from('products')
        .select('*')
        .limit(5);

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      // If we have a topic, search for products matching the topic
      if (topic) {
        query = query.or(`name.ilike.%${topic}%,description.ilike.%${topic}%`);
      }

      // Extract product names from conversation history
      const mentionedProducts = this.extractProductMentions(conversationHistory);
      if (mentionedProducts.length > 0) {
        const productFilter = mentionedProducts.map(name => `name.ilike.%${name}%`).join(',');
        query = query.or(productFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data?.map((product: any) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        status: product.status,
        storeId: product.store_id
      })) || [];
    } catch (error) {
      console.error('Error getting relevant products:', error);
      return [];
    }
  }

  /**
   * Get relevant orders based on user profile and conversation context
   */
  private async getRelevantOrders(
    userProfile?: UserProfile, 
    storeId?: string, 
    topic?: string, 
    conversationHistory?: ConversationMessage[]
  ): Promise<Order[]> {
    try {
      let orders: Order[] = [];

      // Start with user's recent orders if available
      if (userProfile?.recentOrders) {
        orders = [...userProfile.recentOrders];
      }

      // Extract order numbers mentioned in conversation
      const mentionedOrderNumbers = this.extractOrderMentions(conversationHistory);
      if (mentionedOrderNumbers.length > 0) {
        let query = this.databaseService.getClient()
          .from('orders')
          .select('*')
          .in('platform_order_id', mentionedOrderNumbers);

        if (storeId) {
          query = query.eq('store_id', storeId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const mentionedOrders: Order[] = data?.map(order => ({
          id: order.id,
          orderNumber: order.platform_order_id,
          status: order.status,
          totalAmount: parseFloat(order.total_amount),
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          items: order.line_items || [],
          createdAt: new Date(order.created_at),
          updatedAt: new Date(order.updated_at),
          storeId: order.store_id
        })) || [];

        // Merge with existing orders, avoiding duplicates
        mentionedOrders.forEach(order => {
          if (!orders.find(existing => existing.id === order.id)) {
            orders.push(order);
          }
        });
      }

      return orders.slice(0, 5); // Limit to 5 most relevant orders
    } catch (error) {
      console.error('Error getting relevant orders:', error);
      return userProfile?.recentOrders || [];
    }
  }

  /**
   * Extract product mentions from conversation history
   */
  private extractProductMentions(conversationHistory?: ConversationMessage[]): string[] {
    if (!conversationHistory) return [];

    const productKeywords: string[] = [];
    const conversationText = conversationHistory.map(msg => msg.content).join(' ').toLowerCase();

    // Simple keyword extraction - could be enhanced with NLP
    const commonProductTerms = ['shirt', 'pants', 'shoes', 'jacket', 'dress', 'phone', 'laptop', 'book'];
    commonProductTerms.forEach(term => {
      if (conversationText.includes(term)) {
        productKeywords.push(term);
      }
    });

    return productKeywords;
  }

  /**
   * Extract order number mentions from conversation history
   */
  private extractOrderMentions(conversationHistory?: ConversationMessage[]): string[] {
    if (!conversationHistory) return [];

    const orderNumbers: string[] = [];
    const conversationText = conversationHistory.map(msg => msg.content).join(' ');

    // Look for order number patterns (e.g., #12345, order 12345, etc.)
    const orderPatterns = [
      /#(\d{3,})/g,
      /order\s+(\d{3,})/gi,
      /order\s+#(\d{3,})/gi,
      /\b(\d{6,})\b/g // 6+ digit numbers that could be order IDs
    ];

    orderPatterns.forEach(pattern => {
      const matches = conversationText.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          orderNumbers.push(match[1]);
        }
      }
    });

    return [...new Set(orderNumbers)]; // Remove duplicates
  }

  /**
   * Generate a context summary for the LLM
   */
  private generateContextSummary(params: {
    conversationHistory: ConversationMessage[];
    relevantProducts: Product[];
    relevantOrders: Order[];
    userProfile?: UserProfile;
    topic?: string;
  }): string {
    const { conversationHistory, relevantProducts, relevantOrders, userProfile, topic } = params;

    let summary = "CONVERSATION CONTEXT:\n\n";

    // User information
    if (userProfile) {
      summary += "USER PROFILE:\n";
      if (userProfile.phone) summary += `- Phone: ${userProfile.phone}\n`;
      if (userProfile.email) summary += `- Email: ${userProfile.email}\n`;
      if (userProfile.recentOrders?.length > 0) {
        summary += `- Recent Orders: ${userProfile.recentOrders.length} orders\n`;
      }
      summary += "\n";
    }

    // Recent conversation
    if (conversationHistory.length > 0) {
      summary += "RECENT CONVERSATION:\n";
      conversationHistory.slice(-3).forEach(msg => {
        summary += `- ${msg.role.toUpperCase()}: ${msg.content}\n`;
      });
      summary += "\n";
    }

    // Relevant orders
    if (relevantOrders.length > 0) {
      summary += "RELEVANT ORDERS:\n";
      relevantOrders.forEach(order => {
        summary += `- Order #${order.orderNumber}: ${order.status} - $${order.totalAmount}\n`;
      });
      summary += "\n";
    }

    // Relevant products
    if (relevantProducts.length > 0) {
      summary += "RELEVANT PRODUCTS:\n";
      relevantProducts.forEach(product => {
        summary += `- ${product.name}: $${product.price} (${product.status})\n`;
      });
      summary += "\n";
    }

    // Current topic
    if (topic) {
      summary += `CURRENT TOPIC: ${topic}\n\n`;
    }

    return summary;
  }

  /**
   * Update context with new message
   */
  async updateContextWithMessage(
    conversationId: string,
    message: ConversationMessage
  ): Promise<void> {
    try {
      // Store the message in the database
      await this.databaseService.getClient()
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          role: message.role,
          content: message.content,
          metadata: message.metadata,
          created_at: message.timestamp.toISOString()
        });
    } catch (error) {
      console.error('Error updating context with message:', error);
      throw error;
    }
  }

  /**
   * Get context for LLM function calling
   */
  async getContextForFunctionCalling(storeId: string): Promise<{
    availableFunctions: string[];
    storeInfo: any;
  }> {
    try {
      // Get store information
      const { data: store, error } = await this.databaseService.getClient()
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();

      if (error) throw error;

      const availableFunctions = [
        'getOrderStatus',
        'getProductInfo',
        'searchProducts',
        'getCustomerOrders',
        'updateOrderStatus'
      ];

      return {
        availableFunctions,
        storeInfo: store
      };
    } catch (error) {
      console.error('Error getting context for function calling:', error);
      return {
        availableFunctions: [],
        storeInfo: null
      };
    }
  }
}

export { ConversationContext, ConversationMessage, Product, Order, OrderItem, UserProfile };
