import { Router, Request, Response } from 'express';
import { LLMService } from '../services/llmService';

const router = Router();

interface GenerateRequest {
  input: string;
  systemPrompt?: string;
}

router.get('/status', (req: Request, res: Response) => {
  try {
    const llmService = LLMService.getInstance();
    const config = llmService.getConfig();
    const availableProviders = llmService.getAvailableProviders();
    
    res.json({
      service: 'LLM Service',
      status: llmService.isInitialized() ? 'initialized' : 'not initialized',
      primaryProvider: config?.provider || 'none',
      availableProviders: availableProviders,
      model: config?.model || 'not configured',
      endpoints: [
        '/status',
        '/test',
        '/generate',
        '/generate/customer-service',
        '/prompts',
        '/call-core'
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting LLM status:', error);
    res.status(500).json({
      service: 'LLM Service',
      status: 'error',
      error: 'Failed to get service status',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const llmService = LLMService.getInstance();
    
    if (!llmService.isInitialized()) {
      res.status(503).json({
        success: false,
        error: 'LLM Service not initialized',
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log('🧪 Running LLM basic functionality test...');
    
    const connectionValid = await llmService.validateConnection();
    if (!connectionValid) {
      res.status(503).json({
        success: false,
        error: 'LLM API connection validation failed',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const testPassed = await llmService.testBasicFunctionality();
    
    res.json({
      success: testPassed,
      message: testPassed ? 'LLM test completed successfully' : 'LLM test failed',
      connectionValid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error testing LLM service:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { input, systemPrompt }: GenerateRequest = req.body;
    
    if (!input || typeof input !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid input: input field is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const llmService = LLMService.getInstance();
    
    if (!llmService.isInitialized()) {
      res.status(503).json({
        success: false,
        error: 'LLM Service not initialized',
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log('🤖 Processing LLM generation request...');
    console.log('📝 Input:', input);
    console.log('🎯 System Prompt:', systemPrompt || 'default');

    const response = await llmService.generateResponse(input, systemPrompt);
    
    res.json({
      success: true,
      data: {
        response: response.content,
        model: response.model,
        usage: response.usage
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error generating LLM response:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate response',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/generate/customer-service', async (req: Request, res: Response): Promise<void> => {
  try {
    const { input }: { input: string } = req.body;
    
    if (!input || typeof input !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid input: input field is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const customerServicePrompt = `You are a helpful and professional customer service representative for an e-commerce store. 

Your role is to:
- Provide friendly, accurate, and helpful responses
- Assist with order inquiries, product questions, and general support
- Maintain a professional but warm tone
- Keep responses concise but informative
- Always aim to resolve the customer's issue or guide them to the next step

If you don't have specific information about an order or product, politely explain that you'll need to look into it further or transfer them to a specialist.`;

    const llmService = LLMService.getInstance();
    
    if (!llmService.isInitialized()) {
      res.status(503).json({
        success: false,
        error: 'LLM Service not initialized',
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log('🛍️ Processing customer service request...');
    const response = await llmService.generateResponse(input, customerServicePrompt);
    
    res.json({
      success: true,
      data: {
        response: response.content,
        model: response.model,
        usage: response.usage,
        context: 'customer-service'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error generating customer service response:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate customer service response',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/prompts', (req: Request, res: Response) => {
  try {
    const llmService = LLMService.getInstance();
    const prompts = llmService.getAvailablePrompts();
    
    res.json({
      success: true,
      data: {
        prompts: prompts.map(prompt => ({
          id: prompt.id,
          name: prompt.name,
          description: prompt.description,
          category: prompt.category
        })),
        total: prompts.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error retrieving prompts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prompts',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/generate-with-functions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { input, systemPrompt, storeId, userPhone, userEmail }: { 
      input: string; 
      systemPrompt?: string; 
      storeId?: string;
      userPhone?: string;
      userEmail?: string;
    } = req.body;
    
    if (!input || typeof input !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid input: input field is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const llmService = LLMService.getInstance();
    
    if (!llmService.isInitialized()) {
      res.status(503).json({
        success: false,
        error: 'LLM Service not initialized',
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log('🤖 Processing LLM generation request with function calling...');
    console.log('📝 Input:', input);
    console.log('🎯 System Prompt:', systemPrompt || 'default customer service');
    console.log('🏪 Store ID:', storeId);
    console.log('📞 User Phone:', userPhone);
    console.log('📧 User Email:', userEmail);

    // Build context for function calling
    const context = {
      storeId,
      userPhone,
      userEmail
    };

    const customerServicePrompt = systemPrompt || `You are a helpful and professional customer service representative for an e-commerce store. 

Your role is to:
- Provide friendly, accurate, and helpful responses
- Assist with order inquiries, product questions, and general support
- Use the available functions to look up specific information when needed
- Maintain a professional but warm tone
- Keep responses concise but informative
- Always aim to resolve the customer's issue or guide them to the next step

Available functions:
- getOrderStatus: Look up order details by order number
- getCustomerOrders: Find all orders for a customer by phone or email
- getProductInfo: Get detailed product information by name, SKU, or ID
- searchProducts: Search for products by query, category, or vendor
- updateOrderStatus: Update order status (read-only for security)

When you need specific information, use the appropriate function. If you don't have specific information about an order or product, use the functions to look it up.`;

    const response = await llmService.generateResponseWithFunctions(input, customerServicePrompt, context);
    
    res.json({
      success: true,
      data: {
        response: response.content,
        model: response.model,
        provider: response.provider,
        usage: response.usage,
        functionCalls: response.functionCalls,
        context: 'customer-service-with-functions'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error generating LLM response with functions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate response with functions',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/call-core', async (req: Request, res: Response): Promise<void> => {
  try {
    const { promptTemplate, inputText }: { promptTemplate: string; inputText: string } = req.body;
    
    if (!promptTemplate || typeof promptTemplate !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid promptTemplate: field is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!inputText || typeof inputText !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid inputText: field is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const llmService = LLMService.getInstance();
    
    if (!llmService.isInitialized()) {
      res.status(503).json({
        success: false,
        error: 'LLM Service not initialized',
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log('⚙️ Processing core LLM API call...');
    const rawResponse = await llmService.callLLM(promptTemplate, inputText);
    
    res.json({
      success: true,
      data: {
        rawResponse: rawResponse,
        message: 'Core LLM API call completed successfully'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in core LLM API call:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute core LLM API call',
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 