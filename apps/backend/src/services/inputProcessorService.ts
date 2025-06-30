import { LLMService } from './llmService';
import { PromptManager } from '../config/prompts';

export interface InputSource {
  type: 'twilio-speech' | 'twilio-dtmf' | 'api-text' | 'chat';
  content: string;
  metadata?: {
    callSid?: string;
    from?: string;
    to?: string;
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

export class InputProcessorService {
  private static instance: InputProcessorService;
  private llmService: LLMService;
  private promptManager: PromptManager;

  private constructor() {
    this.llmService = LLMService.getInstance();
    this.promptManager = PromptManager.getInstance();
  }

  public static getInstance(): InputProcessorService {
    if (!InputProcessorService.instance) {
      InputProcessorService.instance = new InputProcessorService();
    }
    return InputProcessorService.instance;
  }

  public async processInput(input: InputSource): Promise<ProcessedResponse> {
    const startTime = Date.now();
    
    console.log('🎯 Processing input from source:', input.type);
    console.log('📝 Input content:', input.content);
    
    try {
      if (!this.llmService.isInitialized()) {
        throw new Error('LLM Service not initialized');
      }

      const selectedPromptId = this.selectPrompt(input);
      console.log('🎨 Selected prompt:', selectedPromptId);
      
      const prompt = this.promptManager.getPrompt(selectedPromptId);
      if (!prompt) {
        throw new Error(`Invalid prompt ID: ${selectedPromptId}`);
      }

      // Check if we should use function calling for data-driven queries
      const shouldUseFunctionCalling = this.shouldUseFunctionCalling(input.content);
      let rawResponse: any;
      let llmResponse: string;

      if (shouldUseFunctionCalling) {
        console.log('🔧 Using LLM with function calling capabilities');
        const functionResponse = await this.llmService.generateResponseWithFunctions(
          input.content,
          prompt.systemPrompt,
          {
            userPhone: input.metadata?.from
          }
        );
        rawResponse = functionResponse;
        llmResponse = functionResponse.content;
      } else {
        console.log('💬 Using standard LLM response');
        rawResponse = await this.llmService.callLLM(prompt.systemPrompt, input.content);
        llmResponse = this.extractResponseText(rawResponse);
      }
      
      const processingTime = Date.now() - startTime;
      
      const processedResponse: ProcessedResponse = {
        originalInput: input,
        selectedPromptId,
        llmResponse,
        rawLLMResponse: rawResponse,
        processingTime,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Input processing completed successfully');
      console.log('⏱️ Processing time:', processingTime, 'ms');
      console.log('💬 Generated response:', llmResponse);

      return processedResponse;
    } catch (error) {
      console.error('❌ Error processing input:', error);
      throw new Error(`Input processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private shouldUseFunctionCalling(content: string): boolean {
    const lowerContent = content.toLowerCase();
    
    // Use function calling for specific data queries
    const functionTriggers = [
      'order', 'delivery', 'shipping', 'track', 'tracking', 'status',
      'product', 'item', 'price', 'cost', 'available', 'stock',
      'when will', 'where is', 'order number', 'order #'
    ];
    
    return functionTriggers.some(trigger => lowerContent.includes(trigger));
  }

  private selectPrompt(input: InputSource): string {
    const content = input.content.toLowerCase().trim();
    const wordCount = content.split(' ').length;

    // Input type-based selection
    if (input.type === 'twilio-speech' || input.type === 'twilio-dtmf') {
      // For Twilio calls, prioritize customer service
      if (this.isGreeting(content)) {
        return 'FRIENDLY_GREETING';
      } else if (this.isOrderInquiry(content)) {
        return 'ORDER_INQUIRY_SPECIALIST';
      } else if (this.isProductQuestion(content)) {
        return 'PRODUCT_EXPERT';
      } else {
        return 'CUSTOMER_SERVICE_ASSISTANT';
      }
    }

    // Content-based selection for other input types
    if (this.isGreeting(content)) {
      return 'FRIENDLY_GREETING';
    } else if (wordCount <= 3) {
      return 'SIMPLE_ACKNOWLEDGMENT';
    } else if (this.isOrderInquiry(content)) {
      return 'ORDER_INQUIRY_SPECIALIST';
    } else if (this.isProductQuestion(content)) {
      return 'PRODUCT_EXPERT';
    } else {
      return 'CUSTOMER_SERVICE_ASSISTANT';
    }
  }

  private isGreeting(content: string): boolean {
    const greetingWords = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    return greetingWords.some(word => content.includes(word));
  }

  private isOrderInquiry(content: string): boolean {
    const orderWords = ['order', 'delivery', 'shipping', 'track', 'tracking', 'status', 'when will', 'where is'];
    return orderWords.some(word => content.includes(word));
  }

  private isProductQuestion(content: string): boolean {
    const productWords = ['product', 'item', 'price', 'cost', 'features', 'specs', 'available', 'stock', 'size', 'color'];
    return productWords.some(word => content.includes(word));
  }

  private extractResponseText(rawResponse: any): string {
    try {
      if (rawResponse?.choices?.[0]?.message?.content) {
        return rawResponse.choices[0].message.content.trim();
      } else {
        console.warn('⚠️ Unexpected response format, returning fallback');
        return 'I apologize, but I encountered an issue processing your request. Please try again.';
      }
    } catch (error) {
      console.error('❌ Error extracting response text:', error);
      return 'I apologize, but I encountered an issue processing your request. Please try again.';
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
    confidence: string,
    callSid: string,
    from: string
  ): Promise<ProcessedResponse> {
    const input: InputSource = {
      type: 'twilio-speech',
      content: speechResult,
      metadata: {
        callSid,
        from,
        confidence
      }
    };
    return this.processInput(input);
  }

  public async processTwilioDTMF(
    digits: string,
    callSid: string,
    from: string
  ): Promise<ProcessedResponse> {
    const input: InputSource = {
      type: 'twilio-dtmf',
      content: `User pressed: ${digits}`,
      metadata: {
        callSid,
        from,
        digits
      }
    };
    return this.processInput(input);
  }

  public async processConversationTurn(
    userInput: string,
    conversationContext: any,
    callSid: string,
    from: string
  ): Promise<ProcessedResponse & { functionCalls?: any[] }> {
    const startTime = Date.now();
    
    console.log('🔄 Processing conversation turn:', userInput);
    console.log('📚 Context available:', !!conversationContext);
    
    try {
      if (!this.llmService.isInitialized()) {
        throw new Error('LLM Service not initialized');
      }

      // Build conversation-aware prompt
      const conversationHistory = conversationContext?.conversationHistory || [];
      const customerData = conversationContext?.customerData || {};
      
      // Create a conversation-aware system prompt
      const conversationPrompt = this.buildConversationPrompt(conversationHistory, customerData);
      
      console.log('🧠 Using conversation-aware prompt');

      // Always use function calling for multi-turn conversations to access data
      const functionResponse = await this.llmService.generateResponseWithFunctions(
        userInput,
        conversationPrompt,
        {
          userPhone: from
        }
      );

      const processingTime = Date.now() - startTime;
      
      const processedResponse: ProcessedResponse & { functionCalls?: any[] } = {
        originalInput: {
          type: 'twilio-speech',
          content: userInput,
          metadata: { callSid, from }
        },
        selectedPromptId: 'CONVERSATION_TURN',
        llmResponse: functionResponse.content,
        rawLLMResponse: functionResponse,
        processingTime,
        timestamp: new Date().toISOString(),
        functionCalls: functionResponse.functionCalls
      };

      console.log('✅ Conversation turn processing completed');
      console.log('⏱️ Processing time:', processingTime, 'ms');
      console.log('🔧 Function calls made:', functionResponse.functionCalls?.length || 0);

      return processedResponse;
    } catch (error) {
      console.error('❌ Error processing conversation turn:', error);
      throw new Error(`Conversation turn processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildConversationPrompt(conversationHistory: any[], customerData: any): string {
    const basePrompt = `You are a helpful customer service assistant for an e-commerce store. You have access to order and product information through function calls.

CONVERSATION CONTEXT:
${conversationHistory.length > 0 ? 
  'Previous conversation:\n' + 
  conversationHistory.slice(-3).map((msg: any, idx: number) => 
    `${idx + 1}. ${msg.role === 'customer' ? 'Customer' : 'Assistant'}: ${msg.content}`
  ).join('\n') + '\n'
  : 'This is the start of the conversation.\n'}

${customerData?.orders?.length > 0 ? 
  `Customer has ${customerData.orders.length} recent order(s).\n` : ''}

GUIDELINES:
- Be conversational and maintain context from previous messages
- Use function calls to look up specific order or product information when needed
- If the customer asks about orders, use getOrderStatus function
- If the customer asks about products, use getProductInfo function
- Keep responses concise but helpful
- If you need to look up information, tell the customer you're checking their details
- Remember what was discussed earlier in the conversation

Respond naturally to the customer's current message while maintaining conversation flow.`;

    return basePrompt;
  }

  public getAvailablePrompts(): Array<{id: string; name: string; category: string}> {
    return this.promptManager.getAllPrompts().map(prompt => ({
      id: prompt.id,
      name: prompt.name,
      category: prompt.category
    }));
  }
} 