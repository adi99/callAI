import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { PromptManager, PromptTemplate } from '../config/prompts';
import { LLMFunctionService, LLMFunction, FunctionCallResult } from './llmFunctionService';

type Provider = 'openai' | 'gemini';

interface LLMResponse {
  content: string;
  model: string;
  provider: Provider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  functionCalls?: FunctionCallResult[];
}

interface LLMConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

interface ProviderConfig {
  openai?: {
    apiKey: string;
    model: string;
  };
  gemini?: {
    apiKey: string;
    model: string;
  };
  maxTokens: number;
  temperature: number;
}

export class LLMService {
  private static instance: LLMService;
  private openai: OpenAI | null = null;
  private gemini: GoogleGenAI | null = null;
  private config: LLMConfig | null = null;
  private availableProviders: Provider[] = [];
  private functionService: LLMFunctionService;

  private constructor() {
    this.functionService = LLMFunctionService.getInstance();
  }

  public static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  public initialize(providerConfig: ProviderConfig): void {
    try {
      this.availableProviders = [];
      
      if (providerConfig.openai?.apiKey) {
        try {
          this.openai = new OpenAI({
            apiKey: providerConfig.openai.apiKey,
          });
          this.availableProviders.push('openai');
          console.log('✅ OpenAI provider initialized successfully');
        } catch (error) {
          console.warn('⚠️ Failed to initialize OpenAI provider:', error);
        }
      }

      if (providerConfig.gemini?.apiKey) {
        try {
          this.gemini = new GoogleGenAI({
            apiKey: providerConfig.gemini.apiKey,
          });
          this.availableProviders.push('gemini');
          console.log('✅ Gemini provider initialized successfully');
        } catch (error) {
          console.warn('⚠️ Failed to initialize Gemini provider:', error);
        }
      }

      if (this.availableProviders.length === 0) {
        throw new Error('No LLM providers could be initialized. Please check your API keys.');
      }

      const primaryProvider = this.availableProviders[0];
      const primaryConfig = primaryProvider === 'openai' 
        ? providerConfig.openai! 
        : providerConfig.gemini!;

      this.config = {
        provider: primaryProvider,
        apiKey: primaryConfig.apiKey,
        model: primaryConfig.model,
        maxTokens: providerConfig.maxTokens,
        temperature: providerConfig.temperature
      };

      console.log(`✅ LLM Service initialized with ${this.availableProviders.length} provider(s)`);
      console.log(`📊 Primary: ${primaryProvider}, Model: ${primaryConfig.model}`);
      console.log(`📊 Available providers: ${this.availableProviders.join(', ')}`);
    } catch (error) {
      console.error('❌ Failed to initialize LLM Service:', error);
      throw new Error('LLM Service initialization failed');
    }
  }

  public async validateConnection(provider?: Provider): Promise<boolean> {
    const targetProvider = provider || this.config?.provider;
    
    if (!targetProvider) {
      return false;
    }

    try {
      if (targetProvider === 'openai' && this.openai) {
        const response = await this.openai.models.list();
        const hasGPTModels = response.data.some(model => 
          model.id.includes('gpt') || model.id.includes('chat')
        );
        console.log('🔗 OpenAI API connection validated successfully');
        return hasGPTModels;
      }
      
      if (targetProvider === 'gemini' && this.gemini) {
        const testResponse = await this.gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: 'Test connection',
        });
        console.log('🔗 Gemini API connection validated successfully');
        return !!testResponse.text;
      }

      return false;
    } catch (error) {
      console.error(`❌ ${targetProvider.toUpperCase()} API connection validation failed:`, error);
      return false;
    }
  }

  public async generateResponse(
    userInput: string, 
    systemPrompt: string = 'You are a helpful customer service assistant.'
  ): Promise<LLMResponse> {
    if (!this.config) {
      throw new Error('LLM Service not initialized');
    }

    for (const provider of this.availableProviders) {
      try {
        console.log(`🤖 Attempting response generation with ${provider.toUpperCase()}...`);
        
        if (provider === 'openai' && this.openai) {
          return await this.generateOpenAIResponse(userInput, systemPrompt);
        }
        
        if (provider === 'gemini' && this.gemini) {
          return await this.generateGeminiResponse(userInput, systemPrompt);
        }
      } catch (error) {
        console.warn(`⚠️ ${provider.toUpperCase()} failed, trying next provider:`, error);
        continue;
      }
    }

    throw new Error('All LLM providers failed to generate response');
  }

  public async generateResponseWithFunctions(
    userInput: string,
    systemPrompt: string = 'You are a helpful customer service assistant.',
    context?: { storeId?: string; userPhone?: string; userEmail?: string }
  ): Promise<LLMResponse> {
    if (!this.config) {
      throw new Error('LLM Service not initialized');
    }

    // Only OpenAI supports function calling for now
    if (this.config.provider === 'openai' && this.openai) {
      return await this.generateOpenAIResponseWithFunctions(userInput, systemPrompt, context);
    }

    // Fallback to regular response for other providers
    return await this.generateResponse(userInput, systemPrompt);
  }

  private async generateOpenAIResponse(
    userInput: string, 
    systemPrompt: string
  ): Promise<LLMResponse> {
    if (!this.openai || !this.config) {
      throw new Error('OpenAI not available');
    }

    console.log('🤖 Generating OpenAI response...');
    console.log('📝 System Prompt:', systemPrompt);
    console.log('💬 User Input:', userInput);

    const completion = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    const content = completion.choices[0]?.message?.content || '';
    
    const response: LLMResponse = {
      content,
      model: this.config.model,
      provider: 'openai',
      usage: completion.usage ? {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens
      } : undefined
    };

    console.log('✅ OpenAI response generated successfully');
    console.log('📊 Usage:', response.usage);

    return response;
  }

  private async generateOpenAIResponseWithFunctions(
    userInput: string,
    systemPrompt: string,
    context?: { storeId?: string; userPhone?: string; userEmail?: string }
  ): Promise<LLMResponse> {
    if (!this.openai || !this.config) {
      throw new Error('OpenAI not available');
    }

    console.log('🤖 Generating OpenAI response with function calling...');
    console.log('📝 System Prompt:', systemPrompt);
    console.log('💬 User Input:', userInput);

    const availableFunctions = this.functionService.getAvailableFunctions();
    const tools = availableFunctions.map(func => ({
      type: 'function' as const,
      function: {
        name: func.name,
        description: func.description,
        parameters: func.parameters
      }
    }));

    const completion = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined
    });

    const choice = completion.choices[0];
    let content = choice?.message?.content || '';
    const functionCalls: FunctionCallResult[] = [];

    // Handle function calls
    if (choice?.message?.tool_calls) {
      console.log(`🔧 Processing ${choice.message.tool_calls.length} function call(s)...`);
      
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type === 'function') {
          const functionName = toolCall.function.name;
          const parameters = JSON.parse(toolCall.function.arguments);
          
          console.log(`📞 Calling function: ${functionName}`, parameters);
          
          const result = await this.functionService.executeFunction(
            functionName,
            parameters
          );
          
          functionCalls.push(result);
          
          if (result.success) {
            console.log(`✅ Function ${functionName} executed successfully`);
          } else {
            console.warn(`⚠️ Function ${functionName} failed:`, result.error);
          }
        }
      }

      // If we have function results, make a follow-up call to get the final response
      if (functionCalls.length > 0) {
        const followUpCompletion = await this.openai.chat.completions.create({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userInput },
            { role: 'assistant', content: choice.message.content || '', tool_calls: choice.message.tool_calls },
            ...choice.message.tool_calls.map((toolCall, index) => ({
              role: 'tool' as const,
              content: JSON.stringify(functionCalls[index].data || functionCalls[index].error),
              tool_call_id: toolCall.id
            }))
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        });

        content = followUpCompletion.choices[0]?.message?.content || content;
      }
    }

    const response: LLMResponse = {
      content,
      model: this.config.model,
      provider: 'openai',
      usage: completion.usage ? {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens
      } : undefined,
      functionCalls
    };

    console.log('✅ OpenAI response with functions generated successfully');
    return response;
  }

  private async generateGeminiResponse(
    userInput: string, 
    systemPrompt: string
  ): Promise<LLMResponse> {
    if (!this.gemini || !this.config) {
      throw new Error('Gemini not available');
    }

    console.log('🤖 Generating Gemini response...');
    console.log('📝 System Prompt:', systemPrompt);
    console.log('💬 User Input:', userInput);

    const model = this.config.provider === 'gemini' ? this.config.model : 'gemini-2.5-flash';
    
    const result = await this.gemini.models.generateContent({
      model,
      contents: `${systemPrompt}\n\nUser: ${userInput}`,
      config: {
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }
    });

    const content = result.text || '';
    
    const response: LLMResponse = {
      content,
      model,
      provider: 'gemini'
    };

    console.log('✅ Gemini response generated successfully');
    console.log('📊 Usage:', response.usage);

    return response;
  }

  public async testBasicFunctionality(): Promise<boolean> {
    try {
      const testResponse = await this.generateResponse(
        'Hello, this is a test message. Please respond with a simple greeting.',
        'You are a friendly assistant. Respond with a brief, polite greeting.'
      );

      return testResponse.content.length > 0;
    } catch (error) {
      console.error('❌ LLM basic functionality test failed:', error);
      return false;
    }
  }

  public getConfig(): LLMConfig | null {
    return this.config;
  }

  public getAvailableProviders(): Provider[] {
    return [...this.availableProviders];
  }

  public isInitialized(): boolean {
    return this.availableProviders.length > 0 && this.config !== null;
  }

  public async generateResponseWithPrompt(
    userInput: string,
    promptId: string
  ): Promise<LLMResponse> {
    const promptManager = PromptManager.getInstance();
    const prompt = promptManager.getPrompt(promptId);
    
    if (!prompt) {
      throw new Error(`Invalid prompt ID: ${promptId}`);
    }

    console.log(`🎯 Using static prompt: ${prompt.name} (${prompt.category})`);
    return this.generateResponse(userInput, prompt.systemPrompt);
  }

  public getAvailablePrompts(): PromptTemplate[] {
    const promptManager = PromptManager.getInstance();
    return promptManager.getAllPrompts();
  }

  public getPromptsByCategory(category: PromptTemplate['category']): PromptTemplate[] {
    const promptManager = PromptManager.getInstance();
    return promptManager.getPromptsByCategory(category);
  }

  public validatePromptId(promptId: string): boolean {
    const promptManager = PromptManager.getInstance();
    return promptManager.validatePromptId(promptId);
  }

  public async callLLM(promptTemplate: string, inputText: string): Promise<any> {
    if (!this.config) {
      throw new Error('LLM Service not initialized');
    }

    console.log('🔧 Core LLM API Call Function');
    console.log('📋 Prompt Template:', promptTemplate);
    console.log('📝 Input Text:', inputText);

    for (const provider of this.availableProviders) {
      try {
        if (provider === 'openai' && this.openai) {
          return await this.callOpenAI(promptTemplate, inputText);
        }
        
        if (provider === 'gemini' && this.gemini) {
          return await this.callGemini(promptTemplate, inputText);
        }
      } catch (error) {
        console.warn(`⚠️ ${provider.toUpperCase()} core call failed, trying next provider:`, error);
        continue;
      }
    }

    throw new Error('All LLM providers failed for core API call');
  }

  private async callOpenAI(promptTemplate: string, inputText: string): Promise<any> {
    if (!this.openai || !this.config) {
      throw new Error('OpenAI not available');
    }

    const completion = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: promptTemplate },
        { role: 'user', content: inputText }
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    console.log('✅ OpenAI core API call completed successfully');
    return completion;
  }

  private async callGemini(promptTemplate: string, inputText: string): Promise<any> {
    if (!this.gemini || !this.config) {
      throw new Error('Gemini not available');
    }

    const model = this.config.provider === 'gemini' ? this.config.model : 'gemini-2.5-flash';
    
    const result = await this.gemini.models.generateContent({
      model,
      contents: `${promptTemplate}\n\nUser: ${inputText}`,
      config: {
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }
    });

    console.log('✅ Gemini core API call completed successfully');
    return {
      choices: [{
        message: {
          content: result.text
        }
      }],
      model
    };
  }
} 