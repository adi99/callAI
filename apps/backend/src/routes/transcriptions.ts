import { Router, Request, Response } from 'express';
import { TranscriptionProcessorService } from '../services/transcriptionProcessorService';

const router = Router();

/**
 * Get processing statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const transcriptionProcessor = TranscriptionProcessorService.getInstance();
    const stats = transcriptionProcessor.getProcessingStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting transcription stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transcription statistics'
    });
  }
});

/**
 * Get transcription by ID
 */
router.get('/transcription/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const transcriptionProcessor = TranscriptionProcessorService.getInstance();
    const transcription = transcriptionProcessor.getTranscription(id);
    
    if (!transcription) {
      res.status(404).json({
        success: false,
        error: 'Transcription not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: transcription
    });
  } catch (error) {
    console.error('Error getting transcription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transcription'
    });
  }
});

/**
 * Get all transcriptions for a call
 */
router.get('/call/:callSid/transcriptions', (req: Request, res: Response) => {
  try {
    const { callSid } = req.params;
    const transcriptionProcessor = TranscriptionProcessorService.getInstance();
    const transcriptions = transcriptionProcessor.getCallTranscriptions(callSid);
    
    res.json({
      success: true,
      data: {
        callSid,
        transcriptions,
        count: transcriptions.length
      }
    });
  } catch (error) {
    console.error('Error getting call transcriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get call transcriptions'
    });
  }
});

/**
 * Get conversation context for a call
 */
router.get('/call/:callSid/conversation', (req: Request, res: Response): void => {
  try {
    const { callSid } = req.params;
    const transcriptionProcessor = TranscriptionProcessorService.getInstance();
    const conversation = transcriptionProcessor.getConversationContext(callSid);
    
    if (!conversation) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation'
    });
  }
});

/**
 * Get full conversation text for a call
 */
router.get('/call/:callSid/full-text', (req: Request, res: Response): void => {
  try {
    const { callSid } = req.params;
    const transcriptionProcessor = TranscriptionProcessorService.getInstance();
    const fullText = transcriptionProcessor.getFullConversation(callSid);
    
    if (!fullText) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        callSid,
        fullText,
                  length: fullText?.length || 0,
          wordCount: fullText?.split(/\s+/).length || 0
      }
    });
  } catch (error) {
    console.error('Error getting full conversation text:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation text'
    });
  }
});

/**
 * Mark conversation as completed
 */
router.post('/call/:callSid/complete', (req: Request, res: Response) => {
  try {
    const { callSid } = req.params;
    const transcriptionProcessor = TranscriptionProcessorService.getInstance();
    
    transcriptionProcessor.completeConversation(callSid);
    
    res.json({
      success: true,
      message: `Conversation ${callSid} marked as completed`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error completing conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete conversation'
    });
  }
});

const searchTranscriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, startDate, endDate, callSid, limit = 50, offset = 0 } = req.query;
    
    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
      return;
    }

    const searchParams = {
      query: query as string,
      startDate: startDate as string,
      endDate: endDate as string,
      callSid: callSid as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    const transcriptionProcessor = TranscriptionProcessorService.getInstance();
    // TODO: Implement actual search functionality
    const results: any[] = [];

    res.json({
      success: true,
      data: results,
      pagination: {
        limit: searchParams.limit,
        offset: searchParams.offset,
        total: results.length
      }
    });
  } catch (error) {
    console.error('Error searching transcriptions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search transcriptions'
    });
  }
};

router.get('/search', searchTranscriptions);

/**
 * Cleanup old transcriptions and conversations
 */
router.post('/cleanup', (req: Request, res: Response) => {
  try {
    const { olderThanHours = 24 } = req.body;
    const transcriptionProcessor = TranscriptionProcessorService.getInstance();
    
    transcriptionProcessor.cleanup(olderThanHours);
    
    res.json({
      success: true,
      message: `Cleanup completed for data older than ${olderThanHours} hours`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup transcriptions'
    });
  }
});

/**
 * Service status and health check
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const transcriptionProcessor = TranscriptionProcessorService.getInstance();
    const stats = transcriptionProcessor.getProcessingStats();
    
    res.json({
      service: 'Transcription Processing Service',
      status: 'active',
      endpoints: [
        '/stats',
        '/transcription/:id',
        '/call/:callSid/transcriptions',
        '/call/:callSid/conversation',
        '/call/:callSid/full-text',
        '/call/:callSid/complete',
        '/search',
        '/cleanup',
        '/status'
      ],
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting transcription service status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service status'
    });
  }
});

export default router; 