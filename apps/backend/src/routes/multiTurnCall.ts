import { Router, Request, Response } from 'express';
import { InputProcessorService } from '../services/inputProcessorService';
import { IntegratedTTSService } from '../services/integratedTTSService';
import { CallLoggingService } from '../services/callLoggingService';
import { ContextManagerService } from '../services/contextManagerService';

const router = Router();

interface MultiTurnCallParams {
  CallSid?: string;
  From?: string;
  To?: string;
  CallStatus?: string;
  SpeechResult?: string;
  Confidence?: string;
  RecordingUrl?: string;
  Digits?: string;
  ConversationId?: string;
}

interface ConversationState {
  conversationId: string;
  callSid: string;
  from: string;
  to: string;
  turnCount: number;
  context: any;
  lastActivity: Date;
  isActive: boolean;
}

// In-memory conversation state management (in production, use Redis or database)
const activeConversations = new Map<string, ConversationState>();

// Generate TwiML for multi-turn conversation
function generateMultiTurnTwiML(
  message: string, 
  conversationId: string,
  isFirstTurn: boolean = false
): string {
  const action = `/api/multi-turn/gather-callback?conversationId=${conversationId}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="8" action="${action}" method="POST">
    <Say voice="alice">${message}</Say>
  </Gather>
  <Say voice="alice">I didn't hear anything. Is there anything else I can help you with?</Say>
  <Gather input="speech" timeout="5" action="${action}" method="POST">
    <Say voice="alice">Please let me know if you need any assistance.</Say>
  </Gather>
  <Say voice="alice">Thank you for calling. Have a great day!</Say>
  <Hangup/>
</Response>`;
}

// Generate conversation ID
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Task 21: Multi-Turn Conversation - Initial Call Handler
router.post('/incoming-call', async (req: Request, res: Response) => {
  try {
    const callParams: MultiTurnCallParams = req.body;
    const callLoggingService = CallLoggingService.getInstance();
    const contextManager = ContextManagerService.getInstance();
    
    console.log('📞 Multi-Turn Call Started:', {
      callSid: callParams.CallSid,
      from: callParams.From,
      to: callParams.To,
      timestamp: new Date().toISOString()
    });

    // Start call logging
    if (callParams.CallSid && callParams.From && callParams.To) {
      await callLoggingService.startCall(
        callParams.CallSid,
        callParams.From,
        callParams.To,
        'inbound'
      );
    }

    // Create new conversation state
    const conversationId = generateConversationId();
    const conversationState: ConversationState = {
      conversationId,
      callSid: callParams.CallSid || '',
      from: callParams.From || '',
      to: callParams.To || '',
      turnCount: 0,
      context: {},
      lastActivity: new Date(),
      isActive: true
    };

    activeConversations.set(conversationId, conversationState);

    // Initialize conversation context
    if (callParams.From) {
      const initialContext = await contextManager.buildContext({
        userPhone: callParams.From
      });
      conversationState.context = initialContext;
    }

    console.log('🆕 Created conversation:', conversationId);

    const welcomeMessage = "Hello! I'm here to help you with your orders, products, and any questions you might have. What can I assist you with today?";
    const twimlResponse = generateMultiTurnTwiML(welcomeMessage, conversationId, true);

    res.type('text/xml');
    res.status(200).send(twimlResponse);
  } catch (error) {
    console.error('❌ Error in multi-turn incoming call:', error);
    
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, we are experiencing technical difficulties. Please try calling again later.</Say>
  <Hangup/>
</Response>`;
    
    res.type('text/xml');
    res.status(500).send(errorTwiML);
  }
});

// Task 21: Multi-Turn Conversation - Gather Callback Handler
router.post('/gather-callback', async (req: Request, res: Response) => {
  try {
    const callParams: MultiTurnCallParams = req.body;
    const conversationId = req.query.conversationId as string;
    const callLoggingService = CallLoggingService.getInstance();
    const contextManager = ContextManagerService.getInstance();
    const inputProcessor = InputProcessorService.getInstance();
    const ttsService = IntegratedTTSService.getInstance();
    
    console.log('🗣️ Multi-Turn Speech Gathered:', {
      conversationId,
      callSid: callParams.CallSid,
      speechResult: callParams.SpeechResult,
      confidence: callParams.Confidence
    });

    // Get conversation state
    const conversationState = activeConversations.get(conversationId);
    if (!conversationState) {
      console.error('❌ Conversation state not found:', conversationId);
      const errorTwiML = generateMultiTurnTwiML(
        "I'm sorry, I seem to have lost track of our conversation. Let me start fresh. How can I help you?",
        generateConversationId()
      );
      res.type('text/xml');
      res.send(errorTwiML);
      return;
    }

    // Update conversation state
    conversationState.turnCount++;
    conversationState.lastActivity = new Date();

    if (!callParams.SpeechResult) {
      console.log('❌ No speech result received');
      
      // Handle no speech - offer to continue or end
      if (conversationState.turnCount > 3) {
        // End conversation after multiple failed attempts
        conversationState.isActive = false;
        activeConversations.delete(conversationId);
        
        if (callParams.CallSid) {
          await callLoggingService.endCall(callParams.CallSid, 'completed');
        }
        
        const endTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. Have a great day!</Say>
  <Hangup/>
</Response>`;
        
        res.type('text/xml');
        res.send(endTwiML);
        return;
      }
      
      const noSpeechTwiML = generateMultiTurnTwiML(
        "I didn't catch that. Could you please repeat what you need help with?",
        conversationId
      );
      res.type('text/xml');
      res.send(noSpeechTwiML);
      return;
    }

    // Log transcription
    if (callParams.CallSid) {
      await callLoggingService.logTranscription(
        callParams.CallSid,
        callParams.SpeechResult,
        parseFloat(callParams.Confidence || '0')
      );
    }

    try {
      // Build conversation context with history
      const conversationHistory = conversationState.context.conversationHistory || [];
      
      // Add current user input to history
      conversationHistory.push({
        role: 'customer',
        content: callParams.SpeechResult,
        timestamp: new Date(),
        confidence: parseFloat(callParams.Confidence || '0')
      });

      // Update context with conversation history
      const updatedContext = await contextManager.buildContext({
        userPhone: conversationState.from
      });

      conversationState.context = updatedContext;

      // Process with LLM using conversation context
      console.log('🧠 Processing with LLM (multi-turn)...');
      const startTime = Date.now();
      
      const llmResponse = await inputProcessor.processConversationTurn(
        callParams.SpeechResult,
        updatedContext,
        callParams.CallSid || '',
        conversationState.from
      );
      
      const processingTime = Date.now() - startTime;

      // Add AI response to conversation history
      conversationHistory.push({
        role: 'ai',
        content: llmResponse.llmResponse,
        timestamp: new Date(),
        functionCalls: llmResponse.functionCalls
      });

      conversationState.context.conversationHistory = conversationHistory;

      console.log('✅ LLM generated multi-turn response:', llmResponse.llmResponse.substring(0, 100) + '...');

      // Log LLM interaction
      if (callParams.CallSid) {
        await callLoggingService.logLLMInteraction(
          callParams.CallSid,
          callParams.SpeechResult,
          llmResponse.llmResponse,
          'gpt-4',
          processingTime
        );
      }

      // Check if conversation should continue
      const shouldContinue = !llmResponse.llmResponse.toLowerCase().includes('goodbye') &&
                            !llmResponse.llmResponse.toLowerCase().includes('have a great day') &&
                            conversationState.turnCount < 10; // Max 10 turns

      if (!shouldContinue) {
        // End conversation
        conversationState.isActive = false;
        activeConversations.delete(conversationId);
        
        if (callParams.CallSid) {
          await callLoggingService.endCall(callParams.CallSid, 'completed');
        }
      }

      // Generate TTS response
      console.log('🎤 Processing response with TTS...');
      const ttsResponse = await ttsService.processSimpleTextToSpeech(
        shouldContinue 
          ? llmResponse.llmResponse + " Is there anything else I can help you with?"
          : llmResponse.llmResponse
      );

      if (ttsResponse.success) {
        console.log('✅ TTS processing successful');
        
        // Log TTS audio
        if (callParams.CallSid && ttsResponse.twiml.includes('<Play>')) {
          const urlMatch = ttsResponse.twiml.match(/<Play>([^<]+)<\/Play>/);
          if (urlMatch) {
            await callLoggingService.logTTSAudio(callParams.CallSid, urlMatch[1]);
          }
        }

        // Modify TwiML for multi-turn or end conversation
        let finalTwiML = ttsResponse.twiml;
        
        if (shouldContinue) {
          // Replace hangup with gather for next turn
          finalTwiML = finalTwiML.replace(
            /<Hangup\/>/g,
            `<Gather input="speech" timeout="8" action="/api/multi-turn/gather-callback?conversationId=${conversationId}" method="POST">
              <Say voice="alice">What else can I help you with?</Say>
            </Gather>
            <Say voice="alice">Thank you for calling. Have a great day!</Say>
            <Hangup/>`
          );
        }
        
        res.type('text/xml');
        res.status(200).send(finalTwiML);
        return;
      }

      // Fallback TTS
      console.warn('⚠️ TTS failed, using fallback');
      const responseMessage = shouldContinue 
        ? llmResponse.llmResponse + " Is there anything else I can help you with?"
        : llmResponse.llmResponse;
        
      const fallbackTwiML = shouldContinue
        ? generateMultiTurnTwiML(responseMessage, conversationId)
        : `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${responseMessage}</Say>
  <Hangup/>
</Response>`;
      
      res.type('text/xml');
      res.send(fallbackTwiML);

    } catch (error) {
      console.error('❌ Error processing multi-turn conversation:', error);
      
      // End conversation on error
      conversationState.isActive = false;
      activeConversations.delete(conversationId);
      
      if (callParams.CallSid) {
        await callLoggingService.endCall(callParams.CallSid, 'failed');
      }
      
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">I'm sorry, I'm having trouble processing your request right now. Thank you for calling.</Say>
  <Hangup/>
</Response>`;
      
      res.type('text/xml');
      res.send(errorTwiML);
    }

  } catch (error) {
    console.error('❌ Error in multi-turn gather callback:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get active conversations (for monitoring)
router.get('/conversations', (req: Request, res: Response) => {
  try {
    const conversations = Array.from(activeConversations.values()).map(conv => ({
      conversationId: conv.conversationId,
      callSid: conv.callSid,
      from: conv.from,
      turnCount: conv.turnCount,
      lastActivity: conv.lastActivity,
      isActive: conv.isActive
    }));

    res.json({
      success: true,
      conversations,
      count: conversations.length
    });
  } catch (error) {
    console.error('❌ Error getting conversations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// End conversation manually
router.post('/end-conversation', async (req: Request, res: Response) => {
  try {
    const { conversationId, callSid } = req.body;
    
    if (conversationId && activeConversations.has(conversationId)) {
      const conversation = activeConversations.get(conversationId)!;
      conversation.isActive = false;
      activeConversations.delete(conversationId);
      
      if (callSid) {
        const callLoggingService = CallLoggingService.getInstance();
        await callLoggingService.endCall(callSid, 'completed');
      }
      
      res.json({ success: true, message: 'Conversation ended' });
    } else {
      res.status(404).json({ success: false, error: 'Conversation not found' });
    }
  } catch (error) {
    console.error('❌ Error ending conversation:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 