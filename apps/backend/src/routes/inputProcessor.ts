import { Router, Request, Response } from 'express';
import { InputProcessor } from '../services/inputProcessor';

const router = Router();

interface ProcessTextRequest {
  text: string;
}

interface ProcessTwilioRequest {
  speechResult?: string;
  callSid: string;
  from: string;
  confidence?: string;
}

router.get('/status', (req: Request, res: Response) => {
  try {
    res.json({
      service: 'Input Processor Service',
      status: 'active',
      endpoints: [
        '/status',
        '/process-text',
        '/process-twilio-speech',
        '/test'
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting input processor status:', error);
    res.status(500).json({
      service: 'Input Processor Service',
      status: 'error',
      error: 'Failed to get service status',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/process-text', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text }: ProcessTextRequest = req.body;
    
    if (!text || typeof text !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid text: text field is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const inputProcessor = InputProcessor.getInstance();
    
    console.log('📝 Processing text input...');
    const processedResponse = await inputProcessor.processTextInput(text);
    
    res.json({
      success: true,
      data: {
        response: processedResponse.llmResponse,
        selectedPrompt: processedResponse.selectedPromptId,
        processingTime: processedResponse.processingTime,
        inputType: processedResponse.originalInput.type
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing text input:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process text input',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/process-twilio-speech', async (req: Request, res: Response): Promise<void> => {
  try {
    const { speechResult, callSid, from, confidence }: ProcessTwilioRequest = req.body;
    
    if (!speechResult || typeof speechResult !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid speechResult: field is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!callSid || !from) {
      res.status(400).json({
        success: false,
        error: 'Invalid request: callSid and from fields are required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const inputProcessor = InputProcessor.getInstance();
    
    console.log('🗣️ Processing Twilio speech input...');
    const processedResponse = await inputProcessor.processTwilioSpeech(
      speechResult, 
      callSid, 
      from
    );
    
    res.json({
      success: true,
      data: {
        response: processedResponse.llmResponse,
        selectedPrompt: processedResponse.selectedPromptId,
        processingTime: processedResponse.processingTime,
        inputType: processedResponse.originalInput.type,
        callInfo: {
          callSid,
          from,
          confidence
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing Twilio speech input:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Twilio speech input',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const inputProcessor = InputProcessor.getInstance();
    
    console.log('🧪 Running input processor test...');
    
    const testInputs = [
      'Hello there!',
      'I need help with my order',
      'What are your store hours?'
    ];

    const results = [];
    
    for (const testInput of testInputs) {
      try {
        const result = await inputProcessor.processTextInput(testInput);
        results.push({
          input: testInput,
          promptSelected: result.selectedPromptId,
          response: result.llmResponse,
          processingTime: result.processingTime,
          success: true
        });
      } catch (error) {
        results.push({
          input: testInput,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: successCount > 0,
      message: `Input processor test completed: ${successCount}/${testInputs.length} successful`,
      testResults: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error testing input processor:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Input processor test failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 