import { Router, Request, Response } from 'express';
import { LLMService } from '../services/llmService';
import { LLMFunctionService } from '../services/llmFunctionService';

const router = Router();
const llmFunctionService = LLMFunctionService.getInstance();

// Test LLM function calling
router.post('/test-function-calling', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userInput, systemPrompt, context } = req.body;

    if (!userInput) {
      res.status(400).json({
        success: false,
        error: 'userInput is required'
      });
      return;
    }

    const llmService = LLMService.getInstance();
    
    if (!llmService.isInitialized()) {
      res.status(503).json({
        success: false,
        error: 'LLM service not initialized'
      });
      return;
    }

    console.log('🧪 Testing LLM function calling with input:', userInput);

    const response = await llmService.generateResponseWithFunctions(
      userInput,
      systemPrompt || 'You are a helpful customer service assistant. Use the available functions to help customers with their orders and product inquiries.',
      context
    );

    res.json({
      success: true,
      response: response.content,
      functionCalls: response.functionCalls,
      model: response.model,
      provider: response.provider,
      usage: response.usage
    });

  } catch (error) {
    console.error('❌ Error in function calling test:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get available functions
router.get('/functions', (req: Request, res: Response) => {
  try {
    const functionService = LLMFunctionService.getInstance();
    const availableFunctions = functionService.getAvailableFunctions();

    res.json({
      success: true,
      functions: availableFunctions,
      count: availableFunctions.length
    });
  } catch (error) {
    console.error('❌ Error getting available functions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test individual function
router.post('/test-function', async (req: Request, res: Response): Promise<void> => {
  try {
    const { functionName, arguments: args } = req.body;

    if (!functionName) {
      res.status(400).json({
        success: false,
        error: 'functionName is required'
      });
      return;
    }

    const result = await llmFunctionService.executeFunction(
      functionName,
      args || {}
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error testing function:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Status endpoint
router.get('/status', (req: Request, res: Response) => {
  try {
    const llmService = LLMService.getInstance();
    const functionService = LLMFunctionService.getInstance();
    
    res.json({
      success: true,
      llmService: {
        initialized: llmService.isInitialized(),
        config: llmService.getConfig(),
        providers: llmService.getAvailableProviders()
      },
      functionService: {
        availableFunctions: functionService.getAvailableFunctions().length
      },
      endpoints: [
        'POST /test-function-calling',
        'GET /functions', 
        'POST /test-function',
        'GET /status'
      ]
    });
  } catch (error) {
    console.error('❌ Error getting status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 