import { Router, Request, Response } from 'express';
import { InputProcessorService } from '../services/inputProcessorService';
import { IntegratedTTSService } from '../services/integratedTTSService';
import { CallLoggingService } from '../services/callLoggingService';

const router = Router();

interface SingleTurnCallParams {
  CallSid?: string;
  From?: string;
  To?: string;
  CallStatus?: string;
  SpeechResult?: string;
  Confidence?: string;
  RecordingUrl?: string;
  Digits?: string;
}

// Simple TwiML generation for single-turn flow
function generateSimpleTwiML(message: string, includeGather: boolean = false): string {
  if (includeGather) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="5" action="/api/single-turn/gather-callback" method="POST">
    <Say voice="alice">${message}</Say>
  </Gather>
  <Say voice="alice">Sorry, I didn't hear anything. Goodbye!</Say>
  <Hangup/>
</Response>`;
  } else {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${message}</Say>
  <Hangup/>
</Response>`;
  }
}

// Subtask 17.1: Configure Twilio Webhook and Initial TwiML
router.post('/incoming-call', async (req: Request, res: Response) => {
  try {
    const callParams: SingleTurnCallParams = req.body;
    const callLoggingService = CallLoggingService.getInstance();
    
    console.log('📞 Single-Turn Call Started:', {
      callSid: callParams.CallSid,
      from: callParams.From,
      to: callParams.To,
      timestamp: new Date().toISOString()
    });

    // Task 18: Start call logging
    if (callParams.CallSid && callParams.From && callParams.To) {
      await callLoggingService.startCall(
        callParams.CallSid,
        callParams.From,
        callParams.To,
        'inbound'
      );
      console.log('📝 Call logging started for:', callParams.CallSid);
    }

    const welcomeMessage = "Hello! I'm here to help you. Please tell me what you need assistance with.";
    const twimlResponse = generateSimpleTwiML(welcomeMessage, true);

    console.log('🎵 Generated TwiML for speech gathering:', twimlResponse);

    res.type('text/xml');
    res.status(200).send(twimlResponse);
  } catch (error) {
    console.error('❌ Error in single-turn incoming call:', error);
    
    const errorTwiML = generateSimpleTwiML('Sorry, we are experiencing technical difficulties. Please try calling again later.');
    res.type('text/xml');
    res.status(500).send(errorTwiML);
  }
});

// Subtask 17.2: Handle Gather Callback and Integrate STT
// Subtask 17.3: Integrate LLM with Static Prompt  
// Subtask 17.4: Integrate TTS and Generate Audio
// Subtask 17.5: Generate TwiML to Play Audio and Hang Up
router.post('/gather-callback', async (req: Request, res: Response) => {
  try {
    const callParams: SingleTurnCallParams = req.body;
    const callLoggingService = CallLoggingService.getInstance();
    
    console.log('🗣️ Speech gathered from user:', {
      callSid: callParams.CallSid,
      speechResult: callParams.SpeechResult,
      confidence: callParams.Confidence,
      timestamp: new Date().toISOString()
    });

    let responseMessage = '';
    let ttsAudioUrl = '';

    // Subtask 17.2: Handle STT (using Twilio's built-in STT via SpeechResult)
    if (callParams.SpeechResult) {
      console.log('🎯 Processing transcribed speech:', callParams.SpeechResult);
      
      // Task 18: Log transcription
      if (callParams.CallSid) {
        await callLoggingService.logTranscription(
          callParams.CallSid,
          callParams.SpeechResult,
          parseFloat(callParams.Confidence || '0')
        );
        console.log('📝 Transcription logged for:', callParams.CallSid);
      }
      
      try {
        // Subtask 17.3: Integrate LLM with Static Prompt
        const inputProcessor = InputProcessorService.getInstance();
        console.log('🧠 Sending to LLM for processing...');
        
        const startTime = Date.now();
        const llmResponse = await inputProcessor.processTwilioSpeech(
          callParams.SpeechResult,
          callParams.Confidence || '0',
          callParams.CallSid || '',
          callParams.From || ''
        );
        const processingTime = Date.now() - startTime;
        
        responseMessage = llmResponse.llmResponse;
        console.log('✅ LLM generated response:', responseMessage.substring(0, 100) + '...');

        // Task 18: Log LLM interaction
        if (callParams.CallSid) {
          await callLoggingService.logLLMInteraction(
            callParams.CallSid,
            callParams.SpeechResult,
            responseMessage,
            'gpt-4', // or get from llmResponse if available
            processingTime
          );
          console.log('📝 LLM interaction logged for:', callParams.CallSid);
        }

        // Subtask 17.4: Integrate TTS and Generate Audio
        console.log('🎤 Processing response with TTS...');
        const ttsService = IntegratedTTSService.getInstance();
        
        const ttsResponse = await ttsService.processSimpleTextToSpeech(responseMessage);
        
        if (ttsResponse.success) {
          console.log('✅ TTS processing successful');
          
          // Task 18: Log TTS audio (extract URL from TwiML if available)
          if (callParams.CallSid && ttsResponse.twiml.includes('<Play>')) {
            const urlMatch = ttsResponse.twiml.match(/<Play>([^<]+)<\/Play>/);
            if (urlMatch) {
              ttsAudioUrl = urlMatch[1];
              await callLoggingService.logTTSAudio(callParams.CallSid, ttsAudioUrl);
              console.log('📝 TTS audio logged for:', callParams.CallSid);
            }
          }
          
          // Task 18: End call logging
          if (callParams.CallSid) {
            await callLoggingService.endCall(callParams.CallSid, 'completed');
            console.log('📝 Call logging ended for:', callParams.CallSid);
          }
          
          // Subtask 17.5: Generate TwiML to Play Audio and Hang Up
          res.type('text/xml');
          res.status(200).send(ttsResponse.twiml);
          return;
        } else {
          console.warn('⚠️ TTS failed, using fallback text-to-speech');
        }
        
      } catch (error) {
        console.error('❌ Error processing speech with LLM/TTS:', error);
        responseMessage = `I heard you say: "${callParams.SpeechResult}". Thank you for calling. I'm having trouble processing your request right now, but I've noted your inquiry.`;
        
        // Task 18: End call with failed status
        if (callParams.CallSid) {
          await callLoggingService.endCall(callParams.CallSid, 'failed');
          console.log('📝 Call logging ended with failure for:', callParams.CallSid);
        }
      }
    } else {
      console.log('❌ No speech result received');
      responseMessage = "I didn't catch what you said. Thank you for calling, please try again.";
      
      // Task 18: End call with failed status
      if (callParams.CallSid) {
        await callLoggingService.endCall(callParams.CallSid, 'failed');
        console.log('📝 Call logging ended (no speech) for:', callParams.CallSid);
      }
    }

    // Fallback: Use simple TwiML with Twilio's built-in TTS
    console.log('📢 Using fallback TwiML response');
    const fallbackTwiML = generateSimpleTwiML(responseMessage);
    
    res.type('text/xml');
    res.status(200).send(fallbackTwiML);

  } catch (error) {
    console.error('❌ Error in gather callback:', error);
    
    // Task 18: End call with failed status
    if (req.body.CallSid) {
      try {
        const callLoggingService = CallLoggingService.getInstance();
        await callLoggingService.endCall(req.body.CallSid, 'failed');
        console.log('📝 Call logging ended with error for:', req.body.CallSid);
      } catch (logError) {
        console.error('❌ Error ending call log:', logError);
      }
    }
    
    const errorTwiML = generateSimpleTwiML('Sorry, there was an error processing your request. Thank you for calling.');
    res.type('text/xml');
    res.status(500).send(errorTwiML);
  }
});

// Health check endpoint
router.get('/status', (req: Request, res: Response) => {
  res.json({
    service: 'Single-Turn Call Flow',
    status: 'active',
    endpoints: [
      '/incoming-call',
      '/gather-callback',
      '/status'
    ],
    description: 'Simplified single-turn call flow: Twilio -> STT -> LLM -> TTS -> Response',
    timestamp: new Date().toISOString()
  });
});

export default router;
