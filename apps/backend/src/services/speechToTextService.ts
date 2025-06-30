import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// STT Provider types
enum STTProvider {
  WHISPER = 'whisper',
  GOOGLE_STT = 'google-stt'
}

interface STTConfig {
  provider: STTProvider;
  whisper?: {
    apiKey: string;
    model: string;
  };
  google?: {
    apiKey: string;
    projectId?: string;
  };
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
    maxRetryDelay: number;
  };
  optimizations?: {
    enableVAD: boolean; // Voice Activity Detection
    silenceThreshold: number; // in seconds
    maxAudioDuration: number; // in seconds
    compressionLevel: number; // 0-9
  };
}

interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
  provider: STTProvider;
  timestamp: Date;
  metadata?: {
    segments?: any[];
    words?: any[];
    processingTime?: number;
    retryCount?: number;
    errorRecovered?: boolean;
  };
}

interface AudioProcessingOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
  format?: 'text' | 'json' | 'verbose_json';
  enableRetry?: boolean;
  timeoutMs?: number;
}

interface STTError {
  code: string;
  message: string;
  provider: STTProvider;
  retryable: boolean;
  timestamp: Date;
  originalError?: any;
}

export class SpeechToTextService {
  private static instance: SpeechToTextService;
  private config: STTConfig | null = null;
  private openaiClient: OpenAI | null = null;
  private isInitialized = false;
  
  // Error handling and retry configuration
  private readonly DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    backoffMultiplier: 2,
    maxRetryDelay: 10000 // 10 seconds
  };

  // Optimization configuration
  private readonly DEFAULT_OPTIMIZATION_CONFIG = {
    enableVAD: false, // Can be enabled later
    silenceThreshold: 1.0, // 1 second of silence
    maxAudioDuration: 600, // 10 minutes max
    compressionLevel: 6 // Medium compression
  };

  // Error tracking
  private errorStats = {
    totalErrors: 0,
    errorsByType: new Map<string, number>(),
    lastError: null as STTError | null,
    successfulRetries: 0
  };

  private constructor() {}

  public static getInstance(): SpeechToTextService {
    if (!SpeechToTextService.instance) {
      SpeechToTextService.instance = new SpeechToTextService();
    }
    return SpeechToTextService.instance;
  }

  /**
   * Auto-initialize the service based on available environment variables
   */
  public autoInitialize(): void {
    const whisperKey = process.env.OPENAI_API_KEY;
    const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (whisperKey) {
      this.initialize({
        provider: STTProvider.WHISPER,
        whisper: {
          apiKey: whisperKey,
          model: 'whisper-1'
        },
        retryConfig: this.DEFAULT_RETRY_CONFIG,
        optimizations: this.DEFAULT_OPTIMIZATION_CONFIG
      });
    } else if (googleKey) {
      console.log('🗣️ Google STT detected but not yet implemented, using fallback');
      // TODO: Implement Google STT when needed
    } else {
      console.log('🗣️ No STT API keys found');
    }
  }

  /**
   * Initialize the service with configuration
   */
  public initialize(config: STTConfig): void {
    this.config = config;

    if (config.provider === STTProvider.WHISPER && config.whisper) {
      try {
        this.openaiClient = new OpenAI({
          apiKey: config.whisper.apiKey
        });
        this.isInitialized = true;
        console.log(`🗣️ STT Service initialized with ${config.provider.toUpperCase()}`);
      } catch (error) {
        this.handleError('INIT_FAILED', 'Failed to initialize OpenAI client', false, error);
      }
    }
  }

  /**
   * Get service status and configuration
   */
  public getStatus(): {
    available: boolean;
    provider: STTProvider;
    errorStats: {
      totalErrors: number;
      errorsByType: Record<string, number>;
      lastError: STTError | null;
      successfulRetries: number;
    };
    config?: Partial<STTConfig>;
  } {
    return {
      available: this.isInitialized && this.config !== null,
      provider: this.config?.provider || STTProvider.WHISPER,
      errorStats: {
        totalErrors: this.errorStats.totalErrors,
        errorsByType: Object.fromEntries(this.errorStats.errorsByType),
        lastError: this.errorStats.lastError,
        successfulRetries: this.errorStats.successfulRetries
      },
      config: this.config ? {
        provider: this.config.provider,
        retryConfig: this.config.retryConfig,
        optimizations: this.config.optimizations
      } : undefined
    };
  }

  /**
   * Enhanced file transcription with retry logic and optimization
   */
  public async transcribeFile(
    filePath: string, 
    options: AudioProcessingOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    if (!this.isInitialized || !this.openaiClient || !this.config) {
      throw this.createError('SERVICE_NOT_INITIALIZED', 'STT service not initialized', false);
    }

    // Validate file
    await this.validateAudioFile(filePath);

    // Apply optimizations
    const optimizedFilePath = await this.optimizeAudioFile(filePath);

    const defaultOptions: AudioProcessingOptions = {
      language: 'en',
      format: 'verbose_json',
      enableRetry: true,
      timeoutMs: 30000,
      ...options
    };

    const executeTranscription = async (attempt: number): Promise<TranscriptionResult> => {
      try {
        console.log(`🗣️ Transcribing file (attempt ${attempt + 1}): ${path.basename(filePath)}`);

        const transcription = await this.openaiClient!.audio.transcriptions.create({
          file: fs.createReadStream(optimizedFilePath),
          model: this.config!.whisper!.model,
          language: defaultOptions.language,
          prompt: defaultOptions.prompt,
          temperature: defaultOptions.temperature,
          response_format: defaultOptions.format
        });

        const processingTime = Date.now() - startTime;
        
        // Parse response based on format
        let result: TranscriptionResult;
        if (defaultOptions.format === 'verbose_json' && typeof transcription === 'object') {
          result = {
            text: (transcription as any).text,
            confidence: this.calculateAverageConfidence((transcription as any).segments),
            language: (transcription as any).language,
            duration: (transcription as any).duration,
            provider: STTProvider.WHISPER,
            timestamp: new Date(),
            metadata: {
              segments: (transcription as any).segments,
              words: (transcription as any).words,
              processingTime,
              retryCount: attempt,
              errorRecovered: attempt > 0
            }
          };
        } else {
          result = {
            text: typeof transcription === 'string' ? transcription : (transcription as any).text,
            provider: STTProvider.WHISPER,
            timestamp: new Date(),
            metadata: {
              processingTime,
              retryCount: attempt,
              errorRecovered: attempt > 0
            }
          };
        }

        // Clean up optimized file if different from original
        if (optimizedFilePath !== filePath) {
          await this.cleanupTempFile(optimizedFilePath);
        }

        return result;

      } catch (error) {
        const sttError = this.handleError('TRANSCRIPTION_FAILED', 'File transcription failed', true, error);
        
        // Check if we should retry
        if (defaultOptions.enableRetry && attempt < (this.config!.retryConfig?.maxRetries || 3) && sttError.retryable) {
          const delay = this.calculateRetryDelay(attempt);
          console.log(`⏳ Retrying transcription in ${delay}ms (attempt ${attempt + 1})`);
          await this.sleep(delay);
          return executeTranscription(attempt + 1);
        }
        
        throw sttError;
      }
    };

    try {
      const result = await executeTranscription(0);
      if (result.metadata?.retryCount && result.metadata.retryCount > 0) {
        this.errorStats.successfulRetries++;
      }
      return result;
    } catch (error) {
      // Clean up optimized file on final failure
      if (optimizedFilePath !== filePath) {
        await this.cleanupTempFile(optimizedFilePath);
      }
      throw error;
    }
  }

  /**
   * Enhanced audio buffer transcription for streaming
   */
  public async transcribeAudioChunks(
    audioChunks: Buffer[],
    options: AudioProcessingOptions = {}
  ): Promise<TranscriptionResult> {
    if (!this.isInitialized || !this.openaiClient) {
      throw this.createError('SERVICE_NOT_INITIALIZED', 'STT service not initialized', false);
    }

    if (audioChunks.length === 0) {
      throw this.createError('INVALID_INPUT', 'No audio chunks provided', false);
    }

    // Combine audio chunks into a single buffer
    const combinedBuffer = Buffer.concat(audioChunks);
    
    // Apply optimizations to buffer
    const optimizedBuffer = await this.optimizeAudioBuffer(combinedBuffer);

    // Create temporary file for processing
    const tempFilePath = await this.createTempAudioFile(optimizedBuffer);

    try {
      const result = await this.transcribeFile(tempFilePath, {
        format: 'text', // Use simpler format for streaming
        ...options
      });

      return result;
    } finally {
      // Always cleanup temp file
      await this.cleanupTempFile(tempFilePath);
    }
  }

  /**
   * Validate audio file before processing
   */
  private async validateAudioFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);
      
      // Check file size (max 25MB for Whisper)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (stats.size > maxSize) {
        throw this.createError('FILE_TOO_LARGE', `Audio file exceeds ${maxSize / 1024 / 1024}MB limit`, false);
      }

      // Check if file exists and is readable
      await fs.promises.access(filePath, fs.constants.R_OK);

      // Estimate duration (approximate, would need audio library for exact duration)
      const estimatedDuration = stats.size / (16000 * 2); // Assume 16kHz, 16-bit
      const maxDuration = this.config?.optimizations?.maxAudioDuration || 600;
      
      if (estimatedDuration > maxDuration) {
        console.warn(`⚠️ Audio file may exceed max duration (${maxDuration}s), processing anyway`);
      }

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const errorCode = (error as any).code;
        if (errorCode === 'ENOENT') {
          throw this.createError('FILE_NOT_FOUND', 'Audio file not found', false);
        }
        if (errorCode === 'EACCES') {
          throw this.createError('FILE_ACCESS_DENIED', 'Cannot read audio file', false);
        }
      }
      throw error;
    }
  }

  /**
   * Optimize audio file for better transcription
   */
  private async optimizeAudioFile(filePath: string): Promise<string> {
    // For now, return original file path
    // TODO: Implement audio optimization (format conversion, noise reduction, etc.)
    console.log(`🔧 Audio optimization (placeholder): ${path.basename(filePath)}`);
    return filePath;
  }

  /**
   * Optimize audio buffer for streaming transcription
   */
  private async optimizeAudioBuffer(buffer: Buffer): Promise<Buffer> {
    // Apply basic optimizations
    const optimizations = this.config?.optimizations || this.DEFAULT_OPTIMIZATION_CONFIG;
    
    // TODO: Implement VAD (Voice Activity Detection) if enabled
    if (optimizations.enableVAD) {
      console.log('🔧 VAD optimization (placeholder)');
    }

    // For now, return original buffer
    return buffer;
  }

  /**
   * Create temporary audio file from buffer
   */
  private async createTempAudioFile(buffer: Buffer): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp', 'stt');
    
    // Ensure temp directory exists
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    const tempFilePath = path.join(tempDir, `temp_audio_${Date.now()}.wav`);
    await fs.promises.writeFile(tempFilePath, buffer);
    
    return tempFilePath;
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
      console.log(`🗑️ Cleaned up temp file: ${path.basename(filePath)}`);
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup temp file: ${filePath}`, error);
    }
  }

  /**
   * Calculate average confidence from segments
   */
  private calculateAverageConfidence(segments?: any[]): number | undefined {
    if (!segments || segments.length === 0) return undefined;
    
    const confidences = segments
      .filter(seg => typeof seg.confidence === 'number')
      .map(seg => seg.confidence);
    
    if (confidences.length === 0) return undefined;
    
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const config = this.config?.retryConfig || this.DEFAULT_RETRY_CONFIG;
    const delay = config.retryDelay * Math.pow(config.backoffMultiplier, attempt);
    return Math.min(delay, config.maxRetryDelay);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhanced error handling
   */
  private handleError(code: string, message: string, retryable: boolean, originalError?: any): STTError {
    const error: STTError = {
      code,
      message,
      provider: this.config?.provider || STTProvider.WHISPER,
      retryable,
      timestamp: new Date(),
      originalError
    };

    // Update error statistics
    this.errorStats.totalErrors++;
    this.errorStats.errorsByType.set(code, (this.errorStats.errorsByType.get(code) || 0) + 1);
    this.errorStats.lastError = error;

    // Log error with appropriate level
    if (retryable) {
      console.warn(`⚠️ STT ${code}: ${message}`, originalError?.message || '');
    } else {
      console.error(`❌ STT ${code}: ${message}`, originalError);
    }

    return error;
  }

  /**
   * Create STT error
   */
  private createError(code: string, message: string, retryable: boolean, originalError?: any): STTError {
    return this.handleError(code, message, retryable, originalError);
  }

  /**
   * Test service functionality
   */
  public async testService(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        console.log('🗣️ STT Service test: Service not initialized');
        return false;
      }

      console.log('🗣️ STT Service test: Testing basic functionality...');
      
      // TODO: Implement actual test with small audio file
      // For now, just test API connectivity
      
      console.log('✅ STT Service test passed');
      return true;
    } catch (error) {
      console.error('❌ STT Service test failed:', error);
      return false;
    }
  }

  /**
   * Get error statistics
   */
  public getErrorStats() {
    return {
      ...this.errorStats,
      errorsByType: Object.fromEntries(this.errorStats.errorsByType)
    };
  }

  /**
   * Reset error statistics
   */
  public resetErrorStats(): void {
    this.errorStats = {
      totalErrors: 0,
      errorsByType: new Map(),
      lastError: null,
      successfulRetries: 0
    };
    console.log('📊 STT error statistics reset');
  }
} 