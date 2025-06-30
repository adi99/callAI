import { Router } from 'express';
import { CredentialService } from '../services/credentialService';
import { DatabaseService } from '../services/database';
import { Readable } from 'stream';

const router = Router();
const credentialService = CredentialService.getInstance();
const dbService = DatabaseService.getInstance();

interface UserSettings {
  twilioPhone?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  openaiModel?: string;
  geminiModel?: string;
  anthropicModel?: string;
  userId?: string;
}

// Get user settings
const getUserSettings = async (req: any, res: any) => {
  try {
    const userId = req.headers['user-id'] as string || 'default';
    
    const { data: settings, error } = await dbService.getClient()
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No settings found, return defaults
      return res.json({
        success: true,
        data: {
          twilioPhone: '',
          twilioAccountSid: '',
          twilioAuthToken: '',
          openaiApiKey: '',
          geminiApiKey: '',
          anthropicApiKey: '',
          elevenLabsApiKey: '',
          elevenLabsVoiceId: '',
          openaiModel: 'gpt-4o',
          geminiModel: 'gemini-1.5-flash',
          anthropicModel: 'claude-3-5-sonnet-20241022'
        }
      });
    }

    if (error) {
      throw error;
    }

    // Decrypt sensitive data
    const decryptedSettings = {
      twilioPhone: settings.twilio_phone || '',
      twilioAccountSid: settings.twilio_account_sid ? 
        credentialService.decrypt(settings.twilio_account_sid) : '',
      twilioAuthToken: settings.twilio_auth_token ? 
        credentialService.decrypt(settings.twilio_auth_token) : '',
      openaiApiKey: settings.openai_api_key ? 
        credentialService.decrypt(settings.openai_api_key) : '',
      geminiApiKey: settings.gemini_api_key ? 
        credentialService.decrypt(settings.gemini_api_key) : '',
      anthropicApiKey: settings.anthropic_api_key ? 
        credentialService.decrypt(settings.anthropic_api_key) : '',
      elevenLabsApiKey: settings.elevenlabs_api_key ? 
        credentialService.decrypt(settings.elevenlabs_api_key) : '',
      elevenLabsVoiceId: settings.elevenlabs_voice_id || '',
      openaiModel: settings.openai_model || 'gpt-4o',
      geminiModel: settings.gemini_model || 'gemini-1.5-flash',
      anthropicModel: settings.anthropic_model || 'claude-3-5-sonnet-20241022'
    };

    res.json({
      success: true,
      data: decryptedSettings
    });

  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings'
    });
  }
};

router.get('/', getUserSettings);

// Save user settings
const saveUserSettings = async (req: any, res: any) => {
  try {
    const userId = req.headers['user-id'] as string || 'default';
    const {
      twilioPhone,
      twilioAccountSid,
      twilioAuthToken,
      openaiApiKey,
      geminiApiKey,
      anthropicApiKey,
      elevenLabsApiKey,
      elevenLabsVoiceId,
      openaiModel,
      geminiModel,
      anthropicModel
    }: UserSettings = req.body;

    // Encrypt sensitive data
    const encryptedData = {
      user_id: userId,
      twilio_phone: twilioPhone || null,
      twilio_account_sid: twilioAccountSid ? credentialService.encrypt(twilioAccountSid) : null,
      twilio_auth_token: twilioAuthToken ? credentialService.encrypt(twilioAuthToken) : null,
      openai_api_key: openaiApiKey ? credentialService.encrypt(openaiApiKey) : null,
      gemini_api_key: geminiApiKey ? credentialService.encrypt(geminiApiKey) : null,
      anthropic_api_key: anthropicApiKey ? credentialService.encrypt(anthropicApiKey) : null,
      elevenlabs_api_key: elevenLabsApiKey ? credentialService.encrypt(elevenLabsApiKey) : null,
      elevenlabs_voice_id: elevenLabsVoiceId || null,
      openai_model: openaiModel || 'gpt-4o',
      gemini_model: geminiModel || 'gemini-1.5-flash',
      anthropic_model: anthropicModel || 'claude-3-5-sonnet-20241022',
      updated_at: new Date().toISOString()
    };

    // Use upsert to insert or update
    const { error } = await dbService.getClient()
      .from('user_settings')
      .upsert(encryptedData, {
        onConflict: 'user_id'
      });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Settings saved successfully'
    });

  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save settings'
    });
  }
};

router.post('/', saveUserSettings);

// Test API key validity
const testApiKey = async (req: any, res: any) => {
  try {
    // Allow models to be provided either via JSON body or query parameters for flexibility
    const { provider, apiKey } = (req.body && Object.keys(req.body).length > 0) ? req.body : req.query;

    let isValid = false;
    let error = '';

    switch (provider) {
      case 'openai':
        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          isValid = response.ok;
          if (!isValid) {
            error = 'Invalid OpenAI API key';
          }
        } catch (err) {
          error = 'Failed to validate OpenAI API key';
        }
        break;

      case 'gemini':
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          isValid = response.ok;
          if (!isValid) {
            error = 'Invalid Gemini API key';
          }
        } catch (err) {
          error = 'Failed to validate Gemini API key';
        }
        break;

      case 'anthropic':
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'test' }]
            })
          });
          isValid = response.ok;
          if (!isValid) {
            error = 'Invalid Anthropic API key';
          }
        } catch (err) {
          error = 'Failed to validate Anthropic API key';
        }
        break;

      case 'elevenlabs':
        try {
          const response = await fetch('https://api.elevenlabs.io/v1/models', {
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json'
            }
          });
          isValid = response.ok;
          if (!isValid) {
            error = 'Invalid ElevenLabs API key';
          }
        } catch (err) {
          error = 'Failed to validate ElevenLabs API key';
        }
        break;

      default:
        error = 'Unknown provider';
    }

    res.json({
      success: true,
      data: {
        isValid,
        error
      }
    });

  } catch (error) {
    console.error('Error testing API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test API key'
    });
  }
};

// List AI models
const listModels = async (req: any, res: any) => {
  try {
    // Allow models to be provided either via JSON body or query parameters for flexibility
    const { provider, apiKey } = (req.body && Object.keys(req.body).length > 0) ? req.body : req.query;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'Missing apiKey' });
    }

    let models: Array<{ id: string; name: string }> = [];

    switch (provider) {
      case 'openai':
        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            return res.status(response.status).json({ success: false, error: 'Failed to fetch OpenAI models' });
          }
          
          const data = await response.json() as any;
          models = data.data
            .filter((model: any) => model.id.includes('gpt'))
            .map((model: any) => ({
              id: model.id,
              name: model.id
            }))
            .sort((a: any, b: any) => a.id.localeCompare(b.id));
        } catch (err) {
          return res.status(500).json({ success: false, error: 'Failed to fetch OpenAI models' });
        }
        break;

      case 'gemini':
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          
          if (!response.ok) {
            const errText = await response.text().catch(() => 'Failed to fetch Gemini models');
            return res.status(response.status).json({ success: false, error: errText || 'Failed to fetch Gemini models' });
          }
          
          const data = await response.json() as any;
          models = data.models
            .filter((model: any) => model.name.includes('gemini'))
            .map((model: any) => ({
              id: model.name.split('/').pop(),
              name: model.name.split('/').pop()
            }))
            .sort((a: any, b: any) => a.id.localeCompare(b.id));
        } catch (err) {
          return res.status(500).json({ success: false, error: 'Failed to fetch Gemini models' });
        }
        break;

      case 'anthropic':
        // Anthropic doesn't have a models endpoint, so we'll return the available models
        models = [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest)' },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)' },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Most Capable)' },
          { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet (Balanced)' },
          { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fastest)' }
        ];
        break;

      default:
        return res.status(400).json({ success: false, error: 'Unknown provider' });
    }

    res.json({ success: true, data: models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch models' });
  }
};

// List ElevenLabs voices
const listElevenLabsVoices = async (req: any, res: any) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'Missing apiKey' });
    }
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: 'Failed to fetch voices from ElevenLabs' });
    }
    const data = await response.json();
    // ElevenLabs returns { voices: [...] } but being defensive here
    const voices = ((data as any).voices ?? data) as any[];
    const simplified = voices.map(v => ({ id: v.voice_id || v.id, name: v.name }));
    res.json({ success: true, data: simplified });
  } catch (error) {
    console.error('Error fetching ElevenLabs voices:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch voices' });
  }
};

// Test ElevenLabs voice
const testElevenLabsVoice = async (req: any, res: any) => {
  try {
    const { apiKey, voiceId, text } = req.body;
    if (!apiKey || !voiceId || !text) {
      return res.status(400).json({ success: false, error: 'Missing apiKey, voiceId, or text' });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      return res.status(response.status).json({ success: false, error: 'Failed to generate voice from ElevenLabs' });
    }

    if (!response.body) {
      return res.status(500).json({ success: false, error: 'Empty response body from ElevenLabs' });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    Readable.fromWeb(response.body as any).pipe(res);

  } catch (error) {
    console.error('Error testing ElevenLabs voice:', error);
    res.status(500).json({ success: false, error: 'Failed to test voice' });
  }
};

router.post('/test-api-key', testApiKey);
router.post('/elevenlabs/voices', listElevenLabsVoices);
router.post('/elevenlabs/test-voice', testElevenLabsVoice);
router.post('/models', listModels);

export default router; 