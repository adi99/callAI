import { Router, Request, Response } from 'express';
import { ContextManagerService } from '../services/contextManagerService';

const router = Router();
const contextManager = ContextManagerService.getInstance();

router.post('/build-context', async (req: Request, res: Response) => {
  try {
    const {
      conversationId,
      callSid,
      userPhone,
      userEmail,
      storeId,
      topic,
      maxHistoryMessages
    } = req.body;

    const context = await contextManager.buildContext({
      conversationId,
      callSid,
      userPhone,
      userEmail,
      storeId,
      topic,
      maxHistoryMessages
    });

    res.json({
      success: true,
      data: context
    });
  } catch (error) {
    console.error('Error building context:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/update-context', async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId, message } = req.body;

    if (!conversationId || !message) {
      res.status(400).json({
        success: false,
        error: 'conversationId and message are required'
      });
      return;
    }

    await contextManager.updateContextWithMessage(conversationId, {
      id: message.id || Date.now().toString(),
      role: message.role,
      content: message.content,
      timestamp: new Date(message.timestamp || Date.now()),
      metadata: message.metadata
    });

    res.json({
      success: true,
      message: 'Context updated successfully'
    });
  } catch (error) {
    console.error('Error updating context:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/function-context/:storeId', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;

    const functionContext = await contextManager.getContextForFunctionCalling(storeId);

    res.json({
      success: true,
      data: functionContext
    });
  } catch (error) {
    console.error('Error getting function context:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Context Manager API is working',
    timestamp: new Date().toISOString()
  });
});

export default router; 