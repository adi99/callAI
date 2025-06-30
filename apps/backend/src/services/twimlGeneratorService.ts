import twilio from 'twilio';
import { AudioFile } from './audioProcessingService';

export interface TwiMLResponse {
  xml: string;
  contentType: string;
}

export interface PlayAudioOptions {
  audioUrl: string;
  loop?: number;
  digits?: string; // DTMF digits to accept during playback
}

export interface GatherOptions {
  action?: string;
  method?: 'GET' | 'POST';
  timeout?: number;
  finishOnKey?: string;
  numDigits?: number;
  input?: 'dtmf' | 'speech' | 'dtmf speech';
  speechTimeout?: number;
  speechModel?: string;
  enhanced?: boolean;
  partialResultCallback?: string;
  language?: string;
}

export interface SayOptions {
  voice?: 'man' | 'woman' | 'alice';
  language?: string;
  loop?: number;
}

export interface RedirectOptions {
  url: string;
  method?: 'GET' | 'POST';
}

export interface RecordOptions {
  action?: string;
  method?: 'GET' | 'POST';
  timeout?: number;
  finishOnKey?: string;
  maxLength?: number;
  transcribe?: boolean;
  transcribeCallback?: string;
  playBeep?: boolean;
}

export class TwiMLGeneratorService {
  private static instance: TwiMLGeneratorService;

  public static getInstance(): TwiMLGeneratorService {
    if (!TwiMLGeneratorService.instance) {
      TwiMLGeneratorService.instance = new TwiMLGeneratorService();
    }
    return TwiMLGeneratorService.instance;
  }

  // Generate TwiML to play audio from TTS
  public generatePlayAudio(audioFile: AudioFile, options: Partial<PlayAudioOptions> = {}): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();
    
    const play = twiml.play({
      loop: options.loop || 1,
      digits: options.digits
    }, audioFile.url);

    console.log(`[TwiML] Generated play audio TwiML for: ${audioFile.filename}`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Generate TwiML to play audio with URL
  public generatePlayAudioUrl(audioUrl: string, options: Partial<PlayAudioOptions> = {}): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.play({
      loop: options.loop || 1,
      digits: options.digits
    }, audioUrl);

    console.log(`[TwiML] Generated play audio URL TwiML for: ${audioUrl}`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Generate TwiML to say text with Twilio's built-in TTS
  public generateSay(text: string, options: Partial<SayOptions> = {}): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.say({
      voice: options.voice || 'alice',
      language: (options.language || 'en-US') as any,
      loop: options.loop || 1
    }, text);

    console.log(`[TwiML] Generated say TwiML for text: "${text.substring(0, 50)}..."`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Generate TwiML to gather user input (DTMF or speech)
  public generateGather(options: GatherOptions = {}, nestedContent?: string): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();
    
    const gather = twiml.gather({
      action: options.action,
      method: options.method || 'POST',
      timeout: options.timeout || 5,
      finishOnKey: options.finishOnKey || '#',
      numDigits: options.numDigits,
      input: (options.input || 'dtmf') as any,
      speechTimeout: (options.speechTimeout || 'auto').toString(),
      speechModel: options.speechModel || 'default',
      enhanced: options.enhanced || false,
      partialResultCallback: options.partialResultCallback,
      language: (options.language || 'en-US') as any
    });

    // Add nested content if provided (like Say or Play within Gather)
    if (nestedContent) {
      gather.addText(nestedContent);
    }

    console.log(`[TwiML] Generated gather TwiML with action: ${options.action || 'none'}`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Generate TwiML to gather input with audio prompt
  public generateGatherWithAudio(audioFile: AudioFile, gatherOptions: GatherOptions = {}): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();
    
    const gather = twiml.gather({
      action: gatherOptions.action,
      method: gatherOptions.method || 'POST',
      timeout: gatherOptions.timeout || 5,
      finishOnKey: gatherOptions.finishOnKey || '#',
      numDigits: gatherOptions.numDigits || 1,
      input: (gatherOptions.input?.split(' ') || ['dtmf', 'speech']) as any,
      speechTimeout: (gatherOptions.speechTimeout || 'auto').toString(),
      speechModel: gatherOptions.speechModel || 'default',
      enhanced: gatherOptions.enhanced || false,
      language: gatherOptions.language as any || 'en-US'
    });

    gather.play(audioFile.url);

    // Fallback if no input received
    twiml.say('I didn\'t receive any input. Please try again.');
    twiml.redirect(gatherOptions.action || '/api/twilio/voice');

    console.log(`[TwiML] Generated gather with audio TwiML for: ${audioFile.filename}`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Generate TwiML to gather input with text prompt
  public generateGatherWithText(promptText: string, gatherOptions: GatherOptions = {}): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();
    
    const gather = twiml.gather({
      action: gatherOptions.action,
      method: gatherOptions.method || 'POST',
      timeout: gatherOptions.timeout || 5,
      finishOnKey: gatherOptions.finishOnKey || '#',
      numDigits: gatherOptions.numDigits || 1,
      input: (gatherOptions.input?.split(' ') || ['dtmf', 'speech']) as any,
      speechTimeout: (gatherOptions.speechTimeout || 'auto').toString(),
      speechModel: gatherOptions.speechModel || 'default',
      enhanced: gatherOptions.enhanced || false,
      language: gatherOptions.language as any || 'en-US'
    });

    gather.say({
      voice: 'alice',
      language: 'en-US'
    }, promptText);

    // Fallback if no input received
    twiml.say('I didn\'t receive any input. Please try again.');
    twiml.redirect(gatherOptions.action || '/api/twilio/voice');

    console.log(`[TwiML] Generated gather with text TwiML: "${promptText.substring(0, 50)}..."`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Generate TwiML to record audio
  public generateRecord(options: RecordOptions = {}): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.record({
      action: options.action,
      method: options.method || 'POST',
      timeout: options.timeout || 5,
      finishOnKey: options.finishOnKey || '#',
      maxLength: options.maxLength || 300,
      transcribe: options.transcribe || false,
      transcribeCallback: options.transcribeCallback,
      playBeep: options.playBeep !== false
    });

    console.log(`[TwiML] Generated record TwiML with action: ${options.action || 'none'}`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Generate TwiML to redirect to another URL
  public generateRedirect(options: RedirectOptions): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.redirect({
      method: options.method || 'POST'
    }, options.url);

    console.log(`[TwiML] Generated redirect TwiML to: ${options.url}`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Generate TwiML to hang up the call
  public generateHangup(message?: string): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();
    
    if (message) {
      twiml.say({
        voice: 'alice',
        language: 'en-US'
      }, message);
    }
    
    twiml.hangup();

    console.log(`[TwiML] Generated hangup TwiML${message ? ' with message' : ''}`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Generate TwiML to pause execution
  public generatePause(length?: number): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.pause({
      length: length || 1
    });

    console.log(`[TwiML] Generated pause TwiML for ${length || 1} seconds`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Generate complex TwiML response with multiple elements
  public generateComplexResponse(actions: Array<{
    type: 'play' | 'say' | 'gather' | 'record' | 'pause' | 'redirect' | 'hangup';
    data: any;
    options?: any;
  }>): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();

    for (const action of actions) {
      switch (action.type) {
        case 'play':
          twiml.play(action.options || {}, action.data);
          break;
        case 'say':
          twiml.say(action.options || { voice: 'alice' }, action.data);
          break;
        case 'gather':
          const gather = twiml.gather(action.options || {});
          if (action.data) {
            gather.addText(action.data);
          }
          break;
        case 'record':
          twiml.record(action.options || {});
          break;
        case 'pause':
          twiml.pause({ length: action.data || 1 });
          break;
        case 'redirect':
          twiml.redirect(action.options || {}, action.data);
          break;
        case 'hangup':
          if (action.data) {
            twiml.say({ voice: 'alice' }, action.data);
          }
          twiml.hangup();
          break;
      }
    }

    console.log(`[TwiML] Generated complex TwiML response with ${actions.length} actions`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Generate TwiML for customer service conversation flow
  public generateCustomerServiceFlow(audioFile: AudioFile, nextAction?: string): TwiMLResponse {
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Play the TTS response
    twiml.play(audioFile.url);
    
    // Gather customer response
    const gather = twiml.gather({
      action: nextAction || '/api/twilio/voice/gather',
      method: 'POST',
      timeout: 5,
      finishOnKey: '#',
      input: ['dtmf', 'speech'] as any,
      speechTimeout: 'auto',
      speechModel: 'default',
      enhanced: true,
      language: 'en-US'
    });

    // Brief pause for natural conversation flow
    gather.pause({ length: 1 });
    
    // Fallback if no response
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, "I'm sorry, I didn't hear anything. Let me try again.");
    
    twiml.redirect(nextAction || '/api/twilio/voice');

    console.log(`[TwiML] Generated customer service flow TwiML for: ${audioFile.filename}`);

    return {
      xml: twiml.toString(),
      contentType: 'text/xml'
    };
  }

  // Validate TwiML content
  public validateTwiML(twimlXml: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Basic XML validation
      if (!twimlXml.includes('<Response>')) {
        errors.push('TwiML must contain a <Response> element');
      }

      if (!twimlXml.includes('</Response>')) {
        errors.push('TwiML <Response> element must be properly closed');
      }

      // Check for common TwiML verbs
      const validVerbs = ['Say', 'Play', 'Gather', 'Record', 'Dial', 'Hangup', 'Redirect', 'Pause', 'Reject'];
      const hasValidVerb = validVerbs.some(verb => 
        twimlXml.includes(`<${verb}`) || twimlXml.includes(`<${verb.toLowerCase()}`)
      );

      if (!hasValidVerb && !twimlXml.includes('<Response></Response>') && !twimlXml.includes('<Response/>')) {
        errors.push('TwiML should contain at least one valid verb or be an empty response');
      }

    } catch (error) {
      errors.push(`TwiML validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get TwiML content type headers
  public getTwiMLHeaders(): Record<string, string> {
    return {
      'Content-Type': 'text/xml',
      'Cache-Control': 'no-cache'
    };
  }
} 