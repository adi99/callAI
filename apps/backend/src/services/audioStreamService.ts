import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { SpeechToTextService } from './speechToTextService';
import { TranscriptionProcessorService } from './transcriptionProcessorService';

interface TwilioMediaMessage {
  event: 'connected' | 'start' | 'media' | 'stop';
  sequenceNumber?: string;
  media?: {
    track: 'inbound' | 'outbound';
    chunk: string;
    timestamp: string;
    payload: string; // Base64 encoded audio
  };
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  streamSid?: string;
}

interface AudioStreamSession {
  streamSid: string;
  callSid: string;
  accountSid: string;
  startTime: Date;
  audioChunks: Buffer[];
  totalChunks: number;
  ws: WebSocket;
  transcriptionSegments: TranscriptionSegment[];
  lastTranscriptionTime?: Date;
  isTranscribing: boolean;
}

interface TranscriptionSegment {
  text: string;
  timestamp: Date;
  chunkRange: { start: number; end: number };
  confidence?: number;
  provider: string;
  processingTimeMs: number;
}

export class AudioStreamService {
  private static instance: AudioStreamService;
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, AudioStreamSession> = new Map();
  private sttService: SpeechToTextService;
  private transcriptionProcessor: TranscriptionProcessorService;
  
  // Configuration for real-time transcription
  private readonly TRANSCRIPTION_CONFIG = {
    chunkBufferSize: 50, // Number of audio chunks to buffer before transcription
    transcriptionInterval: 5000, // Max time between transcriptions (ms)
    enabled: true, // Can be disabled for testing
  };

  private constructor() {
    // Get STT service instance
    this.sttService = SpeechToTextService.getInstance();
    
    // Get transcription processor service instance
    this.transcriptionProcessor = TranscriptionProcessorService.getInstance();
  }

  public static getInstance(): AudioStreamService {
    if (!AudioStreamService.instance) {
      AudioStreamService.instance = new AudioStreamService();
    }
    return AudioStreamService.instance;
  }

  public initializeWebSocketServer(server: any): void {
    console.log('🎵 Initializing WebSocket server for Twilio audio streams...');
    
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/twilio/audio-stream'
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    
    console.log('✅ WebSocket server initialized at /api/twilio/audio-stream');
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    console.log('🔌 New WebSocket connection for audio streaming');

    ws.on('message', (data: Buffer) => {
      try {
        const message: TwilioMediaMessage = JSON.parse(data.toString());
        this.handleTwilioMessage(ws, message);
      } catch (error) {
        console.error('❌ Error parsing Twilio message:', error);
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      this.cleanupSession(ws);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      this.cleanupSession(ws);
    });
  }

  private handleTwilioMessage(ws: WebSocket, message: TwilioMediaMessage): void {
    switch (message.event) {
      case 'connected':
        console.log('🎵 Twilio Media Stream connected');
        break;

      case 'start':
        this.handleStreamStart(ws, message);
        break;

      case 'media':
        this.handleMediaData(message);
        break;

      case 'stop':
        this.handleStreamStop(message);
        break;

      default:
        console.log('📩 Unknown Twilio message event:', message.event);
    }
  }

  private handleStreamStart(ws: WebSocket, message: TwilioMediaMessage): void {
    if (!message.start) return;

    const { streamSid, accountSid, callSid, mediaFormat } = message.start;
    
    console.log(`🎙️ Audio stream started:`, {
      streamSid,
      callSid,
      accountSid,
      mediaFormat
    });

    const session: AudioStreamSession = {
      streamSid,
      callSid,
      accountSid,
      startTime: new Date(),
      audioChunks: [],
      totalChunks: 0,
      ws,
      transcriptionSegments: [],
      isTranscribing: false
    };

    this.sessions.set(streamSid, session);

    // Start periodic transcription if STT service is available
    if (this.TRANSCRIPTION_CONFIG.enabled && this.sttService.getStatus().available) {
      this.schedulePeriodicTranscription(session);
      console.log(`✅ Real-time transcription enabled for stream ${streamSid}`);
    } else {
      console.log(`ℹ️ Real-time transcription disabled for stream ${streamSid}`);
    }

    console.log(`✅ Session initialized for stream ${streamSid}`);
  }

  private async handleMediaData(message: TwilioMediaMessage): Promise<void> {
    if (!message.media || !message.streamSid) return;

    const session = this.sessions.get(message.streamSid);
    if (!session) {
      console.error(`❌ No session found for stream ${message.streamSid}`);
      return;
    }

    // Decode base64 audio payload
    const audioBuffer = Buffer.from(message.media.payload, 'base64');
    session.audioChunks.push(audioBuffer);
    session.totalChunks++;

    // Log progress every 100 chunks to avoid spam
    if (session.totalChunks % 100 === 0) {
      console.log(`🎵 Received ${session.totalChunks} audio chunks for stream ${message.streamSid}`);
    }

    // Check if we should trigger transcription based on buffer size
    if (session.audioChunks.length >= this.TRANSCRIPTION_CONFIG.chunkBufferSize) {
      await this.processAudioBuffer(session);
    }
  }

  private async handleStreamStop(message: TwilioMediaMessage): Promise<void> {
    if (!message.streamSid) return;

    const session = this.sessions.get(message.streamSid);
    if (!session) {
      console.error(`❌ No session found for stream ${message.streamSid}`);
      return;
    }

    const duration = Date.now() - session.startTime.getTime();
    console.log(`🎵 Audio stream stopped:`, {
      streamSid: message.streamSid,
      callSid: session.callSid,
      duration: `${duration}ms`,
      totalChunks: session.totalChunks,
      totalAudioSize: session.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0),
      transcriptionSegments: session.transcriptionSegments.length
    });

    // Process any remaining audio chunks
    if (session.audioChunks.length > 0) {
      await this.processAudioBuffer(session, true);
    }

    // Log final transcription summary
    this.logFinalTranscription(session);

    this.sessions.delete(message.streamSid);
  }

  /**
   * Process buffered audio chunks for transcription
   */
  private async processAudioBuffer(session: AudioStreamSession, isFinal: boolean = false): Promise<void> {
    if (session.isTranscribing) {
      console.log(`⏳ Transcription already in progress for stream ${session.streamSid}, skipping`);
      return;
    }

    if (session.audioChunks.length === 0) {
      return;
    }

    if (!this.sttService.getStatus().available) {
      console.warn(`⚠️ STT service not available for stream ${session.streamSid}`);
      return;
    }

    session.isTranscribing = true;
    const startTime = Date.now();
    const chunkStart = session.totalChunks - session.audioChunks.length;
    const chunkEnd = session.totalChunks;

    try {
      console.log(`🗣️ Processing ${session.audioChunks.length} audio chunks for transcription (${isFinal ? 'final' : 'intermediate'})`);

      // Use the STT service to transcribe the buffered audio
      const transcriptionResult = await this.sttService.transcribeAudioChunks(session.audioChunks, {
        language: 'en', // Could be made configurable
        prompt: 'This is a live customer service call. Please transcribe accurately.',
        format: 'text' // Use simpler format for real-time processing
      });

      const processingTime = Date.now() - startTime;

      // Create transcription segment
      const segment: TranscriptionSegment = {
        text: transcriptionResult.text,
        timestamp: new Date(),
        chunkRange: { start: chunkStart, end: chunkEnd },
        confidence: transcriptionResult.confidence,
        provider: transcriptionResult.provider,
        processingTimeMs: processingTime
      };

      session.transcriptionSegments.push(segment);
      session.lastTranscriptionTime = new Date();

      // Clear processed audio chunks to free memory
      session.audioChunks = [];

      console.log(`✅ Real-time transcription (${segment.provider}): "${transcriptionResult.text}"`);
      console.log(`   Processing time: ${processingTime}ms | Chunks: ${chunkStart}-${chunkEnd}`);

      // Process transcription with TranscriptionProcessorService
      try {
        const customerPhone = session.accountSid; // Use accountSid as fallback for customer phone
        
        await this.transcriptionProcessor.processStreamingTranscription(
          session.callSid,
          session.streamSid,
          transcriptionResult,
          customerPhone,
          { start: chunkStart, end: chunkEnd }
        );
        console.log(`📝 Streaming transcription processed through TranscriptionProcessorService`);
      } catch (processorError) {
        console.error(`⚠️ TranscriptionProcessor failed for stream ${session.streamSid}:`, processorError);
        // Don't throw here - transcription itself was successful
      }

    } catch (error) {
      console.error(`❌ Real-time transcription failed for stream ${session.streamSid}:`, error);
    } finally {
      session.isTranscribing = false;
    }
  }

  /**
   * Schedule periodic transcription for a session
   */
  private schedulePeriodicTranscription(session: AudioStreamSession): void {
    const intervalId = setInterval(async () => {
      const sessionExists = this.sessions.has(session.streamSid);
      if (!sessionExists) {
        clearInterval(intervalId);
        return;
      }

      // Check if enough time has passed since last transcription
      const timeSinceLastTranscription = session.lastTranscriptionTime 
        ? Date.now() - session.lastTranscriptionTime.getTime()
        : Date.now() - session.startTime.getTime();

      if (timeSinceLastTranscription >= this.TRANSCRIPTION_CONFIG.transcriptionInterval && 
          session.audioChunks.length > 0 && 
          !session.isTranscribing) {
        await this.processAudioBuffer(session);
      }
    }, 2000); // Check every 2 seconds

    // Store interval ID in session for cleanup (extend interface if needed)
    (session as any).transcriptionIntervalId = intervalId;
  }

  /**
   * Log final transcription summary
   */
  private logFinalTranscription(session: AudioStreamSession): void {
    if (session.transcriptionSegments.length === 0) {
      console.log(`📝 No transcription segments captured for call ${session.callSid}`);
      return;
    }

    console.log(`📝 Final transcription summary for call ${session.callSid}:`);
    console.log(`   Segments: ${session.transcriptionSegments.length}`);
    
    const fullTranscription = session.transcriptionSegments
      .map(segment => segment.text)
      .join(' ')
      .trim();
    
    console.log(`   Full text: "${fullTranscription.substring(0, 200)}${fullTranscription.length > 200 ? '...' : ''}"`);
    
    const totalProcessingTime = session.transcriptionSegments
      .reduce((sum, segment) => sum + segment.processingTimeMs, 0);
    
    console.log(`   Total processing time: ${totalProcessingTime}ms`);
    
    // TODO: Store final transcription in database or conversation service
  }

  private cleanupSession(ws: WebSocket): void {
    // Find and cleanup session associated with this WebSocket
    for (const [streamSid, session] of this.sessions.entries()) {
      if (session.ws === ws) {
        console.log(`🧹 Cleaning up session for stream ${streamSid}`);
        
        // Clear any scheduled transcription intervals
        const intervalId = (session as any).transcriptionIntervalId;
        if (intervalId) {
          clearInterval(intervalId);
        }
        
        this.sessions.delete(streamSid);
        break;
      }
    }
  }

  // Method to get all active sessions (for monitoring/debugging)
  public getActiveSessions(): AudioStreamSession[] {
    return Array.from(this.sessions.values());
  }

  // Method to get session by call ID
  public getSessionByCallId(callSid: string): AudioStreamSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.callSid === callSid) {
        return session;
      }
    }
    return undefined;
  }

  // Method to get transcription for a call
  public getCallTranscription(callSid: string): {
    segments: TranscriptionSegment[];
    fullText: string;
    isActive: boolean;
  } | undefined {
    const session = this.getSessionByCallId(callSid);
    if (!session) return undefined;

    const fullText = session.transcriptionSegments
      .map(segment => segment.text)
      .join(' ')
      .trim();

    return {
      segments: session.transcriptionSegments,
      fullText,
      isActive: this.sessions.has(session.streamSid)
    };
  }

  // Method to close all sessions (for graceful shutdown)
  public closeAllSessions(): void {
    console.log('🛑 Closing all audio stream sessions...');
    for (const session of this.sessions.values()) {
      // Clear transcription intervals
      const intervalId = (session as any).transcriptionIntervalId;
      if (intervalId) {
        clearInterval(intervalId);
      }
      
      session.ws.close();
    }
    this.sessions.clear();
  }

  // Method to get streaming statistics
  public getStreamingStats(): {
    activeSessions: number;
    totalTranscriptionSegments: number;
    sttServiceStatus: any;
    configuration: typeof AudioStreamService.prototype.TRANSCRIPTION_CONFIG;
  } {
    const sessions = Array.from(this.sessions.values());
    const totalSegments = sessions.reduce(
      (sum, session) => sum + session.transcriptionSegments.length, 
      0
    );

    return {
      activeSessions: sessions.length,
      totalTranscriptionSegments: totalSegments,
      sttServiceStatus: this.sttService.getStatus(),
      configuration: AudioStreamService.prototype.TRANSCRIPTION_CONFIG
    };
  }
} 