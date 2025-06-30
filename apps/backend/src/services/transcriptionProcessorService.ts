import { DatabaseService } from './database';
import { LLMService } from './llmService';
import { InputProcessor } from './inputProcessor';

interface TranscriptionData {
  id: string;
  callSid: string;
  recordingSid?: string;
  streamSid?: string;
  type: 'recording' | 'streaming';
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
  provider: string;
  timestamp: Date;
  metadata?: {
    segments?: any[];
    words?: any[];
    processingTime?: number;
    chunkRange?: { start: number; end: number };
  };
  processed: boolean;
  processedAt?: Date;
  llmAnalysis?: {
    intent?: string;
    sentiment?: string;
    topics?: string[];
    summary?: string;
    suggestedResponse?: string;
  };
}

interface ConversationContext {
  callSid: string;
  customerPhone: string;
  transcriptions: TranscriptionData[];
  fullConversation: string;
  lastUpdated: Date;
  isActive: boolean;
  llmContext?: {
    conversationSummary?: string;
    customerIntent?: string;
    recommendedActions?: string[];
  };
}

interface ProcessingOptions {
  processWithLLM?: boolean;
  storeToDB?: boolean;
  updateConversation?: boolean;
  notifyListeners?: boolean;
}

export class TranscriptionProcessorService {
  private static instance: TranscriptionProcessorService;
  private dbService: DatabaseService;
  private llmService: LLMService;
  private inputProcessor: InputProcessor;
  
  private conversations: Map<string, ConversationContext> = new Map();
  private transcriptions: Map<string, TranscriptionData> = new Map();
  private listeners: Set<(transcription: TranscriptionData) => void> = new Set();

  private constructor() {
    this.dbService = DatabaseService.getInstance();
    this.llmService = LLMService.getInstance();
    this.inputProcessor = InputProcessor.getInstance();
  }

  public static getInstance(): TranscriptionProcessorService {
    if (!TranscriptionProcessorService.instance) {
      TranscriptionProcessorService.instance = new TranscriptionProcessorService();
    }
    return TranscriptionProcessorService.instance;
  }

  /**
   * Process a transcription result from recording completion
   */
  public async processRecordingTranscription(
    callSid: string,
    recordingSid: string,
    transcriptionResult: any,
    customerPhone: string,
    options: ProcessingOptions = {}
  ): Promise<TranscriptionData> {
    const transcription: TranscriptionData = {
      id: `rec_${recordingSid}_${Date.now()}`,
      callSid,
      recordingSid,
      type: 'recording',
      text: transcriptionResult.text,
      confidence: transcriptionResult.confidence,
      language: transcriptionResult.language,
      duration: transcriptionResult.duration,
      provider: transcriptionResult.provider,
      timestamp: new Date(),
      metadata: transcriptionResult.metadata,
      processed: false
    };

    console.log(`📝 Processing recording transcription for call ${callSid}:`);
    console.log(`   Text: "${transcription.text.substring(0, 100)}${transcription.text.length > 100 ? '...' : ''}"`);

    return await this.processTranscription(transcription, customerPhone, options);
  }

  /**
   * Process a transcription result from streaming audio
   */
  public async processStreamingTranscription(
    callSid: string,
    streamSid: string,
    transcriptionResult: any,
    customerPhone: string,
    chunkRange?: { start: number; end: number },
    options: ProcessingOptions = {}
  ): Promise<TranscriptionData> {
    const transcription: TranscriptionData = {
      id: `stream_${streamSid}_${Date.now()}`,
      callSid,
      streamSid,
      type: 'streaming',
      text: transcriptionResult.text,
      confidence: transcriptionResult.confidence,
      language: transcriptionResult.language,
      duration: transcriptionResult.duration,
      provider: transcriptionResult.provider,
      timestamp: new Date(),
      metadata: {
        ...transcriptionResult.metadata,
        chunkRange
      },
      processed: false
    };

    console.log(`🎙️ Processing streaming transcription for call ${callSid}:`);
    console.log(`   Text: "${transcription.text}"`);

    return await this.processTranscription(transcription, customerPhone, options);
  }

  /**
   * Core transcription processing logic
   */
  private async processTranscription(
    transcription: TranscriptionData,
    customerPhone: string,
    options: ProcessingOptions
  ): Promise<TranscriptionData> {
    const defaultOptions: ProcessingOptions = {
      processWithLLM: true,
      storeToDB: true,
      updateConversation: true,
      notifyListeners: true,
      ...options
    };

    try {
      // Store transcription
      this.transcriptions.set(transcription.id, transcription);

      // Update or create conversation context
      if (defaultOptions.updateConversation) {
        await this.updateConversationContext(transcription, customerPhone);
      }

      // Process with LLM for analysis
      if (defaultOptions.processWithLLM && this.llmService.isInitialized()) {
        await this.processWithLLM(transcription);
      }

      // Store in database
      if (defaultOptions.storeToDB) {
        await this.storeTranscriptionInDB(transcription);
      }

      // Notify listeners
      if (defaultOptions.notifyListeners) {
        this.notifyListeners(transcription);
      }

      transcription.processed = true;
      transcription.processedAt = new Date();

      console.log(`✅ Transcription ${transcription.id} processed successfully`);
      return transcription;

    } catch (error) {
      console.error(`❌ Error processing transcription ${transcription.id}:`, error);
      throw error;
    }
  }

  /**
   * Update conversation context with new transcription
   */
  private async updateConversationContext(
    transcription: TranscriptionData,
    customerPhone: string
  ): Promise<void> {
    let conversation = this.conversations.get(transcription.callSid);

    if (!conversation) {
      conversation = {
        callSid: transcription.callSid,
        customerPhone,
        transcriptions: [],
        fullConversation: '',
        lastUpdated: new Date(),
        isActive: true
      };
      this.conversations.set(transcription.callSid, conversation);
      console.log(`📞 Created new conversation context for call ${transcription.callSid}`);
    }

    // Add transcription to conversation
    conversation.transcriptions.push(transcription);
    conversation.lastUpdated = new Date();

    // Update full conversation text
    conversation.fullConversation = conversation.transcriptions
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(t => t.text)
      .join(' ')
      .trim();

    console.log(`📝 Updated conversation context for call ${transcription.callSid} (${conversation.transcriptions.length} segments)`);
  }

  /**
   * Process transcription with LLM for analysis
   */
  private async processWithLLM(transcription: TranscriptionData): Promise<void> {
    try {
      console.log(`🤖 Processing transcription with LLM...`);

      const conversation = this.conversations.get(transcription.callSid);
      const conversationContext = conversation ? conversation.fullConversation : transcription.text;

      // Use InputProcessor for LLM analysis
      const analysisPrompt = `
Analyze this customer service transcription:

Customer message: "${transcription.text}"
Full conversation context: "${conversationContext}"

Please provide:
1. Customer intent (what they want)
2. Sentiment (positive, neutral, negative)
3. Key topics mentioned
4. Brief summary
5. Suggested response approach

Format as JSON with keys: intent, sentiment, topics, summary, suggestedResponse
`;

      const analysis = await this.inputProcessor.processInput({ type: 'api-text', content: analysisPrompt });

      // Parse the analysis (assuming it returns structured data)
      try {
        const parsedAnalysis = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
        transcription.llmAnalysis = parsedAnalysis;
        
        console.log(`✅ LLM analysis completed:`, {
          intent: parsedAnalysis.intent,
          sentiment: parsedAnalysis.sentiment,
          topics: parsedAnalysis.topics
        });

      } catch (parseError) {
        // If parsing fails, store as basic text analysis
        transcription.llmAnalysis = {
          summary: analysis?.toString() || 'Analysis failed',
          intent: 'unknown',
          sentiment: 'neutral'
        };
        console.warn('⚠️ LLM analysis parsing failed, stored as text');
      }

    } catch (error) {
      console.error('❌ LLM analysis failed:', error);
      transcription.llmAnalysis = {
        summary: 'Analysis failed due to error',
        intent: 'unknown',
        sentiment: 'neutral'
      };
    }
  }

  /**
   * Store transcription in database
   */
  private async storeTranscriptionInDB(transcription: TranscriptionData): Promise<void> {
    try {
      // Check if database is connected
      const isConnected = await this.dbService.testConnection();
      if (!isConnected) {
        console.warn('⚠️ Database not connected, skipping transcription storage');
        return;
      }

      // TODO: Implement actual database storage based on your schema
      // This would typically involve inserting into a conversations or transcriptions table
      console.log(`💾 Storing transcription ${transcription.id} in database (TODO: implement schema)`);
      
      // Example structure for future implementation:
      /*
      await this.dbService.query(`
        INSERT INTO transcriptions (
          id, call_sid, recording_sid, stream_sid, type, text, 
          confidence, language, duration, provider, timestamp, 
          metadata, llm_analysis
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        transcription.id, transcription.callSid, transcription.recordingSid,
        transcription.streamSid, transcription.type, transcription.text,
        transcription.confidence, transcription.language, transcription.duration,
        transcription.provider, transcription.timestamp, 
        JSON.stringify(transcription.metadata), JSON.stringify(transcription.llmAnalysis)
      ]);
      */

    } catch (error) {
      console.error('❌ Database storage failed:', error);
      throw error;
    }
  }

  /**
   * Add a listener for transcription processing events
   */
  public addTranscriptionListener(listener: (transcription: TranscriptionData) => void): void {
    this.listeners.add(listener);
    console.log(`📡 Added transcription listener (${this.listeners.size} total)`);
  }

  /**
   * Remove a transcription listener
   */
  public removeTranscriptionListener(listener: (transcription: TranscriptionData) => void): void {
    this.listeners.delete(listener);
    console.log(`📡 Removed transcription listener (${this.listeners.size} total)`);
  }

  /**
   * Notify all listeners of a new transcription
   */
  private notifyListeners(transcription: TranscriptionData): void {
    this.listeners.forEach(listener => {
      try {
        listener(transcription);
      } catch (error) {
        console.error('❌ Error in transcription listener:', error);
      }
    });
  }

  /**
   * Get transcription by ID
   */
  public getTranscription(id: string): TranscriptionData | undefined {
    return this.transcriptions.get(id);
  }

  /**
   * Get all transcriptions for a call
   */
  public getCallTranscriptions(callSid: string): TranscriptionData[] {
    return Array.from(this.transcriptions.values()).filter(
      t => t.callSid === callSid
    );
  }

  /**
   * Get conversation context
   */
  public getConversationContext(callSid: string): ConversationContext | undefined {
    return this.conversations.get(callSid);
  }

  /**
   * Get full conversation text
   */
  public getFullConversation(callSid: string): string | undefined {
    const conversation = this.conversations.get(callSid);
    return conversation?.fullConversation;
  }

  /**
   * Mark conversation as completed
   */
  public completeConversation(callSid: string): void {
    const conversation = this.conversations.get(callSid);
    if (conversation) {
      conversation.isActive = false;
      conversation.lastUpdated = new Date();
      console.log(`✅ Marked conversation ${callSid} as completed`);
    }
  }

  /**
   * Get processing statistics
   */
  public getProcessingStats(): {
    totalTranscriptions: number;
    activeConversations: number;
    completedConversations: number;
    averageProcessingTime: number;
    listeners: number;
  } {
    const transcriptions = Array.from(this.transcriptions.values());
    const conversations = Array.from(this.conversations.values());

    const processedTranscriptions = transcriptions.filter(t => t.processed && t.processedAt);
    const avgProcessingTime = processedTranscriptions.length > 0
      ? processedTranscriptions.reduce((sum, t) => {
          const processingTime = t.processedAt!.getTime() - t.timestamp.getTime();
          return sum + processingTime;
        }, 0) / processedTranscriptions.length
      : 0;

    return {
      totalTranscriptions: transcriptions.length,
      activeConversations: conversations.filter(c => c.isActive).length,
      completedConversations: conversations.filter(c => !c.isActive).length,
      averageProcessingTime: avgProcessingTime,
      listeners: this.listeners.size
    };
  }

  /**
   * Clean up old transcriptions and conversations
   */
  public cleanup(olderThanHours: number = 24): void {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    let deletedTranscriptions = 0;
    let deletedConversations = 0;

    // Clean up old transcriptions
    for (const [id, transcription] of this.transcriptions.entries()) {
      if (transcription.timestamp.getTime() < cutoffTime) {
        this.transcriptions.delete(id);
        deletedTranscriptions++;
      }
    }

    // Clean up old conversations
    for (const [callSid, conversation] of this.conversations.entries()) {
      if (!conversation.isActive && conversation.lastUpdated.getTime() < cutoffTime) {
        this.conversations.delete(callSid);
        deletedConversations++;
      }
    }

    if (deletedTranscriptions > 0 || deletedConversations > 0) {
      console.log(`🧹 Cleanup completed: ${deletedTranscriptions} transcriptions, ${deletedConversations} conversations`);
    }
  }
} 