import { CredentialService } from '../services/credentialService';
import { ElevenLabsConfigManager } from '../config/elevenlabs';

export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  FRONTEND_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  API_SECRET_KEY: string;
  SHOPIFY_CLIENT_ID?: string;
  SHOPIFY_CLIENT_SECRET?: string;
  SHOPIFY_WEBHOOK_SECRET?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_DEFAULT_VOICE_ID?: string;
  ELEVENLABS_STABILITY?: string;
  ELEVENLABS_SIMILARITY_BOOST?: string;
  ELEVENLABS_STYLE?: string;
  ELEVENLABS_USE_SPEAKER_BOOST?: string;
  ELEVENLABS_MODEL_ID?: string;
  ELEVENLABS_OUTPUT_FORMAT?: string;
  ELEVENLABS_OPTIMIZE_STREAMING_LATENCY?: string;
  OPENAI_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  GOOGLE_CLOUD_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  REDIS_URL?: string;
  REDIS_PASSWORD?: string;
  WEBHOOK_BASE_URL?: string;
}

export class EnvValidator {
  private static requiredVars = [
    'NODE_ENV',
    'PORT',
    'FRONTEND_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'API_SECRET_KEY'
  ];

  private static optionalVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SHOPIFY_CLIENT_ID',
    'SHOPIFY_CLIENT_SECRET',
    'SHOPIFY_WEBHOOK_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_DEFAULT_VOICE_ID',
    'ELEVENLABS_STABILITY',
    'ELEVENLABS_SIMILARITY_BOOST',
    'ELEVENLABS_STYLE',
    'ELEVENLABS_USE_SPEAKER_BOOST',
    'ELEVENLABS_MODEL_ID',
    'ELEVENLABS_OUTPUT_FORMAT',
    'ELEVENLABS_OPTIMIZE_STREAMING_LATENCY',
    'OPENAI_API_KEY',
    'CLAUDE_API_KEY',
    'GOOGLE_CLOUD_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'REDIS_URL',
    'REDIS_PASSWORD',
    'WEBHOOK_BASE_URL'
  ];

  static validate(): { isValid: boolean; missing: string[]; warnings: string[] } {
    const missing: string[] = [];
    const warnings: string[] = [];

    for (const varName of this.requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
      warnings.push('ENCRYPTION_KEY should be at least 32 characters long for security');
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters long for security');
    }

    if (process.env.NODE_ENV === 'production') {
      const prodRequired = ['SUPABASE_SERVICE_ROLE_KEY', 'WEBHOOK_BASE_URL'];
      for (const varName of prodRequired) {
        if (!process.env[varName]) {
          missing.push(`${varName} (required in production)`);
        }
      }
    }

    return {
      isValid: missing.length === 0,
      missing,
      warnings
    };
  }

  static getConfig(): EnvConfig {
    const validation = this.validate();
    if (!validation.isValid) {
      throw new Error(`Missing required environment variables: ${validation.missing.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn('Environment variable warnings:');
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    return {
      NODE_ENV: process.env.NODE_ENV!,
      PORT: parseInt(process.env.PORT!) || 3001,
      FRONTEND_URL: process.env.FRONTEND_URL!,
      SUPABASE_URL: process.env.SUPABASE_URL!,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      JWT_SECRET: process.env.JWT_SECRET!,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
      API_SECRET_KEY: process.env.API_SECRET_KEY!,
      SHOPIFY_CLIENT_ID: process.env.SHOPIFY_CLIENT_ID,
      SHOPIFY_CLIENT_SECRET: process.env.SHOPIFY_CLIENT_SECRET,
      SHOPIFY_WEBHOOK_SECRET: process.env.SHOPIFY_WEBHOOK_SECRET,
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      ELEVENLABS_DEFAULT_VOICE_ID: process.env.ELEVENLABS_DEFAULT_VOICE_ID,
      ELEVENLABS_STABILITY: process.env.ELEVENLABS_STABILITY,
      ELEVENLABS_SIMILARITY_BOOST: process.env.ELEVENLABS_SIMILARITY_BOOST,
      ELEVENLABS_STYLE: process.env.ELEVENLABS_STYLE,
      ELEVENLABS_USE_SPEAKER_BOOST: process.env.ELEVENLABS_USE_SPEAKER_BOOST,
      ELEVENLABS_MODEL_ID: process.env.ELEVENLABS_MODEL_ID,
      ELEVENLABS_OUTPUT_FORMAT: process.env.ELEVENLABS_OUTPUT_FORMAT,
      ELEVENLABS_OPTIMIZE_STREAMING_LATENCY: process.env.ELEVENLABS_OPTIMIZE_STREAMING_LATENCY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
      GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      REDIS_URL: process.env.REDIS_URL,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
      WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL
    };
  }

  static generateSecureKey(length: number = 32): string {
    const credentialService = CredentialService.getInstance();
    return require('crypto').randomBytes(length).toString('hex');
  }

  static checkCredentialService(): boolean {
    try {
      const credentialService = CredentialService.getInstance();
      const validation = credentialService.validateEnvironmentVariables();
      return validation.isValid;
    } catch (error) {
      return false;
    }
  }

  static printStatus(): void {
    console.log('\n🔐 Security Configuration Status:');
    
    const validation = this.validate();
    
    if (validation.isValid) {
      console.log('✅ All required environment variables are set');
    } else {
      console.log('❌ Missing required environment variables:');
      validation.missing.forEach(varName => {
        console.log(`   - ${varName}`);
      });
    }

    if (validation.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      validation.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }

    const credServiceOk = this.checkCredentialService();
    console.log(`🔑 Credential Service: ${credServiceOk ? '✅ Ready' : '❌ Not Ready'}`);

    const optionalCount = this.optionalVars.filter(varName => process.env[varName]).length;
    console.log(`🔧 Optional services configured: ${optionalCount}/${this.optionalVars.length}`);
    
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const elevenLabsConfig = ElevenLabsConfigManager.getInstance();
        elevenLabsConfig.printStatus();
      } catch (error) {
        console.log('🎙️ ElevenLabs: ❌ Configuration Error');
      }
    }
    
    console.log('');
  }
} 