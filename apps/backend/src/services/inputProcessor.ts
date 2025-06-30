import { LLMService } from './llmService';
import { PromptManager } from '../config/prompts';

export interface InputSource {
  type: 'twilio-speech' | 'twilio-dtmf' | 'api-text' | 'chat';
  content: string;
  metadata?: {
    callSid?: string;
    from?: string;
    confidence?: string;
    [key: string]: any;
  };
}

export interface ProcessedResponse {
  originalInput: InputSource;
  selectedPromptId: string;
  llmResponse: string;
  rawLLMResponse: any;
  processingTime: number;
  timestamp: string;
}

export class InputProcessor {
  private static instance: InputProcessor;
  private llmService: LLMService;
  private promptManager: PromptManager;

  private constructor() {
    this.llmService = LLMService.getInstance();
    this.promptManager = PromptManager.getInstance();
  }

  public static getInstance(): InputProcessor {
    if (!InputProcessor.instance) {
      InputProcessor.instance = new InputProcessor();
    }
    return InputProcessor.instance;
  }

  public async processInput(input: InputSource): Promise<ProcessedResponse> {
    const startTime = Date.now();
    
    console.log('🎯 Processing input from source:', input.type);
    console.log('📝 Input content:', input.content);
    
    if (!this.llmService.isInitialized()) {
      throw new Error('LLM Service not initialized');
    }

    const selectedPromptId = this.selectPrompt(input);
    console.log('🎨 Selected prompt:', selectedPromptId);
    
    const prompt = this.promptManager.getPrompt(selectedPromptId);
    if (!prompt) {
      throw new Error(`Invalid prompt ID: ${selectedPromptId}`);
    }

    const rawResponse = await this.llmService.callLLM(prompt.systemPrompt, input.content);
    const llmResponse = this.extractResponseText(rawResponse);
    
    const processingTime = Date.now() - startTime;
    
    const processedResponse: ProcessedResponse = {
      originalInput: input,
      selectedPromptId,
      llmResponse,
      rawLLMResponse: rawResponse,
      processingTime,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Input processing completed');
    console.log('⏱️ Processing time:', processingTime, 'ms');

    return processedResponse;
  }

  private selectPrompt(input: InputSource): string {
    const content = input.content.toLowerCase().trim();
    const wordCount = content.split(' ').length;

    if (input.type === 'twilio-speech' || input.type === 'twilio-dtmf') {
      if (this.isGreeting(content)) {
        return 'FRIENDLY_GREETING';
      } else {
        return 'CUSTOMER_SERVICE_ASSISTANT';
      }
    }

    if (this.isGreeting(content)) {
      return 'FRIENDLY_GREETING';
    } else if (wordCount <= 3) {
      return 'SIMPLE_ACKNOWLEDGMENT';
    } else {
      return 'CUSTOMER_SERVICE_ASSISTANT';
    }
  }

  private isGreeting(content: string): boolean {
    const greetingWords = ['hello', 'hi', 'hey', 'good morning', 'good afternoon'];
    return greetingWords.some(word => content.includes(word));
  }

  private extractResponseText(rawResponse: any): string {
    console.log('🔍 Extracting LLM response text...');
    console.log('📋 Raw response structure:', JSON.stringify(rawResponse, null, 2));
    
    try {
      // Handle OpenAI GPT response format
      if (rawResponse?.choices?.[0]?.message?.content) {
        const extractedText = rawResponse.choices[0].message.content.trim();
        console.log('✅ Successfully extracted text from OpenAI response');
        console.log('📝 Extracted text length:', extractedText.length, 'characters');
        console.log('📄 Extracted text preview:', extractedText.substring(0, 100) + (extractedText.length > 100 ? '...' : ''));
        
        // Log to file for debugging
        this.logExtractedText(extractedText, rawResponse);
        
        return extractedText;
      }
      
      // Handle Claude response format
      if (rawResponse?.content?.[0]?.text) {
        const extractedText = rawResponse.content[0].text.trim();
        console.log('✅ Successfully extracted text from Claude response');
        console.log('📝 Extracted text length:', extractedText.length, 'characters');
        console.log('📄 Extracted text preview:', extractedText.substring(0, 100) + (extractedText.length > 100 ? '...' : ''));
        
        // Log to file for debugging
        this.logExtractedText(extractedText, rawResponse);
        
        return extractedText;
      }
      
      // Handle other potential response formats
      if (rawResponse?.text) {
        const extractedText = rawResponse.text.trim();
        console.log('✅ Successfully extracted text from generic response format');
        console.log('📝 Extracted text length:', extractedText.length, 'characters');
        
        // Log to file for debugging
        this.logExtractedText(extractedText, rawResponse);
        
        return extractedText;
      }
      
      console.warn('⚠️ No recognizable text content found in LLM response');
      console.warn('📋 Available response keys:', Object.keys(rawResponse || {}));
      
      return 'I apologize, but I encountered an issue processing the response. Please try again.';
      
    } catch (error) {
      console.error('❌ Error extracting response text:', error);
      console.error('📋 Raw response that caused error:', rawResponse);
      
      return 'I apologize, but I encountered an issue. Please try again.';
    }
  }

  private logExtractedText(extractedText: string, rawResponse: any): void {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        extractedText,
        textLength: extractedText.length,
        responseModel: rawResponse?.model || 'unknown',
        responseId: rawResponse?.id || 'unknown',
        responseCreated: rawResponse?.created || 'unknown',
        usage: rawResponse?.usage || null
      };
      
      console.log('📊 Text extraction metrics:', {
        textLength: logEntry.textLength,
        model: logEntry.responseModel,
        usage: logEntry.usage
      });
      
      // In production, you might want to save this to a file or database
      // For now, we'll just log it to console for debugging
      
    } catch (error) {
      console.error('❌ Error logging extracted text:', error);
    }
  }

  public async processTextInput(text: string): Promise<ProcessedResponse> {
    const input: InputSource = {
      type: 'api-text',
      content: text
    };
    return this.processInput(input);
  }

  public async processTwilioSpeech(
    speechResult: string, 
    callSid: string,
    from: string
  ): Promise<ProcessedResponse> {
    const input: InputSource = {
      type: 'twilio-speech',
      content: speechResult,
      metadata: { callSid, from }
    };
    return this.processInput(input);
  }
} 