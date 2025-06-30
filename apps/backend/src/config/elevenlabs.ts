export interface ElevenLabsVoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface ElevenLabsConfig {
  apiKey: string;
  defaultVoiceId: string;
  defaultVoiceSettings: ElevenLabsVoiceSettings;
  modelId: string;
  outputFormat: string;
  optimize_streaming_latency?: number;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
}

export const DEFAULT_ELEVENLABS_VOICES: Record<string, ElevenLabsVoice> = {
  RACHEL: {
    voice_id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Rachel',
    category: 'premade',
    description: 'American female, young adult'
  },
  DREW: {
    voice_id: '29vD33N1CtxCmqQRPOHJ',
    name: 'Drew',
    category: 'premade', 
    description: 'American male, middle aged'
  },
  CLYDE: {
    voice_id: '2EiwWnXFnvU5JabPnv8n',
    name: 'Clyde',
    category: 'premade',
    description: 'American male, middle aged'
  },
  PAUL: {
    voice_id: '5Q0t7uMcjvnagumLfvZi',
    name: 'Paul',
    category: 'premade',
    description: 'British male, middle aged'
  },
  DOMI: {
    voice_id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    category: 'premade',
    description: 'American female, young adult'
  }
};

export const DEFAULT_VOICE_SETTINGS: ElevenLabsVoiceSettings = {
  stability: 0.75,
  similarity_boost: 0.85,
  style: 0.2,
  use_speaker_boost: true
};

export const ELEVENLABS_MODELS = {
  ELEVEN_MULTILINGUAL_V2: 'eleven_multilingual_v2',
  ELEVEN_TURBO_V2: 'eleven_turbo_v2',
  ELEVEN_MONOLINGUAL_V1: 'eleven_monolingual_v1'
} as const;

export const ELEVENLABS_OUTPUT_FORMATS = {
  MP3_44100_128: 'mp3_44100_128',
  MP3_22050_32: 'mp3_22050_32',
  PCM_16000: 'pcm_16000',
  PCM_22050: 'pcm_22050',
  PCM_24000: 'pcm_24000',
  PCM_44100: 'pcm_44100',
  ULAW_8000: 'ulaw_8000'
} as const;

export class ElevenLabsConfigManager {
  private static instance: ElevenLabsConfigManager;
  private config: ElevenLabsConfig | null = null;

  public static getInstance(): ElevenLabsConfigManager {
    if (!ElevenLabsConfigManager.instance) {
      ElevenLabsConfigManager.instance = new ElevenLabsConfigManager();
    }
    return ElevenLabsConfigManager.instance;
  }

  public getConfig(): ElevenLabsConfig {
    if (!this.config) {
      this.config = this.loadConfig();
    }
    return this.config;
  }

  private loadConfig(): ElevenLabsConfig {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required');
    }

    return {
      apiKey,
      defaultVoiceId: process.env.ELEVENLABS_DEFAULT_VOICE_ID || DEFAULT_ELEVENLABS_VOICES.RACHEL.voice_id,
      defaultVoiceSettings: {
        stability: parseFloat(process.env.ELEVENLABS_STABILITY || '0.75'),
        similarity_boost: parseFloat(process.env.ELEVENLABS_SIMILARITY_BOOST || '0.85'),
        style: parseFloat(process.env.ELEVENLABS_STYLE || '0.2'),
        use_speaker_boost: process.env.ELEVENLABS_USE_SPEAKER_BOOST !== 'false'
      },
      modelId: process.env.ELEVENLABS_MODEL_ID || ELEVENLABS_MODELS.ELEVEN_TURBO_V2,
      outputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT || ELEVENLABS_OUTPUT_FORMATS.MP3_22050_32,
      optimize_streaming_latency: process.env.ELEVENLABS_OPTIMIZE_STREAMING_LATENCY 
        ? parseInt(process.env.ELEVENLABS_OPTIMIZE_STREAMING_LATENCY)
        : 1
    };
  }

  public updateVoiceSettings(settings: Partial<ElevenLabsVoiceSettings>): void {
    if (!this.config) {
      this.config = this.loadConfig();
    }
    
    this.config.defaultVoiceSettings = {
      ...this.config.defaultVoiceSettings,
      ...settings
    };
  }

  public updateVoiceId(voiceId: string): void {
    if (!this.config) {
      this.config = this.loadConfig();
    }
    
    this.config.defaultVoiceId = voiceId;
  }

  public validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const config = this.getConfig();

      if (!config.apiKey || config.apiKey.length < 10) {
        errors.push('Invalid or missing ElevenLabs API key');
      }

      if (!config.defaultVoiceId || config.defaultVoiceId.length < 10) {
        errors.push('Invalid or missing default voice ID');
      }

      const { stability, similarity_boost, style } = config.defaultVoiceSettings;
      
      if (stability < 0 || stability > 1) {
        errors.push('Stability must be between 0 and 1');
      }

      if (similarity_boost < 0 || similarity_boost > 1) {
        errors.push('Similarity boost must be between 0 and 1');
      }

      if (style !== undefined && (style < 0 || style > 1)) {
        errors.push('Style must be between 0 and 1');
      }

      if (!Object.values(ELEVENLABS_MODELS).includes(config.modelId as any)) {
        errors.push('Invalid model ID specified');
      }

      if (!Object.values(ELEVENLABS_OUTPUT_FORMATS).includes(config.outputFormat as any)) {
        errors.push('Invalid output format specified');
      }

    } catch (error) {
      errors.push(`Configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public getVoiceById(voiceId: string): ElevenLabsVoice | null {
    return Object.values(DEFAULT_ELEVENLABS_VOICES).find(voice => voice.voice_id === voiceId) || null;
  }

  public getVoiceByName(name: string): ElevenLabsVoice | null {
    return Object.values(DEFAULT_ELEVENLABS_VOICES).find(voice => 
      voice.name.toLowerCase() === name.toLowerCase()
    ) || null;
  }

  public getAllVoices(): ElevenLabsVoice[] {
    return Object.values(DEFAULT_ELEVENLABS_VOICES);
  }

  public printStatus(): void {
    console.log('\n🎙️ ElevenLabs Configuration Status:');
    
    const validation = this.validateConfig();
    
    if (validation.isValid) {
      console.log('✅ ElevenLabs configuration is valid');
      
      const config = this.getConfig();
      const voice = this.getVoiceById(config.defaultVoiceId);
      
      console.log(`🔑 API Key: ${config.apiKey ? '✅ Set' : '❌ Missing'}`);
      console.log(`🎵 Default Voice: ${voice ? voice.name : 'Custom'} (${config.defaultVoiceId})`);
      console.log(`🔧 Model: ${config.modelId}`);
      console.log(`📄 Output Format: ${config.outputFormat}`);
      console.log(`⚙️ Voice Settings:`);
      console.log(`   - Stability: ${config.defaultVoiceSettings.stability}`);
      console.log(`   - Similarity Boost: ${config.defaultVoiceSettings.similarity_boost}`);
      console.log(`   - Style: ${config.defaultVoiceSettings.style || 'N/A'}`);
      console.log(`   - Speaker Boost: ${config.defaultVoiceSettings.use_speaker_boost ? 'Enabled' : 'Disabled'}`);
    } else {
      console.log('❌ ElevenLabs configuration has errors:');
      validation.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }
    
    console.log('');
  }
} 