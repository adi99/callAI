# ElevenLabs Text-to-Speech Configuration

This document explains how to configure ElevenLabs Text-to-Speech (TTS) integration for the voice-enabled customer service platform.

## Overview

The ElevenLabs integration provides natural-sounding voice responses for customer calls. The system uses the ElevenLabs API to convert text responses into high-quality audio that can be played back through Twilio.

## Required Setup

### 1. Get ElevenLabs API Key

1. Sign up for an ElevenLabs account at [elevenlabs.io](https://elevenlabs.io)
2. Navigate to your account settings
3. Generate an API key
4. Copy the API key for use in your environment variables

### 2. Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Required
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Optional - Advanced Configuration
ELEVENLABS_DEFAULT_VOICE_ID=pNInz6obpgDQGcFmaJgB  # Default: Rachel
ELEVENLABS_STABILITY=0.75                          # Range: 0-1
ELEVENLABS_SIMILARITY_BOOST=0.85                   # Range: 0-1  
ELEVENLABS_STYLE=0.2                               # Range: 0-1
ELEVENLABS_USE_SPEAKER_BOOST=true                  # true/false
ELEVENLABS_MODEL_ID=eleven_turbo_v2                # Model selection
ELEVENLABS_OUTPUT_FORMAT=mp3_22050_32              # Audio format
ELEVENLABS_OPTIMIZE_STREAMING_LATENCY=1            # Range: 0-4
```

## Default Configuration

The system comes with sensible defaults that work well for most use cases:

### Voice Settings
- **Stability**: 0.75 (recommended for consistent voice quality)
- **Similarity Boost**: 0.85 (maintains voice characteristics)
- **Style**: 0.2 (slight style variation)
- **Speaker Boost**: Enabled (improves clarity)

### Technical Settings
- **Model**: `eleven_turbo_v2` (fastest with good quality)
- **Output Format**: `mp3_22050_32` (optimized for voice calls)
- **Streaming Latency**: 1 (balanced speed/quality)

### Default Voice
- **Rachel**: Professional American female voice
- **Voice ID**: `pNInz6obpgDQGcFmaJgB`

## Available Voices

The system includes several pre-configured voices:

| Name | Description | Voice ID | Best For |
|------|-------------|----------|----------|
| Rachel | American female, young adult | `pNInz6obpgDQGcFmaJgB` | General customer service |
| Drew | American male, middle aged | `29vD33N1CtxCmqQRPOHJ` | Professional interactions |
| Clyde | American male, middle aged | `2EiwWnXFnvU5JabPnv8n` | Friendly support calls |
| Paul | British male, middle aged | `5Q0t7uMcjvnagumLfvZi` | International customers |
| Domi | American female, young adult | `AZnzlk1XvdvUeBnXmlld` | Energetic interactions |

## Configuration Validation

After setting up your environment variables, validate your configuration:

```bash
npm run validate-elevenlabs
```

This command will:
- Check if the API key is set
- Validate all configuration values
- Display current settings
- List available voices
- Show customization options

## Usage in Code

The ElevenLabs configuration is managed through the `ElevenLabsConfigManager` class:

```typescript
import { ElevenLabsConfigManager } from '../config/elevenlabs';

// Get configuration instance
const configManager = ElevenLabsConfigManager.getInstance();

// Get current configuration
const config = configManager.getConfig();

// Access configuration values
console.log('API Key:', config.apiKey);
console.log('Default Voice:', config.defaultVoiceId);
console.log('Voice Settings:', config.defaultVoiceSettings);

// Update voice settings at runtime
configManager.updateVoiceSettings({
  stability: 0.8,
  similarity_boost: 0.9
});

// Change default voice
configManager.updateVoiceId('29vD33N1CtxCmqQRPOHJ'); // Drew

// Get voice information
const voice = configManager.getVoiceById(config.defaultVoiceId);
console.log('Voice Name:', voice?.name);
```

## Voice Quality Optimization

### For Customer Service Calls

**Recommended Settings:**
```bash
ELEVENLABS_STABILITY=0.75           # Consistent quality
ELEVENLABS_SIMILARITY_BOOST=0.85    # Clear voice characteristics  
ELEVENLABS_STYLE=0.1                # Minimal style variation
ELEVENLABS_USE_SPEAKER_BOOST=true   # Enhanced clarity
```

### For Marketing/Sales Calls

**Recommended Settings:**
```bash
ELEVENLABS_STABILITY=0.65           # More expressive
ELEVENLABS_SIMILARITY_BOOST=0.8     # Natural variations
ELEVENLABS_STYLE=0.3                # More personality
ELEVENLABS_USE_SPEAKER_BOOST=true   # Professional sound
```

## Cost Optimization

### Model Selection
- **eleven_turbo_v2**: Fastest, lowest cost, good quality (recommended)
- **eleven_multilingual_v2**: Multi-language support, higher cost
- **eleven_monolingual_v1**: Highest quality, highest cost

### Audio Format Selection
- **mp3_22050_32**: Best balance for voice calls (recommended)
- **mp3_44100_128**: Higher quality, larger files
- **pcm_16000**: Raw audio, smaller files, requires processing

### Streaming Optimization
- **Level 0**: Highest quality, slower
- **Level 1**: Balanced (recommended)  
- **Level 2-4**: Faster, lower quality

## Troubleshooting

### Common Issues

**API Key Not Working:**
- Verify the key is correctly copied from ElevenLabs dashboard
- Check that your ElevenLabs account has sufficient credits
- Ensure no extra spaces or characters in the environment variable

**Voice Quality Issues:**
- Adjust stability (lower for more variation, higher for consistency)
- Try different voice IDs for better match to your brand
- Increase similarity_boost for clearer voice characteristics

**Latency Problems:**
- Use `eleven_turbo_v2` model for fastest response
- Set `ELEVENLABS_OPTIMIZE_STREAMING_LATENCY=3` for maximum speed
- Use lower quality audio formats if needed

**Configuration Not Loading:**
- Run `npm run validate-elevenlabs` to check for errors
- Verify all environment variables are properly set
- Check that the configuration class is properly imported

## Security Notes

- Never commit your API key to version control
- Store the API key in environment variables only
- Rotate API keys regularly
- Monitor API usage to detect unauthorized access
- Use different API keys for development and production

## Next Steps

After configuring ElevenLabs:
1. Test the configuration with the validation script
2. Implement the TTS API client (Task 15.2)
3. Integrate audio processing and streaming (Task 15.3)
4. Connect with Twilio for call playback (Task 15.4)

## Support

For issues with ElevenLabs configuration:
- Check the validation output for specific error messages
- Review the ElevenLabs API documentation
- Verify your account status and credits
- Contact support if API issues persist 