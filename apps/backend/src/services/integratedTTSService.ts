import { ElevenLabsTTSService, TTSRequest, TTSError } from './elevenLabsTTSService';
import { AudioProcessingService, AudioFile, AudioProcessingOptions } from './audioProcessingService';
import { TwiMLGeneratorService, TwiMLResponse, GatherOptions } from './twimlGeneratorService';

export interface TTSIntegrationRequest {
  text: string;
  voiceId?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  audioOptions?: AudioProcessingOptions;
  gatherOptions?: GatherOptions;
  nextAction?: string;
  fallbackText?: string;
}

export interface TTSIntegrationResponse {
  success: boolean;
  twiml: string;
  audioFile?: AudioFile;
  error?: string;
  fallbackUsed?: boolean;
  processingTime?: number;
}

export interface TTSIntegrationStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  fallbacksUsed: number;
  averageProcessingTime: number;
  lastError?: string;
}

export class IntegratedTTSService {
  private static instance: IntegratedTTSService;
  private ttsService: ElevenLabsTTSService;
  private audioService: AudioProcessingService;
  private twimlService: TwiMLGeneratorService;
  private stats: TTSIntegrationStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    fallbacksUsed: 0,
    averageProcessingTime: 0
  };

  private constructor() {
    this.ttsService = ElevenLabsTTSService.getInstance();
    this.audioService = AudioProcessingService.getInstance();
    this.twimlService = TwiMLGeneratorService.getInstance();
  }

  public static getInstance(): IntegratedTTSService {
    if (!IntegratedTTSService.instance) {
      IntegratedTTSService.instance = new IntegratedTTSService();
    }
    return IntegratedTTSService.instance;
  }

  public async processTextToSpeechWithFallback(request: TTSIntegrationRequest): Promise<TTSIntegrationResponse> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    console.log(`[IntegratedTTS] Processing TTS request for: "${request.text.substring(0, 50)}..."`);

    try {
      // Step 1: Validate text input
      const textValidation = this.ttsService.validateText(request.text);
      if (!textValidation.isValid) {
        throw new Error(`Text validation failed: ${textValidation.errors.join(', ')}`);
      }

      // Step 2: Synthesize text to audio using ElevenLabs
      const ttsRequest: TTSRequest = {
        text: request.text,
        voice_id: request.voiceId,
        voice_settings: request.voiceSettings ? {
          stability: request.voiceSettings.stability ?? 0.5,
          similarity_boost: request.voiceSettings.similarity_boost ?? 0.5,
          style: request.voiceSettings.style ?? 0,
          use_speaker_boost: request.voiceSettings.use_speaker_boost ?? false
        } : undefined
      };

      const ttsResponse = await this.ttsService.synthesizeText(ttsRequest);

      // Step 3: Process and store the audio
      const audioFile = await this.audioService.processAndStoreAudio(
        ttsResponse.audio,
        request.audioOptions
      );

      // Step 4: Generate TwiML for audio playback
      let twimlResponse: TwiMLResponse;

      if (request.gatherOptions) {
        // Generate TwiML with gather functionality for interactive calls
        twimlResponse = this.twimlService.generateGatherWithAudio(audioFile, request.gatherOptions);
      } else if (request.nextAction) {
        // Generate customer service flow TwiML
        twimlResponse = this.twimlService.generateCustomerServiceFlow(audioFile, request.nextAction);
      } else {
        // Simple audio playback
        twimlResponse = this.twimlService.generatePlayAudio(audioFile);
      }

      const processingTime = Date.now() - startTime;
      this.updateStats(true, processingTime);

      console.log(`[IntegratedTTS] Successfully processed TTS request in ${processingTime}ms`);

      return {
        success: true,
        twiml: twimlResponse.xml,
        audioFile,
        processingTime
      };

    } catch (error) {
      console.error('[IntegratedTTS] TTS processing failed:', error);
      
      const processingTime = Date.now() - startTime;
      this.updateStats(false, processingTime, error instanceof Error ? error.message : 'Unknown error');

      // Generate fallback response
      return this.generateFallbackResponse(request, error);
    }
  }

  private generateFallbackResponse(request: TTSIntegrationRequest, error: any): TTSIntegrationResponse {
    console.log('[IntegratedTTS] Generating fallback response');
    
    this.stats.fallbacksUsed++;

    // Use fallback text if provided, otherwise use original text
    const fallbackText = request.fallbackText || request.text;
    
    let twimlResponse: TwiMLResponse;

    try {
      if (request.gatherOptions) {
        // Generate fallback with text-to-speech and gather
        twimlResponse = this.twimlService.generateGatherWithText(fallbackText, request.gatherOptions);
      } else {
        // Simple fallback with Twilio's built-in TTS
        twimlResponse = this.twimlService.generateSay(fallbackText);
      }

      console.log('[IntegratedTTS] Fallback response generated successfully');

      return {
        success: true,
        twiml: twimlResponse.xml,
        fallbackUsed: true,
        error: this.getErrorMessage(error)
      };

    } catch (fallbackError) {
      console.error('[IntegratedTTS] Fallback generation also failed:', fallbackError);

      // Ultimate fallback - basic error message
      const errorTwiml = this.twimlService.generateSay(
        "I'm sorry, there was a technical issue. Please try again later or contact support."
      );

      return {
        success: false,
        twiml: errorTwiml.xml,
        fallbackUsed: true,
        error: `Primary error: ${this.getErrorMessage(error)}, Fallback error: ${this.getErrorMessage(fallbackError)}`
      };
    }
  }

  private getErrorMessage(error: any): string {
    if (error && typeof error === 'object') {
      if ('code' in error && 'message' in error) {
        // TTSError format
        return `${error.code}: ${error.message}`;
      } else if (error instanceof Error) {
        return error.message;
      }
    }
    return typeof error === 'string' ? error : 'Unknown error';
  }

  private updateStats(success: boolean, processingTime: number, errorMessage?: string): void {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
      if (errorMessage) {
        this.stats.lastError = errorMessage;
      }
    }

    // Update average processing time
    const totalProcessingTime = this.stats.averageProcessingTime * (this.stats.totalRequests - 1) + processingTime;
    this.stats.averageProcessingTime = totalProcessingTime / this.stats.totalRequests;
  }

  public async processSimpleTextToSpeech(text: string, nextAction?: string): Promise<TTSIntegrationResponse> {
    return this.processTextToSpeechWithFallback({
      text,
      nextAction,
      fallbackText: text
    });
  }

  public async processInteractiveTextToSpeech(
    text: string, 
    gatherOptions: GatherOptions,
    fallbackText?: string
  ): Promise<TTSIntegrationResponse> {
    return this.processTextToSpeechWithFallback({
      text,
      gatherOptions,
      fallbackText: fallbackText || text
    });
  }

  public async healthCheck(): Promise<{
    tts: boolean;
    audio: boolean;
    twiml: boolean;
    overall: boolean;
  }> {
    const checks = {
      tts: false,
      audio: false,
      twiml: true, // TwiML generation doesn't need external dependencies
      overall: false
    };

    try {
      // Check TTS service
      checks.tts = await this.ttsService.healthCheck();
    } catch (error) {
      console.warn('[IntegratedTTS] TTS health check failed:', error);
    }

    try {
      // Check audio service (basic directory check)
      await this.audioService.cleanupExpiredFiles();
      checks.audio = true;
    } catch (error) {
      console.warn('[IntegratedTTS] Audio service health check failed:', error);
    }

    checks.overall = checks.tts && checks.audio && checks.twiml;

    return checks;
  }

  public getStats(): TTSIntegrationStats {
    return { ...this.stats };
  }

  public resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      fallbacksUsed: 0,
      averageProcessingTime: 0
    };
    console.log('[IntegratedTTS] Statistics reset');
  }

  public async testIntegration(testText: string = 'Hello, this is a test of the integrated text-to-speech system.'): Promise<TTSIntegrationResponse> {
    console.log('[IntegratedTTS] Running integration test...');
    
    return this.processTextToSpeechWithFallback({
      text: testText,
      fallbackText: 'This is a fallback test message.',
      audioOptions: {
        ttl: 600 // 10 minutes for test files
      }
    });
  }

  public async cleanup(): Promise<void> {
    try {
      console.log('[IntegratedTTS] Performing cleanup...');
      
      // Clean up expired audio files
      const cleanedFiles = await this.audioService.cleanupExpiredFiles();
      console.log(`[IntegratedTTS] Cleaned up ${cleanedFiles} expired audio files`);
      
      // Dispose of services
      await this.ttsService.dispose();
      await this.audioService.dispose();

      console.log('[IntegratedTTS] Cleanup completed');
    } catch (error) {
      console.error('[IntegratedTTS] Cleanup failed:', error);
    }
  }
} 