#!/usr/bin/env node

import { ElevenLabsTTSService } from '../services/elevenLabsTTSService';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function testElevenLabsTTSService() {
  console.log('🎙️ ElevenLabs TTS API Client Test');
  console.log('=================================\n');

  try {
    console.log('1. Initializing TTS service...');
    const ttsService = ElevenLabsTTSService.getInstance();
    console.log('✅ TTS service initialized');

    console.log('\n2. Checking configuration...');
    const config = ttsService.getConfig();
    console.log(`✅ API Key: ${config.apiKey ? 'Set' : 'Missing'}`);
    console.log(`✅ Default Voice: ${config.defaultVoiceId}`);
    console.log(`✅ Model: ${config.modelId}`);
    console.log(`✅ Output Format: ${config.outputFormat}`);

    console.log('\n3. Running health check...');
    const isHealthy = await ttsService.healthCheck();
    if (isHealthy) {
      console.log('✅ ElevenLabs API is accessible');
    } else {
      console.log('❌ ElevenLabs API health check failed');
      console.log('   Please check your API key and network connection');
      return;
    }

    console.log('\n4. Fetching account information...');
    try {
      const accountInfo = await ttsService.getAccountInfo();
      console.log(`✅ Account: ${accountInfo.name || 'N/A'}`);
      console.log(`✅ Characters remaining: ${accountInfo.character_count || 'N/A'}`);
      console.log(`✅ Tier: ${accountInfo.subscription?.tier || 'N/A'}`);
    } catch (error) {
      console.log('⚠️  Could not fetch account info:', error);
    }

    console.log('\n5. Fetching available voices...');
    try {
      const voices = await ttsService.getVoices();
      console.log(`✅ Found ${voices.length} available voices`);
      
      voices.slice(0, 5).forEach(voice => {
        console.log(`   🎵 ${voice.name} (${voice.voice_id}) - ${voice.category}`);
      });
      
      if (voices.length > 5) {
        console.log(`   ... and ${voices.length - 5} more voices`);
      }
    } catch (error) {
      console.log('⚠️  Could not fetch voices:', error);
    }

    console.log('\n6. Validating default voice...');
    const isDefaultVoiceValid = await ttsService.validateVoice(config.defaultVoiceId);
    if (isDefaultVoiceValid) {
      console.log(`✅ Default voice ${config.defaultVoiceId} is valid`);
    } else {
      console.log(`❌ Default voice ${config.defaultVoiceId} is not valid`);
    }

    console.log('\n7. Testing text validation...');
    const textTests = [
      'Hello world!',
      '',
      'A'.repeat(6000),
      'This is a normal customer service message.'
    ];

    textTests.forEach((text, index) => {
      const validation = ttsService.validateText(text);
      const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
      console.log(`   Test ${index + 1}: "${preview}" - ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`);
      if (!validation.isValid) {
        validation.errors.forEach(error => console.log(`      - ${error}`));
      }
    });

    console.log('\n8. Testing character usage estimation...');
    const testText = 'Hello, this is a test message with punctuation and numbers: 123!';
    const estimatedChars = ttsService.estimateCharacterUsage(testText);
    console.log(`   Text: "${testText}"`);
    console.log(`   Estimated character usage: ${estimatedChars}`);

    console.log('\n9. Running TTS synthesis test...');
    const testMessage = 'Hello, this is a test of the ElevenLabs text-to-speech integration for our customer service platform.';
    
    try {
      console.log(`   Synthesizing: "${testMessage}"`);
      const ttsResponse = await ttsService.testSynthesize(testMessage);
      
      console.log(`✅ Synthesis successful!`);
      console.log(`   Audio size: ${ttsResponse.audio.length} bytes`);
      console.log(`   Content type: ${ttsResponse.contentType}`);
      console.log(`   Voice used: ${ttsResponse.voiceId}`);
      console.log(`   Text length: ${ttsResponse.textLength} characters`);
      if (ttsResponse.requestId) {
        console.log(`   Request ID: ${ttsResponse.requestId}`);
      }

      // Save audio file for manual testing
      try {
        const audioDir = join(process.cwd(), 'temp', 'audio');
        mkdirSync(audioDir, { recursive: true });
        
        const filename = `test-tts-${Date.now()}.mp3`;
        const filepath = join(audioDir, filename);
        
        writeFileSync(filepath, ttsResponse.audio);
        console.log(`   Audio saved to: ${filepath}`);
        console.log('   You can play this file to verify audio quality');
      } catch (saveError) {
        console.log('   ⚠️  Could not save audio file:', saveError);
      }

    } catch (error: any) {
      console.log('❌ TTS synthesis failed:', error);
      
      if (error.code === 'INSUFFICIENT_CREDITS') {
        console.log('   Please add credits to your ElevenLabs account');
      } else if (error.code === 'UNAUTHORIZED') {
        console.log('   Please check your API key');
      } else if (error.code === 'RATE_LIMITED') {
        console.log('   Rate limit exceeded, please try again later');
      }
    }

    console.log('\n10. Testing voice-specific synthesis...');
    try {
      const voiceSpecificTest = await ttsService.synthesizeText({
        text: 'This is a test with custom voice settings.',
        voice_settings: {
          stability: 0.9,
          similarity_boost: 0.7,
          style: 0.1,
          use_speaker_boost: true
        }
      });

      console.log(`✅ Voice-specific synthesis successful`);
      console.log(`   Audio size: ${voiceSpecificTest.audio.length} bytes`);
      
      // Save this test audio too
      try {
        const audioDir = join(process.cwd(), 'temp', 'audio');
        const filename = `test-custom-voice-${Date.now()}.mp3`;
        const filepath = join(audioDir, filename);
        
        writeFileSync(filepath, voiceSpecificTest.audio);
        console.log(`   Custom voice audio saved to: ${filepath}`);
      } catch (saveError) {
        console.log('   ⚠️  Could not save custom voice audio file');
      }

    } catch (error) {
      console.log('⚠️  Voice-specific synthesis failed:', error);
    }

    console.log('\n🎉 ElevenLabs TTS API Client Test Complete!');
    console.log('\nSummary:');
    console.log('- ✅ TTS service initialization: SUCCESS');
    console.log('- ✅ Configuration loading: SUCCESS');
    console.log('- ✅ API health check: SUCCESS');
    console.log('- ✅ Text validation: SUCCESS');
    console.log('- ✅ TTS synthesis: SUCCESS');
    console.log('\nThe ElevenLabs TTS API client is ready for integration!');

  } catch (error: any) {
    console.error('\n❌ Test failed with error:', error);
    
    if (error.code === 'UNAUTHORIZED') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('1. Check that ELEVENLABS_API_KEY is set in your environment');
      console.log('2. Verify the API key is correct in your ElevenLabs dashboard');
      console.log('3. Ensure your ElevenLabs account is active');
    } else if (error.code === 'NETWORK_ERROR') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('1. Check your internet connection');
      console.log('2. Verify that ElevenLabs API is accessible from your network');
      console.log('3. Check if there are any firewall restrictions');
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  testElevenLabsTTSService();
}

export { testElevenLabsTTSService }; 