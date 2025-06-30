import { DatabaseService } from './database';

export interface CallLogEntry {
  callSid: string;
  from: string;
  to: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'in-progress' | 'completed' | 'failed' | 'no-answer' | 'busy';
  direction: 'inbound' | 'outbound';
  transcription?: string;
  confidence?: number;
  llmInputs: LLMInteraction[];
  llmOutputs: LLMInteraction[];
  ttsAudioUrls: string[];
  metadata?: Record<string, any>;
}

export interface LLMInteraction {
  timestamp: Date;
  input: string;
  output: string;
  model?: string;
  processingTime?: number;
}

export interface ConversationEntry {
  conversationId: string;
  callSid: string;
  storeId?: string;
  messages: ConversationMessage[];
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'escalated' | 'abandoned';
  customerInfo?: {
    phone: string;
    name?: string;
    email?: string;
  };
}

export interface ConversationMessage {
  timestamp: Date;
  role: 'customer' | 'ai' | 'system';
  content: string;
  type: 'speech' | 'text' | 'system';
  confidence?: number;
  metadata?: Record<string, any>;
}

export class CallLoggingService {
  private static instance: CallLoggingService;
  private dbService: DatabaseService;
  private activeCalls: Map<string, CallLogEntry> = new Map();

  private constructor() {
    this.dbService = DatabaseService.getInstance();
  }

  public static getInstance(): CallLoggingService {
    if (!CallLoggingService.instance) {
      CallLoggingService.instance = new CallLoggingService();
    }
    return CallLoggingService.instance;
  }

  /**
   * Start logging a new call
   */
  public async startCall(callSid: string, from: string, to: string, direction: 'inbound' | 'outbound'): Promise<void> {
    const callEntry: CallLogEntry = {
      callSid,
      from,
      to,
      startTime: new Date(),
      status: 'in-progress',
      direction,
      llmInputs: [],
      llmOutputs: [],
      ttsAudioUrls: []
    };

    this.activeCalls.set(callSid, callEntry);

    try {
      // Store initial call record in database
      const query = `
        INSERT INTO calls (
          call_sid, caller_phone, called_phone, direction, start_time, 
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (call_sid) DO UPDATE SET
          start_time = $5,
          status = $6,
          updated_at = NOW()
      `;
      
      await this.dbService.query(query, [
        callSid,
        from,
        to,
        direction,
        callEntry.startTime,
        callEntry.status
      ]);

      console.log(`📞 Call logging started for ${callSid}`);
    } catch (error) {
      console.error('❌ Error starting call log:', error);
    }
  }

  /**
   * Log transcription from STT
   */
  public async logTranscription(callSid: string, transcription: string, confidence?: number): Promise<void> {
    const callEntry = this.activeCalls.get(callSid);
    if (callEntry) {
      callEntry.transcription = transcription;
      callEntry.confidence = confidence;
    }

    try {
      // Update call record with transcription
      const query = `
        UPDATE calls 
        SET transcription = $2, transcription_confidence = $3, updated_at = NOW()
        WHERE call_sid = $1
      `;
      
      await this.dbService.query(query, [callSid, transcription, confidence]);

      console.log(`🗣️ Transcription logged for call ${callSid}`);
    } catch (error) {
      console.error('❌ Error logging transcription:', error);
    }
  }

  /**
   * Log LLM interaction
   */
  public async logLLMInteraction(
    callSid: string, 
    input: string, 
    output: string, 
    model?: string, 
    processingTime?: number
  ): Promise<void> {
    const interaction: LLMInteraction = {
      timestamp: new Date(),
      input,
      output,
      model,
      processingTime
    };

    const callEntry = this.activeCalls.get(callSid);
    if (callEntry) {
      callEntry.llmInputs.push({ ...interaction, output: '' });
      callEntry.llmOutputs.push({ ...interaction, input: '' });
    }

    try {
      // Store LLM interaction in database
      const query = `
        UPDATE calls 
        SET 
          ai_input = $2,
          ai_response = $3,
          ai_model = $4,
          ai_processing_time = $5,
          updated_at = NOW()
        WHERE call_sid = $1
      `;
      
      await this.dbService.query(query, [callSid, input, output, model, processingTime]);

      console.log(`🧠 LLM interaction logged for call ${callSid}`);
    } catch (error) {
      console.error('❌ Error logging LLM interaction:', error);
    }
  }

  /**
   * Log TTS audio URL
   */
  public async logTTSAudio(callSid: string, audioUrl: string): Promise<void> {
    const callEntry = this.activeCalls.get(callSid);
    if (callEntry) {
      callEntry.ttsAudioUrls.push(audioUrl);
    }

    try {
      // Update call record with TTS audio URL
      const query = `
        UPDATE calls 
        SET tts_audio_url = $2, updated_at = NOW()
        WHERE call_sid = $1
      `;
      
      await this.dbService.query(query, [callSid, audioUrl]);

      console.log(`🎤 TTS audio logged for call ${callSid}`);
    } catch (error) {
      console.error('❌ Error logging TTS audio:', error);
    }
  }

  /**
   * End call logging
   */
  public async endCall(callSid: string, status: 'completed' | 'failed' | 'no-answer' | 'busy', duration?: number): Promise<void> {
    const callEntry = this.activeCalls.get(callSid);
    if (callEntry) {
      callEntry.endTime = new Date();
      callEntry.status = status;
      callEntry.duration = duration || this.calculateDuration(callEntry.startTime, callEntry.endTime);
    }

    try {
      // Update final call record
      const query = `
        UPDATE calls 
        SET 
          end_time = $2,
          duration = $3,
          status = $4,
          updated_at = NOW()
        WHERE call_sid = $1
      `;
      
      await this.dbService.query(query, [
        callSid,
        callEntry?.endTime || new Date(),
        callEntry?.duration || 0,
        status
      ]);

      console.log(`📞 Call logging ended for ${callSid} with status: ${status}`);
    } catch (error) {
      console.error('❌ Error ending call log:', error);
    }

    // Remove from active calls
    this.activeCalls.delete(callSid);
  }

  /**
   * Get call log by Call SID
   */
  public async getCallLog(callSid: string): Promise<CallLogEntry | null> {
    try {
      const query = `
        SELECT 
          call_sid, caller_phone, called_phone, direction, start_time, end_time,
          duration, status, transcription, transcription_confidence,
          ai_input, ai_response, ai_model, ai_processing_time, tts_audio_url,
          created_at, updated_at
        FROM calls 
        WHERE call_sid = $1
      `;
      
      const result = await this.dbService.query(query, [callSid]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        callSid: row.call_sid,
        from: row.caller_phone,
        to: row.called_phone,
        direction: row.direction,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        status: row.status,
        transcription: row.transcription,
        confidence: row.transcription_confidence,
        llmInputs: row.ai_input ? [{ 
          timestamp: row.updated_at, 
          input: row.ai_input, 
          output: '', 
          model: row.ai_model,
          processingTime: row.ai_processing_time 
        }] : [],
        llmOutputs: row.ai_response ? [{ 
          timestamp: row.updated_at, 
          input: '', 
          output: row.ai_response, 
          model: row.ai_model,
          processingTime: row.ai_processing_time 
        }] : [],
        ttsAudioUrls: row.tts_audio_url ? [row.tts_audio_url] : []
      };
    } catch (error) {
      console.error('❌ Error getting call log:', error);
      return null;
    }
  }

  /**
   * Get recent call logs
   */
  public async getRecentCallLogs(limit: number = 50): Promise<CallLogEntry[]> {
    try {
      const query = `
        SELECT 
          call_sid, caller_phone, called_phone, direction, start_time, end_time,
          duration, status, transcription, transcription_confidence,
          ai_input, ai_response, ai_model, ai_processing_time, tts_audio_url,
          created_at, updated_at
        FROM calls 
        ORDER BY start_time DESC 
        LIMIT $1
      `;
      
      const result = await this.dbService.query(query, [limit]);
      
      return result.rows.map(row => ({
        callSid: row.call_sid,
        from: row.caller_phone,
        to: row.called_phone,
        direction: row.direction,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        status: row.status,
        transcription: row.transcription,
        confidence: row.transcription_confidence,
        llmInputs: row.ai_input ? [{ 
          timestamp: row.updated_at, 
          input: row.ai_input, 
          output: '', 
          model: row.ai_model,
          processingTime: row.ai_processing_time 
        }] : [],
        llmOutputs: row.ai_response ? [{ 
          timestamp: row.updated_at, 
          input: '', 
          output: row.ai_response, 
          model: row.ai_model,
          processingTime: row.ai_processing_time 
        }] : [],
        ttsAudioUrls: row.tts_audio_url ? [row.tts_audio_url] : []
      }));
    } catch (error) {
      console.error('❌ Error getting recent call logs:', error);
      return [];
    }
  }

  /**
   * Get active calls
   */
  public getActiveCalls(): CallLogEntry[] {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Calculate call duration in seconds
   */
  private calculateDuration(startTime: Date, endTime: Date): number {
    return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  }

  /**
   * Get call statistics
   */
  public async getCallStats(): Promise<{
    totalCalls: number;
    averageDuration: number;
    successfulCalls: number;
    failedCalls: number;
    activeCalls: number;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_calls,
          AVG(duration) as avg_duration,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_calls,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls
        FROM calls
      `;
      
      const result = await this.dbService.query(query);
      const row = result.rows[0];
      
      return {
        totalCalls: parseInt(row.total_calls) || 0,
        averageDuration: parseFloat(row.avg_duration) || 0,
        successfulCalls: parseInt(row.successful_calls) || 0,
        failedCalls: parseInt(row.failed_calls) || 0,
        activeCalls: this.activeCalls.size
      };
    } catch (error) {
      console.error('❌ Error getting call stats:', error);
      return {
        totalCalls: 0,
        averageDuration: 0,
        successfulCalls: 0,
        failedCalls: 0,
        activeCalls: this.activeCalls.size
      };
    }
  }
} 