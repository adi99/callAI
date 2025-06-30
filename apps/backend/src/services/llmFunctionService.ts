import { ContextManagerService } from './contextManagerService';
import { DatabaseService } from './database';

export interface LLMFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export interface FunctionCallResult {
  success: boolean;
  data?: any;
  error?: string;
  functionName: string;
  parameters: Record<string, any>;
}

export class LLMFunctionService {
  private static instance: LLMFunctionService;
  private contextManager: ContextManagerService;
  private databaseService: DatabaseService;
  private availableFunctions: Map<string, LLMFunction> = new Map();

  private constructor() {
    this.contextManager = ContextManagerService.getInstance();
    this.databaseService = DatabaseService.getInstance();
    this.initializeFunctions();
  }

  public static getInstance(): LLMFunctionService {
    if (!LLMFunctionService.instance) {
      LLMFunctionService.instance = new LLMFunctionService();
    }
    return LLMFunctionService.instance;
  }

  private initializeFunctions(): void {
    const functions: LLMFunction[] = [
      {
        name: 'getOrderStatus',
        description: 'Get the status and details of a customer order by order number',
        parameters: {
          type: 'object',
          properties: {
            orderNumber: {
              type: 'string',
              description: 'The order number or order ID to look up'
            },
            customerPhone: {
              type: 'string',
              description: 'Customer phone number for verification (optional)'
            }
          },
          required: ['orderNumber']
        }
      },
      {
        name: 'getProductInfo',
        description: 'Get detailed information about a specific product',
        parameters: {
          type: 'object',
          properties: {
            productName: {
              type: 'string',
              description: 'Name or partial name of the product to search for'
            },
            productId: {
              type: 'string',
              description: 'Specific product ID if known'
            },
            storeId: {
              type: 'string',
              description: 'Store ID to search within (optional)'
            }
          },
          required: []
        }
      }
    ];

    functions.forEach(func => {
      this.availableFunctions.set(func.name, func);
    });

    console.log(`✅ Initialized ${functions.length} LLM functions`);
  }

  public getAvailableFunctions(): LLMFunction[] {
    return Array.from(this.availableFunctions.values());
  }

  public async executeFunction(
    functionName: string, 
    parameters: Record<string, any>
  ): Promise<FunctionCallResult> {
    console.log(`🔧 Executing function: ${functionName}`, parameters);

    try {
      let result: any;

      switch (functionName) {
        case 'getOrderStatus':
          result = await this.getOrderStatus(parameters.orderNumber, parameters.customerPhone);
          break;
        
        case 'getProductInfo':
          result = await this.getProductInfo(
            parameters.productName, 
            parameters.productId, 
            parameters.storeId
          );
          break;
        
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }

      return {
        success: true,
        data: result,
        functionName,
        parameters
      };

    } catch (error) {
      console.error(`❌ Error executing function ${functionName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        functionName,
        parameters
      };
    }
  }

  private async getOrderStatus(orderNumber: string, customerPhone?: string): Promise<any> {
    try {
      let query = this.databaseService.getClient()
        .from('orders')
        .select(`
          *,
          stores!inner(name)
        `)
        .eq('platform_order_id', orderNumber);

      if (customerPhone) {
        query = query.eq('customer_phone', customerPhone);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return {
          found: false,
          message: `No order found with number ${orderNumber}${customerPhone ? ' for the provided phone number' : ''}`
        };
      }

      return {
        found: true,
        orderNumber: data.platform_order_id,
        status: data.status,
        totalAmount: parseFloat(data.total_amount || '0'),
        createdAt: data.created_at,
        storeName: (data.stores as any)?.name || 'Unknown Store',
        trackingNumber: data.tracking_number
      };
    } catch (error) {
      console.error('Error getting order status:', error);
      return {
        found: false,
        message: 'Error retrieving order information'
      };
    }
  }

  private async getProductInfo(productName?: string, productId?: string, storeId?: string): Promise<any> {
    try {
      let query = this.databaseService.getClient()
        .from('products')
        .select(`
          *,
          stores!inner(name)
        `);

      if (productId) {
        query = query.eq('platform_product_id', productId);
      }

      if (productName) {
        query = query.ilike('name', `%${productName}%`);
      }

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query
        .order('updated_at', { ascending: false })
        .limit(5);

      if (error || !data || data.length === 0) {
        return {
          found: false,
          message: `No products found`
        };
      }

      return {
        found: true,
        products: data.map((product: any) => ({
          id: product.platform_product_id,
          name: product.name,
          description: product.description,
          price: parseFloat(product.price || '0'),
          status: product.status,
          inventory: product.inventory_quantity,
          storeName: (product.stores as any)?.name || 'Unknown Store'
        }))
      };
    } catch (error) {
      console.error('Error getting product info:', error);
      return {
        found: false,
        message: 'Error retrieving product information'
      };
    }
  }
} 