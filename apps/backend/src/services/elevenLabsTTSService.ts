import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ElevenLabsConfigManager, ElevenLabsConfig, ElevenLabsVoiceSettings } from '../config/elevenlabs';

export interface TTSRequest {
  text: string;
  voice_id?: string;
  voice_settings?: ElevenLabsVoiceSettings;
  model_id?: string;
  output_format?: string;
  optimize_streaming_latency?: number;
}

export interface TTSResponse {
  audio: Buffer;
  contentType: string;
  voiceId: string;
  textLength: number;
  requestId?: string;
}

export interface TTSError {
  code: string;
  message: string;
  details?: any;
  requestId?: string;
}

export interface VoiceInfo {
  voice_id: string;
  name: string;
  samples: any[];
  category: string;
  fine_tuning: {
    is_allowed: boolean;
    finetuning_state: string;
  };
  labels: Record<string, string>;
  description: string;
  preview_url: string;
  available_for_tiers: string[];
  settings: ElevenLabsVoiceSettings;
}

export class ElevenLabsTTSService {
  private static instance: ElevenLabsTTSService;
  private client: AxiosInstance;
  private config: ElevenLabsConfig;
  private configManager: ElevenLabsConfigManager;

  private constructor() {
    this.configManager = ElevenLabsConfigManager.getInstance();
    this.config = this.configManager.getConfig();
    
    this.client = axios.create({
      baseURL: 'https://api.elevenlabs.io/v1',
      timeout: 30000,
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.config.apiKey
      }
    });

    this.setupInterceptors();
  }

  public static getInstance(): ElevenLabsTTSService {
    if (!ElevenLabsTTSService.instance) {
      ElevenLabsTTSService.instance = new ElevenLabsTTSService();
    }
    return ElevenLabsTTSService.instance;
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[ElevenLabs] Making request to: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[ElevenLabs] Request error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[ElevenLabs] Response received: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        console.error('[ElevenLabs] Response error:', error.response?.data || error.message);
        return Promise.reject(this.transformError(error));
      }
    );
  }

  private transformError(error: any): TTSError {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          return {
            code: 'UNAUTHORIZED',
            message: 'Invalid API key or insufficient permissions',
            details: data
          };
        case 402:
          return {
            code: 'INSUFFICIENT_CREDITS',
            message: 'Insufficient credits to complete the request',
            details: data
          };
        case 422:
          return {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: data
          };
        case 429:
          return {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded, please try again later',
            details: data
          };
        case 500:
          return {
            code: 'SERVER_ERROR',
            message: 'ElevenLabs server error',
            details: data
          };
        default:
          return {
            code: 'HTTP_ERROR',
            message: `HTTP ${status}: ${error.response.statusText}`,
            details: data
          };
      }
    } else if (error.request) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error - unable to reach ElevenLabs API',
        details: error.message
      };
    } else {
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message || 'Unknown error occurred',
        details: error
      };
    }
  }

  public async synthesizeText(request: TTSRequest): Promise<TTSResponse> {
    try {
      const voiceId = request.voice_id || this.config.defaultVoiceId;
      const voiceSettings = {
        ...this.config.defaultVoiceSettings,
        ...request.voice_settings
      };

      const requestBody = {
        text: request.text,
        model_id: request.model_id || this.config.modelId,
        voice_settings: voiceSettings,
        output_format: request.output_format || this.config.outputFormat,
        optimize_streaming_latency: request.optimize_streaming_latency || this.config.optimize_streaming_latency
      };

      console.log(`[ElevenLabs] Synthesizing text (${request.text.length} chars) with voice: ${voiceId}`);

      const response: AxiosResponse = await this.client.post(
        `/text-to-speech/${voiceId}`,
        requestBody,
        {
          responseType: 'arraybuffer'
        }
      );

      const audioBuffer = Buffer.from(response.data);
      
      console.log(`[ElevenLabs] Successfully generated ${audioBuffer.length} bytes of audio`);

      return {
        audio: audioBuffer,
        contentType: response.headers['content-type'] || 'audio/mpeg',
        voiceId: voiceId,
        textLength: request.text.length,
        requestId: response.headers['x-request-id']
      };

    } catch (error) {
      console.error('[ElevenLabs] Text synthesis failed:', error);
      throw error;
    }
  }

  public async synthesizeTextStream(request: TTSRequest): Promise<NodeJS.ReadableStream> {
    try {
      const voiceId = request.voice_id || this.config.defaultVoiceId;
      const voiceSettings = {
        ...this.config.defaultVoiceSettings,
        ...request.voice_settings
      };

      const requestBody = {
        text: request.text,
        model_id: request.model_id || this.config.modelId,
        voice_settings: voiceSettings,
        output_format: request.output_format || this.config.outputFormat,
        optimize_streaming_latency: request.optimize_streaming_latency || this.config.optimize_streaming_latency
      };

      console.log(`[ElevenLabs] Streaming synthesis for text (${request.text.length} chars) with voice: ${voiceId}`);

      const response = await this.client.post(
        `/text-to-speech/${voiceId}/stream`,
        requestBody,
        {
          responseType: 'stream'
        }
      );

      return response.data;

    } catch (error) {
      console.error('[ElevenLabs] Text synthesis streaming failed:', error);
      throw error;
    }
  }

  public async getVoices(): Promise<VoiceInfo[]> {
    try {
      console.log('[ElevenLabs] Fetching available voices');
      
      const response = await this.client.get('/voices');
      
      return response.data.voices || [];
    } catch (error) {
      console.error('[ElevenLabs] Failed to fetch voices:', error);
      throw error;
    }
  }

  public async getVoice(voiceId: string): Promise<VoiceInfo> {
    try {
      console.log(`[ElevenLabs] Fetching voice details for: ${voiceId}`);
      
      const response = await this.client.get(`/voices/${voiceId}`);
      
      return response.data;
    } catch (error) {
      console.error(`[ElevenLabs] Failed to fetch voice ${voiceId}:`, error);
      throw error;
    }
  }

  public async validateVoice(voiceId: string): Promise<boolean> {
    try {
      await this.getVoice(voiceId);
      return true;
    } catch (error) {
      return false;
    }
  }

  public async getAccountInfo(): Promise<any> {
    try {
      console.log('[ElevenLabs] Fetching account information');
      
      const response = await this.client.get('/user');
      
      return response.data;
    } catch (error) {
      console.error('[ElevenLabs] Failed to fetch account info:', error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.getAccountInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  public updateConfig(newConfig?: Partial<ElevenLabsConfig>): void {
    if (newConfig) {
      this.config = { ...this.config, ...newConfig };
    } else {
      this.config = this.configManager.getConfig();
    }

    this.client.defaults.headers['xi-api-key'] = this.config.apiKey;
  }

  public getConfig(): ElevenLabsConfig {
    return { ...this.config };
  }

  public async testSynthesize(text: string = 'Hello, this is a test of the ElevenLabs text-to-speech service.'): Promise<TTSResponse> {
    console.log('[ElevenLabs] Running test synthesis...');
    
    return this.synthesizeText({
      text,
      voice_settings: {
        stability: 0.8,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      }
    });
  }

  public estimateCharacterUsage(text: string): number {
    return text.replace(/[^a-zA-Z0-9\s.,!?;:'"(){}[\]-]/g, '').length;
  }

  public validateText(text: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!text || text.trim().length === 0) {
      errors.push('Text cannot be empty');
    }

    if (text.length > 5000) {
      errors.push('Text exceeds maximum length of 5000 characters');
    }

    const characterCount = this.estimateCharacterUsage(text);
    if (characterCount < 1) {
      errors.push('Text must contain at least one valid character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public async dispose(): Promise<void> {
    console.log('[ElevenLabs] Disposing TTS service');
  }
} 