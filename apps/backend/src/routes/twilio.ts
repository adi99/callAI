import { Router, Request, Response } from 'express';
import { IntegratedTTSService } from '../services/integratedTTSService';
import { InputProcessor } from '../services/inputProcessor';
import { AudioRecordingService } from '../services/audioRecordingService';
import { AudioStreamService } from '../services/audioStreamService';

const router = Router();

// Configuration for audio capture mode
enum AudioCaptureMode {
  GATHER = 'gather',        // Twilio's built-in STT (current)
  STREAMING = 'streaming',  // Real-time audio streaming for external STT
  RECORDING = 'recording'   // Record audio segments for external STT
}

// Current configuration - can be moved to environment variables later
const AUDIO_CONFIG = {
  mode: AudioCaptureMode.GATHER, // Default to current behavior
  streamingEnabled: false,       // Will be enabled in subtask 14.2
  recordingEnabled: true,        // Ready for use
  maxRecordingLength: 30,        // seconds
  recordingTimeout: 5,           // seconds of silence before stopping
};

interface TwilioWebhookParams {
  CallSid?: string;
  From?: string;
  To?: string;
  CallStatus?: string;
  Direction?: string;
  Caller?: string;
  Called?: string;
  CallerCity?: string;
  CallerState?: string;
  CallerCountry?: string;
  CalledCity?: string;
  CalledState?: string;
  CalledCountry?: string;
  RecordingSid?: string;
  RecordingUrl?: string;
  RecordingDuration?: string;
  SpeechResult?: string;
  Confidence?: string;
  Digits?: string;
  StreamSid?: string;           // For audio streaming
  [key: string]: any;
}

interface TwiMLOptions {
  includeGather?: boolean;
  includeStreaming?: boolean;
  streamUrl?: string;
  recordAudio?: boolean;
}

function generateTwiML(message: string, options: TwiMLOptions = {}): string {
  const { includeGather = false, includeStreaming = false, streamUrl, recordAudio = false } = options;
  
  let twimlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${message}</Say>`;

  if (includeStreaming && streamUrl) {
    // Real-time audio streaming for STT processing
    twimlContent += `
  <Start>
    <Stream url="${streamUrl}" track="inbound_track" />
  </Start>`;
  }

  if (recordAudio) {
    // Record audio segments for processing
    twimlContent += `
  <Record 
    action="/api/twilio/recording-complete" 
    method="POST" 
    maxLength="${AUDIO_CONFIG.maxRecordingLength}" 
    timeout="${AUDIO_CONFIG.recordingTimeout}" 
    playBeep="false" 
    recordingStatusCallback="/api/twilio/recording-status" 
    recordingStatusCallbackMethod="POST"
  />`;
  }

  if (includeGather) {
    twimlContent += `
  <Gather input="speech dtmf" timeout="10" speechTimeout="auto" action="/api/twilio/user-input" method="POST">
    <Say voice="alice">Please tell me how I can help you today, or press any key to continue.</Say>
  </Gather>
  <Say voice="alice">I didn't hear anything. Please call back when you're ready to speak. Goodbye!</Say>
  <Hangup/>`;
  } else {
    twimlContent += `
  <Pause length="1"/>
  <Say voice="alice">Goodbye!</Say>
  <Hangup/>`;
  }

  twimlContent += `
</Response>`;

  return twimlContent;
}

// Legacy function for backward compatibility
function generateTwiMLLegacy(message: string, includeGather: boolean = false): string {
  return generateTwiML(message, { includeGather });
}

// Utility function to determine audio capture method based on configuration
function getAudioCaptureOptions(callSid: string, host?: string): TwiMLOptions {
  const options: TwiMLOptions = {};

  switch (AUDIO_CONFIG.mode) {
    case AudioCaptureMode.STREAMING:
      if (AUDIO_CONFIG.streamingEnabled && host) {
        options.includeStreaming = true;
        options.streamUrl = `wss://${host}/api/twilio/audio-stream`;
      } else {
        // Fallback to gather if streaming not ready
        options.includeGather = true;
      }
      break;
    
    case AudioCaptureMode.RECORDING:
      if (AUDIO_CONFIG.recordingEnabled) {
        options.recordAudio = true;
      } else {
        // Fallback to gather if recording not ready
        options.includeGather = true;
      }
      break;
    
    case AudioCaptureMode.GATHER:
    default:
      options.includeGather = true;
      break;
  }

  console.log(`🎵 Audio capture mode for call ${callSid}:`, AUDIO_CONFIG.mode, options);
  return options;
}

// TTS-Enhanced Audio Capture Options
function getTTSCaptureOptions(callSid: string, host?: string): TwiMLOptions {
  const options: TwiMLOptions = {};

  switch (AUDIO_CONFIG.mode) {
    case AudioCaptureMode.STREAMING:
      if (AUDIO_CONFIG.streamingEnabled && host) {
        options.includeStreaming = true;
        options.streamUrl = `wss://${host}/api/twilio/audio-stream`;
      } else {
        options.includeGather = true;
      }
      break;
    
    case AudioCaptureMode.RECORDING:
      if (AUDIO_CONFIG.recordingEnabled) {
        options.recordAudio = true;
      } else {
        options.includeGather = true;
      }
      break;
    
    case AudioCaptureMode.GATHER:
    default:
      options.includeGather = true;
      break;
  }

  console.log(`🎙️ TTS-enhanced audio capture for call ${callSid}:`, AUDIO_CONFIG.mode, options);
  return options;
}

router.post('/incoming-call', (req: Request, res: Response) => {
  try {
    const twilioParams: TwilioWebhookParams = req.body;

    const callInfo = {
      callSid: twilioParams.CallSid,
      from: twilioParams.From,
      to: twilioParams.To,
      callStatus: twilioParams.CallStatus,
      direction: twilioParams.Direction,
      caller: twilioParams.Caller,
      called: twilioParams.Called,
      callerLocation: {
        city: twilioParams.CallerCity,
        state: twilioParams.CallerState,
        country: twilioParams.CallerCountry
      },
      calledLocation: {
        city: twilioParams.CalledCity,
        state: twilioParams.CalledState,
        country: twilioParams.CalledCountry
      },
      timestamp: new Date().toISOString()
    };

    console.log('📞 Twilio Incoming Call Webhook:', callInfo);
    console.log('📋 Full Twilio Parameters:', twilioParams);

    const welcomeMessage = `Hello! Welcome to our voice-enabled customer service. You're calling from ${callInfo.from || 'an unknown number'}.`;
    
    // Use the audio capture configuration to determine the appropriate TwiML
    const audioOptions = getAudioCaptureOptions(callInfo.callSid || '', req.get('host'));
    const twimlResponse = generateTwiML(welcomeMessage, audioOptions);

    console.log('🎵 Generated TwiML Response:', twimlResponse);

    res.type('text/xml');
    res.status(200).send(twimlResponse);
  } catch (error) {
    console.error('❌ Error processing Twilio webhook:', error);
    
    const errorTwiML = generateTwiML('Sorry, we are experiencing technical difficulties. Please try calling again later.');
    res.type('text/xml');
    res.status(200).send(errorTwiML);
  }
});

// Enhanced endpoint for handling recording completion
router.post('/recording-complete', async (req: Request, res: Response) => {
  try {
    const twilioParams: TwilioWebhookParams = req.body;

    console.log('🎙️ Recording Complete Webhook:', twilioParams);

    // Use the AudioRecordingService to handle the recording
    const audioRecordingService = AudioRecordingService.getInstance();
    
    const recordingMetadata = await audioRecordingService.processRecordingComplete(
      twilioParams.CallSid || '',
      twilioParams.RecordingSid || '',
      twilioParams.RecordingUrl || '',
      twilioParams.RecordingDuration || '0',
      twilioParams.From || '',
      twilioParams.To
    );

    console.log('✅ Recording processed and ready for STT:', recordingMetadata.recordingSid);
    
    const responseMessage = 'Thank you for your message. I\'ve received your recording and will process it shortly.';
    const twimlResponse = generateTwiML(responseMessage);

    res.type('text/xml');
    res.status(200).send(twimlResponse);
  } catch (error) {
    console.error('❌ Error processing recording completion:', error);
    
    const errorTwiML = generateTwiML('Sorry, there was an error processing your recording. Please try again.');
    res.type('text/xml');
    res.status(200).send(errorTwiML);
  }
});

// Enhanced endpoint for recording status updates
router.post('/recording-status', (req: Request, res: Response) => {
  try {
    const twilioParams: TwilioWebhookParams = req.body;

    const statusInfo = {
      callSid: twilioParams.CallSid,
      recordingSid: twilioParams.RecordingSid,
      recordingStatus: twilioParams.CallStatus,
      timestamp: new Date().toISOString()
    };

    console.log('📊 Recording Status Update:', statusInfo);

    res.status(200).json({
      success: true,
      message: 'Recording status processed',
      timestamp: statusInfo.timestamp
    });
  } catch (error) {
    console.error('❌ Error processing recording status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced endpoint for audio streaming (WebSocket will be added in next subtask)
router.post('/audio-stream-start', (req: Request, res: Response) => {
  try {
    const twilioParams: TwilioWebhookParams = req.body;

    console.log('🎵 Audio Stream Started:', {
      callSid: twilioParams.CallSid,
      streamSid: twilioParams.StreamSid,
      timestamp: new Date().toISOString()
    });

    // Get the audio stream service instance
    const audioStreamService = AudioStreamService.getInstance();
    
    res.status(200).json({
      success: true,
      message: 'Audio stream initialized',
      streamSid: twilioParams.StreamSid,
      callSid: twilioParams.CallSid,
      activeSessions: audioStreamService.getActiveSessions().length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error initializing audio stream:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// New endpoint to get audio service status and statistics
router.get('/audio-status', (req: Request, res: Response) => {
  try {
    const audioStreamService = AudioStreamService.getInstance();
    const audioRecordingService = AudioRecordingService.getInstance();
    
    const activeSessions = audioStreamService.getActiveSessions();
    const recordingStats = audioRecordingService.getRecordingStats();
    
    res.json({
      success: true,
      audioServices: {
        streaming: {
          enabled: AUDIO_CONFIG.streamingEnabled,
          activeSessions: activeSessions.length,
          sessions: activeSessions.map(session => ({
            streamSid: session.streamSid,
            callSid: session.callSid,
            startTime: session.startTime,
            totalChunks: session.totalChunks
          }))
        },
        recording: {
          enabled: AUDIO_CONFIG.recordingEnabled,
          statistics: recordingStats
        }
      },
      configuration: AUDIO_CONFIG,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting audio status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/user-input', async (req: Request, res: Response) => {
  try {
    const twilioParams: TwilioWebhookParams = req.body;

    const userInput = {
      callSid: twilioParams.CallSid,
      speechResult: twilioParams.SpeechResult,
      confidence: twilioParams.Confidence,
      digits: twilioParams.Digits,
      from: twilioParams.From,
      timestamp: new Date().toISOString()
    };

    console.log('🗣️ User Input Received:', userInput);

    let responseMessage = '';
    
    if (userInput.speechResult) {
      try {
        const inputProcessor = InputProcessor.getInstance();
        console.log('🧠 Processing speech with LLM...');
        
        const processedResponse = await inputProcessor.processTwilioSpeech(
          userInput.speechResult,
          userInput.callSid || '',
          userInput.from || ''
        );
        
        responseMessage = processedResponse.llmResponse;
        console.log('✅ LLM Response generated:', responseMessage.substring(0, 100) + '...');
        
      } catch (error) {
        console.error('❌ Error processing speech with LLM:', error);
        responseMessage = `I heard you say: ${userInput.speechResult}. I'm sorry, but I'm having trouble processing your request right now. Please try again or contact our support team.`;
      }
    } else if (userInput.digits) {
      responseMessage = `You pressed: ${userInput.digits}. Thank you for your input!`;
    } else {
      responseMessage = 'I didn\'t catch that. Let me transfer you to our customer service team.';
    }

    const twimlResponse = generateTwiML(responseMessage);
    
    console.log('🎵 User Input TwiML Response:', twimlResponse);

    res.type('text/xml');
    res.status(200).send(twimlResponse);
  } catch (error) {
    console.error('❌ Error processing user input:', error);
    
    const errorTwiML = generateTwiML('Sorry, there was an error processing your input. Please try again.');
    res.type('text/xml');
    res.status(200).send(errorTwiML);
  }
});

router.post('/call-status-update', (req: Request, res: Response) => {
  try {
    const twilioParams: TwilioWebhookParams = req.body;

    const statusUpdate = {
      callSid: twilioParams.CallSid,
      callStatus: twilioParams.CallStatus,
      from: twilioParams.From,
      to: twilioParams.To,
      timestamp: new Date().toISOString()
    };

    console.log('📱 Twilio Call Status Update:', statusUpdate);

    res.status(200).json({
      success: true,
      message: 'Status update processed',
      timestamp: statusUpdate.timestamp
    });
  } catch (error) {
    console.error('❌ Error processing call status update:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/voice-recording', (req: Request, res: Response) => {
  try {
    const twilioParams: TwilioWebhookParams = req.body;

    const recordingInfo = {
      callSid: twilioParams.CallSid,
      recordingSid: twilioParams.RecordingSid,
      recordingUrl: twilioParams.RecordingUrl,
      recordingDuration: twilioParams.RecordingDuration,
      timestamp: new Date().toISOString()
    };

    console.log('🎙️ Twilio Voice Recording:', recordingInfo);

    res.status(200).json({
      success: true,
      message: 'Recording processed',
      timestamp: recordingInfo.timestamp
    });
  } catch (error) {
    console.error('❌ Error processing voice recording:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// TTS-Enhanced Endpoints

// Enhanced incoming call with ElevenLabs TTS
router.post('/incoming-call-tts', async (req: Request, res: Response) => {
  try {
    const twilioParams: TwilioWebhookParams = req.body;
    const ttsService = IntegratedTTSService.getInstance();

    const callInfo = {
      callSid: twilioParams.CallSid,
      from: twilioParams.From,
      to: twilioParams.To,
      callStatus: twilioParams.CallStatus,
      direction: twilioParams.Direction,
      timestamp: new Date().toISOString()
    };

    console.log('📞 TTS-Enhanced Incoming Call:', callInfo);

    const welcomeMessage = `Hello! Welcome to our voice-enabled customer service. You're calling from ${callInfo.from || 'an unknown number'}.`;
    
    // Process with ElevenLabs TTS
    const ttsResponse = await ttsService.processSimpleTextToSpeech(
      welcomeMessage,
      '/api/twilio/user-input-tts'
    );

    if (ttsResponse.success) {
      console.log('✅ TTS processing successful');
      res.type('text/xml');
      res.status(200).send(ttsResponse.twiml);
    } else {
      console.warn('⚠️ TTS processing failed, using fallback');
      res.type('text/xml');
      res.status(200).send(ttsResponse.twiml);
    }

  } catch (error) {
    console.error('❌ Error processing TTS incoming call:', error);
    
    const fallbackTwiML = generateTwiML('Sorry, we are experiencing technical difficulties. Please try calling again later.');
    res.type('text/xml');
    res.status(200).send(fallbackTwiML);
  }
});

// Enhanced user input handler with TTS response
router.post('/user-input-tts', async (req: Request, res: Response) => {
  try {
    const twilioParams: TwilioWebhookParams = req.body;
    const ttsService = IntegratedTTSService.getInstance();

    const userInput = {
      callSid: twilioParams.CallSid,
      speechResult: twilioParams.SpeechResult,
      confidence: twilioParams.Confidence,
      digits: twilioParams.Digits,
      from: twilioParams.From,
      timestamp: new Date().toISOString()
    };

    console.log('🗣️ TTS-Enhanced User Input:', userInput);

    let responseMessage = '';
    
    if (userInput.speechResult) {
      try {
        const inputProcessor = InputProcessor.getInstance();
        console.log('🧠 Processing speech with LLM...');
        
        const processedResponse = await inputProcessor.processTwilioSpeech(
          userInput.speechResult,
          userInput.callSid || '',
          userInput.from || ''
        );
        
        responseMessage = processedResponse.llmResponse;
        console.log('✅ LLM Response generated for TTS');
        
      } catch (error) {
        console.error('❌ Error processing speech with LLM:', error);
        responseMessage = `I heard you say: ${userInput.speechResult}. I'm processing your request, please hold on.`;
      }
    } else if (userInput.digits) {
      responseMessage = `Thank you for pressing ${userInput.digits}. Let me help you with that.`;
    } else {
      responseMessage = 'I didn\'t catch that. Could you please repeat what you need help with?';
    }

    // Process response with ElevenLabs TTS
    const ttsResponse = await ttsService.processInteractiveTextToSpeech(
      responseMessage,
      {
        action: '/api/twilio/user-input-tts',
        method: 'POST',
        timeout: 10,
        input: 'dtmf speech',
        enhanced: true
      },
      responseMessage // Use same text as fallback
    );

    if (ttsResponse.success) {
      console.log('✅ TTS response processing successful');
      res.type('text/xml');
      res.status(200).send(ttsResponse.twiml);
    } else {
      console.warn('⚠️ TTS response processing failed, using fallback');
      res.type('text/xml');
      res.status(200).send(ttsResponse.twiml);
    }

  } catch (error) {
    console.error('❌ Error processing TTS user input:', error);
    
    const errorTwiML = generateTwiML('Sorry, there was an error processing your input. Please try again.');
    res.type('text/xml');
    res.status(200).send(errorTwiML);
  }
});

// TTS Service health check endpoint
router.get('/tts-status', async (req: Request, res: Response) => {
  try {
    const ttsService = IntegratedTTSService.getInstance();
    
    const healthCheck = await ttsService.healthCheck();
    const stats = ttsService.getStats();

    res.json({
      success: true,
      ttsIntegration: {
        health: healthCheck,
        statistics: stats,
        services: {
          elevenLabs: healthCheck.tts ? 'healthy' : 'unhealthy',
          audioProcessing: healthCheck.audio ? 'healthy' : 'unhealthy',
          twimlGeneration: healthCheck.twiml ? 'healthy' : 'unhealthy',
          overall: healthCheck.overall ? 'healthy' : 'unhealthy'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting TTS status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// TTS Service test endpoint
router.post('/tts-test', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const ttsService = IntegratedTTSService.getInstance();
    
    const testText = text || 'Hello! This is a test of the ElevenLabs text-to-speech integration.';
    
    console.log('🧪 Running TTS integration test...');
    const testResult = await ttsService.testIntegration(testText);

    res.json({
      success: testResult.success,
      testResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error running TTS test:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/status', (req: Request, res: Response) => {
  res.json({
    service: 'Twilio Webhook Service',
    status: 'active',
    endpoints: [
      '/incoming-call',
      '/incoming-call-tts',
      '/user-input',
      '/user-input-tts',
      '/call-status-update', 
      '/voice-recording',
      '/recording-complete',
      '/recording-status',
      '/audio-stream-start',
      '/audio-status',
      '/tts-status',
      '/tts-test',
      '/status'
    ],
    audioCapabilities: {
      streaming: 'configured (ready for WebSocket)',
      recording: 'configured',
      sttIntegration: 'pending (subtask 14.3)',
      ttsIntegration: 'configured (ElevenLabs)'
    },
    timestamp: new Date().toISOString()
  });
});

export default router; 