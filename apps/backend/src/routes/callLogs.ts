import { Router, Request, Response } from 'express';
import { CallLoggingService } from '../services/callLoggingService';

const router = Router();
const callLoggingService = CallLoggingService.getInstance();

// Get call log by Call SID
router.get('/call/:callSid', async (req: Request, res: Response): Promise<void> => {
  try {
    const { callSid } = req.params;
    
    const callLog = await callLoggingService.getCallLog(callSid);
    
    if (!callLog) {
      res.status(404).json({
        success: false,
        message: 'Call log not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      success: true,
      data: callLog,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting call log:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get recent call logs
router.get('/calls', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    const callLogs = await callLoggingService.getRecentCallLogs(limit);
    
    res.json({
      success: true,
      data: callLogs,
      count: callLogs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting call logs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get active calls
router.get('/calls/active', (req: Request, res: Response): void => {
  try {
    const activeCalls = callLoggingService.getActiveCalls();
    
    res.json({
      success: true,
      data: activeCalls,
      count: activeCalls.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting active calls:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get call statistics
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await callLoggingService.getCallStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting call stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Manual call logging endpoints for testing

// Start a call log
router.post('/call/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const { callSid, from, to, direction } = req.body;
    
    if (!callSid || !from || !to || !direction) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: callSid, from, to, direction',
        timestamp: new Date().toISOString()
      });
      return;
    }

    await callLoggingService.startCall(callSid, from, to, direction);
    
    res.json({
      success: true,
      message: 'Call logging started',
      callSid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error starting call log:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Log transcription
router.post('/call/:callSid/transcription', async (req: Request, res: Response): Promise<void> => {
  try {
    const { callSid } = req.params;
    const { transcription, confidence } = req.body;
    
    if (!transcription) {
      res.status(400).json({
        success: false,
        message: 'Transcription is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    await callLoggingService.logTranscription(callSid, transcription, confidence);
    
    res.json({
      success: true,
      message: 'Transcription logged',
      callSid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error logging transcription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Log LLM interaction
router.post('/call/:callSid/llm', async (req: Request, res: Response): Promise<void> => {
  try {
    const { callSid } = req.params;
    const { input, output, model, processingTime } = req.body;
    
    if (!input || !output) {
      res.status(400).json({
        success: false,
        message: 'Input and output are required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    await callLoggingService.logLLMInteraction(callSid, input, output, model, processingTime);
    
    res.json({
      success: true,
      message: 'LLM interaction logged',
      callSid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error logging LLM interaction:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Log TTS audio
router.post('/call/:callSid/tts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { callSid } = req.params;
    const { audioUrl } = req.body;
    
    if (!audioUrl) {
      res.status(400).json({
        success: false,
        message: 'Audio URL is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    await callLoggingService.logTTSAudio(callSid, audioUrl);
    
    res.json({
      success: true,
      message: 'TTS audio logged',
      callSid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error logging TTS audio:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// End call logging
router.post('/call/:callSid/end', async (req: Request, res: Response): Promise<void> => {
  try {
    const { callSid } = req.params;
    const { status, duration } = req.body;
    
    if (!status) {
      res.status(400).json({
        success: false,
        message: 'Status is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    await callLoggingService.endCall(callSid, status, duration);
    
    res.json({
      success: true,
      message: 'Call logging ended',
      callSid,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error ending call log:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Service status
router.get('/status', (req: Request, res: Response): void => {
  res.json({
    service: 'Call Logging Service',
    status: 'active',
    endpoints: [
      'GET /call/:callSid - Get call log by SID',
      'GET /calls - Get recent call logs',
      'GET /calls/active - Get active calls',
      'GET /stats - Get call statistics',
      'POST /call/start - Start call logging',
      'POST /call/:callSid/transcription - Log transcription',
      'POST /call/:callSid/llm - Log LLM interaction',
      'POST /call/:callSid/tts - Log TTS audio',
      'POST /call/:callSid/end - End call logging'
    ],
    timestamp: new Date().toISOString()
  });
});

export default router; 