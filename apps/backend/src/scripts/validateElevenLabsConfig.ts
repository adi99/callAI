#!/usr/bin/env node

import { ElevenLabsConfigManager } from '../config/elevenlabs';
import { EnvValidator } from '../utils/envValidator';

async function validateElevenLabsConfiguration() {
  console.log('🎙️ ElevenLabs Configuration Validation Tool');
  console.log('==========================================\n');

  try {
    console.log('1. Checking environment variables...');
    const envValidation = EnvValidator.validate();
    
    if (!envValidation.isValid) {
      console.log('❌ Environment validation failed. Missing required variables:');
      envValidation.missing.forEach(variable => {
        console.log(`   - ${variable}`);
      });
      process.exit(1);
    }
    
    console.log('✅ Basic environment validation passed');

    console.log('\n2. Checking ElevenLabs specific configuration...');
    
    if (!process.env.ELEVENLABS_API_KEY) {
      console.log('⚠️  ELEVENLABS_API_KEY is not set. This is required for TTS functionality.');
      console.log('   Please set your ElevenLabs API key in your environment variables.');
      console.log('   Example: ELEVENLABS_API_KEY=your_api_key_here');
    } else {
      console.log('✅ ELEVENLABS_API_KEY is set');
    }

    console.log('\n3. Loading ElevenLabs configuration...');
    
    const configManager = ElevenLabsConfigManager.getInstance();
    const config = configManager.getConfig();
    
    console.log('✅ Configuration loaded successfully');

    console.log('\n4. Validating configuration values...');
    
    const validation = configManager.validateConfig();
    
    if (validation.isValid) {
      console.log('✅ All configuration values are valid');
    } else {
      console.log('❌ Configuration validation failed:');
      validation.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }

    console.log('\n5. Configuration summary:');
    configManager.printStatus();

    console.log('\n6. Available voices:');
    const voices = configManager.getAllVoices();
    voices.forEach(voice => {
      const isDefault = voice.voice_id === config.defaultVoiceId;
      console.log(`   ${isDefault ? '👑' : '🎵'} ${voice.name}: ${voice.description} (${voice.voice_id})`);
    });

    console.log('\n7. Environment variables you can set for customization:');
    console.log('   ELEVENLABS_DEFAULT_VOICE_ID - Custom voice ID (default: Rachel)');
    console.log('   ELEVENLABS_STABILITY - Voice stability 0-1 (default: 0.75)');
    console.log('   ELEVENLABS_SIMILARITY_BOOST - Similarity boost 0-1 (default: 0.85)');
    console.log('   ELEVENLABS_STYLE - Voice style 0-1 (default: 0.2)');
    console.log('   ELEVENLABS_USE_SPEAKER_BOOST - Speaker boost true/false (default: true)');
    console.log('   ELEVENLABS_MODEL_ID - Model to use (default: eleven_turbo_v2)');
    console.log('   ELEVENLABS_OUTPUT_FORMAT - Audio format (default: mp3_22050_32)');
    console.log('   ELEVENLABS_OPTIMIZE_STREAMING_LATENCY - Latency optimization 0-4 (default: 1)');

    if (validation.isValid && process.env.ELEVENLABS_API_KEY) {
      console.log('\n🎉 ElevenLabs configuration is ready for use!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Please address the configuration issues above before using ElevenLabs TTS.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error during validation:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

if (require.main === module) {
  validateElevenLabsConfiguration();
}

export { validateElevenLabsConfiguration }; 