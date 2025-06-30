import React, { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Phone, Brain, Mic, Save, TestTube, CheckCircle, XCircle, Loader } from 'lucide-react';
import { apiService, UserSettings, ElevenLabsVoice } from '../services/api';
import { testElevenLabsVoice } from '../services/api';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>({
    twilioPhone: '',
    twilioAccountSid: '',
    twilioAuthToken: '',
    openaiApiKey: '',
    openaiModel: '',
    geminiApiKey: '',
    geminiModel: '',
    anthropicApiKey: '',
    anthropicModel: '',
    elevenLabsApiKey: '',
    elevenLabsVoiceId: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingKeys, setTestingKeys] = useState<Record<string, boolean>>({});
  const [keyValidation, setKeyValidation] = useState<Record<string, { isValid: boolean; error?: string }>>({});
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ [key: string]: { isValid: boolean, error?: string } }>({});
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [openaiModelOptions, setOpenaiModelOptions] = useState<{ id: string; name: string }[]>([]);
  const [geminiModelOptions, setGeminiModelOptions] = useState<{ id: string; name: string }[]>([]);
  const [anthropicModelOptions, setAnthropicModelOptions] = useState<{ id: string; name: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState<{ [provider: string]: boolean }>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiService.getUserSettings();
      if (response.success && response.data) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof UserSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    // Clear validation when user changes the key
    if (field.includes('ApiKey')) {
      setKeyValidation(prev => ({ ...prev, [field]: { isValid: false } }));

      // Reset model options when API key changes
      if (field === 'openaiApiKey') setOpenaiModelOptions([]);
      if (field === 'geminiApiKey') setGeminiModelOptions([]);
      if (field === 'anthropicApiKey') setAnthropicModelOptions([]);
    }
  };

  const testApiKey = async (provider: 'openai' | 'gemini' | 'elevenlabs' | 'anthropic', keyField: keyof UserSettings) => {
    const apiKey = settings[keyField];
    if (!apiKey) return;

    setTestingKeys(prev => ({ ...prev, [keyField]: true }));
    
    try {
      const response = await apiService.testApiKey(provider, apiKey);
      if (response.success && response.data) {
        setKeyValidation(prev => ({
          ...prev,
          [keyField]: {
            isValid: response.data!.isValid,
            error: response.data!.error
          }
        }));
      }
    } catch (error) {
      setKeyValidation(prev => ({
        ...prev,
        [keyField]: {
          isValid: false,
          error: 'Failed to test API key'
        }
      }));
    } finally {
      setTestingKeys(prev => ({ ...prev, [keyField]: false }));
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const response = await apiService.saveUserSettings(settings);
      if (response.success) {
        setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: 'error', text: response.error || 'Failed to save settings' });
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const renderValidationIcon = (keyField: keyof UserSettings) => {
    const validation = keyValidation[keyField];
    const isTesting = testingKeys[keyField];

    if (isTesting) {
      return <Loader className="h-4 w-4 text-blue-500 animate-spin" />;
    }

    if (validation) {
      return validation.isValid ? 
        <CheckCircle className="h-4 w-4 text-green-500" /> :
        <XCircle className="h-4 w-4 text-red-500" />;
    }

    return null;
  };

  // Load ElevenLabs voices once API key is validated
  useEffect(() => {
    if (settings.elevenLabsApiKey && keyValidation.elevenLabsApiKey?.isValid) {
      fetchVoices();
    }
  }, [keyValidation.elevenLabsApiKey?.isValid]);

  // Load AI models when respective API keys are validated
  useEffect(() => {
    if (settings.openaiApiKey && keyValidation.openaiApiKey?.isValid && openaiModelOptions.length === 0) {
      loadModels('openai');
    }
  }, [keyValidation.openaiApiKey?.isValid]);

  useEffect(() => {
    if (settings.geminiApiKey && keyValidation.geminiApiKey?.isValid && geminiModelOptions.length === 0) {
      loadModels('gemini');
    }
  }, [keyValidation.geminiApiKey?.isValid]);

  useEffect(() => {
    if (settings.anthropicApiKey && keyValidation.anthropicApiKey?.isValid && anthropicModelOptions.length === 0) {
      loadModels('anthropic');
    }
  }, [keyValidation.anthropicApiKey?.isValid]);

  const fetchVoices = async () => {
    if (!settings.elevenLabsApiKey) return;
    setLoadingVoices(true);
    try {
      const response = await apiService.getElevenLabsVoices(settings.elevenLabsApiKey);
      if (response.success && response.data) {
        setVoices(response.data);
      }
    } catch (err) {
      console.error('Failed to load voices', err);
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleTestVoice = async (voiceId: string) => {
    if (audio) {
      audio.pause();
      setAudio(null);
      setTestingVoice(null);
      return;
    }

    if (!settings.elevenLabsApiKey) {
      alert("Please provide an ElevenLabs API key first.");
      return;
    }

    setTestingVoice(voiceId);
    try {
      const blob = await testElevenLabsVoice({
        apiKey: settings.elevenLabsApiKey,
        voiceId,
        text: "Hello! You are listening to a preview of this voice."
      });
      const url = URL.createObjectURL(blob);
      const newAudio = new Audio(url);
      setAudio(newAudio);
      newAudio.play();
      newAudio.onended = () => {
        setTestingVoice(null);
        setAudio(null);
        URL.revokeObjectURL(url);
      };
    } catch (error) {
      console.error('Error testing voice:', error);
      alert(`Failed to test voice: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTestingVoice(null);
    }
  };

  const handleFetchVoices = async () => {
    if (!settings.elevenLabsApiKey) {
      alert('Please provide an ElevenLabs API key first.');
      return;
    }

    if (loadingVoices) return;

    fetchVoices();
  };

  const loadModels = async (provider: 'openai' | 'gemini' | 'anthropic') => {
    let apiKey = '';
    if (provider === 'openai') apiKey = settings.openaiApiKey;
    if (provider === 'gemini') apiKey = settings.geminiApiKey;
    if (provider === 'anthropic') apiKey = settings.anthropicApiKey;
    if (!apiKey) return;
    setLoadingModels(prev => ({ ...prev, [provider]: true }));
    try {
      const response = await apiService.listModels(provider, apiKey);
      if (response.success && response.data) {
        if (provider === 'openai') setOpenaiModelOptions(response.data);
        if (provider === 'gemini') setGeminiModelOptions(response.data);
        if (provider === 'anthropic') setAnthropicModelOptions(response.data);
      }
    } catch (err) {
      console.error(`Failed to load ${provider} models`, err);
    } finally {
      setLoadingModels(prev => ({ ...prev, [provider]: false }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gray-600 rounded-full">
            <SettingsIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-2">
              Configure your API keys and service integrations
            </p>
          </div>
        </div>
      </div>
      
      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-lg ${
          saveMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {saveMessage.text}
        </div>
      )}

      {/* Twilio Configuration */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3 mb-6">
          <Phone className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Twilio Configuration</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="text"
              value={settings.twilioPhone}
              onChange={(e) => handleInputChange('twilioPhone', e.target.value)}
              placeholder="+1234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account SID
            </label>
            <input
              type="password"
              value={settings.twilioAccountSid}
              onChange={(e) => handleInputChange('twilioAccountSid', e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auth Token
            </label>
            <input
              type="password"
              value={settings.twilioAuthToken}
              onChange={(e) => handleInputChange('twilioAuthToken', e.target.value)}
              placeholder="Your Twilio Auth Token"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* AI Provider Configuration */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3 mb-6">
          <Brain className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">AI Provider Configuration</h2>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI API Key
            </label>
            <div className="flex space-x-2">
              <input
                type="password"
                value={settings.openaiApiKey}
                onChange={(e) => handleInputChange('openaiApiKey', e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={() => testApiKey('openai', 'openaiApiKey')}
                disabled={!settings.openaiApiKey || testingKeys.openaiApiKey}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <TestTube className="h-4 w-4" />
                <span>Test</span>
              </button>
              <div className="flex items-center">
                {renderValidationIcon('openaiApiKey')}
              </div>
            </div>
            {keyValidation.openaiApiKey?.error && (
              <p className="text-red-600 text-sm mt-1">{keyValidation.openaiApiKey.error}</p>
            )}

            {/* OpenAI Model Selection */}
            {loadingModels['openai'] ? (
              <div className="flex items-center space-x-2 mt-2">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-gray-500 text-sm">Loading models...</span>
              </div>
            ) : (
              openaiModelOptions.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OpenAI Model
                  </label>
                  <select
                    value={settings.openaiModel}
                    onChange={(e) => handleInputChange('openaiModel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {openaiModelOptions.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                </div>
              )
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Gemini API Key
            </label>
            <div className="flex space-x-2">
              <input
                type="password"
                value={settings.geminiApiKey}
                onChange={(e) => handleInputChange('geminiApiKey', e.target.value)}
                placeholder="AI..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={() => testApiKey('gemini', 'geminiApiKey')}
                disabled={!settings.geminiApiKey || testingKeys.geminiApiKey}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <TestTube className="h-4 w-4" />
                <span>Test</span>
              </button>
              <div className="flex items-center">
                {renderValidationIcon('geminiApiKey')}
              </div>
            </div>
            {keyValidation.geminiApiKey?.error && (
              <p className="text-red-600 text-sm mt-1">{keyValidation.geminiApiKey.error}</p>
            )}

            {/* Gemini Model Selection */}
            {loadingModels['gemini'] ? (
              <div className="flex items-center space-x-2 mt-2">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-gray-500 text-sm">Loading models...</span>
              </div>
            ) : (
              geminiModelOptions.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gemini Model
                  </label>
                  <select
                    value={settings.geminiModel}
                    onChange={(e) => handleInputChange('geminiModel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {geminiModelOptions.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                </div>
              )
            )}
          </div>
          {/* Anthropic API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anthropic API Key
            </label>
            <div className="flex space-x-2">
              <input
                type="password"
                value={settings.anthropicApiKey}
                onChange={(e) => handleInputChange('anthropicApiKey', e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={() => testApiKey('anthropic', 'anthropicApiKey')}
                disabled={!settings.anthropicApiKey || testingKeys.anthropicApiKey}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <TestTube className="h-4 w-4" />
                <span>Test</span>
              </button>
              <div className="flex items-center">
                {renderValidationIcon('anthropicApiKey')}
              </div>
            </div>
            {keyValidation.anthropicApiKey?.error && (
              <p className="text-red-600 text-sm mt-1">{keyValidation.anthropicApiKey.error}</p>
            )}

            {/* Anthropic Model Selection */}
            {loadingModels['anthropic'] ? (
              <div className="flex items-center space-x-2 mt-2">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-gray-500 text-sm">Loading models...</span>
              </div>
            ) : (
              anthropicModelOptions.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Anthropic Model
                  </label>
                  <select
                    value={settings.anthropicModel}
                    onChange={(e) => handleInputChange('anthropicModel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {anthropicModelOptions.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Voice Synthesis Configuration */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3 mb-6">
          <Mic className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">Voice Synthesis Configuration</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ElevenLabs API Key
            </label>
            <div className="flex space-x-2">
              <input
                type="password"
                value={settings.elevenLabsApiKey}
                onChange={(e) => handleInputChange('elevenLabsApiKey', e.target.value)}
                placeholder="Your ElevenLabs API Key"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={() => testApiKey('elevenlabs', 'elevenLabsApiKey')}
                disabled={!settings.elevenLabsApiKey || testingKeys.elevenLabsApiKey}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <TestTube className="h-4 w-4" />
                <span>Test</span>
              </button>
              <div className="flex items-center">
                {renderValidationIcon('elevenLabsApiKey')}
              </div>
            </div>
            {keyValidation.elevenLabsApiKey?.error && (
              <p className="text-red-600 text-sm mt-1">{keyValidation.elevenLabsApiKey.error}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Voice
            </label>
            {voices.length > 0 ? (
              <div className="flex items-center space-x-2">
                <select
                  value={settings.elevenLabsVoiceId}
                  onChange={(e) => handleInputChange('elevenLabsVoiceId', e.target.value)}
                  className="flex-grow w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select a voice</option>
                  {voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
                {settings.elevenLabsVoiceId && (
                  <button
                    type="button"
                    onClick={() => handleTestVoice(settings.elevenLabsVoiceId!)}
                    disabled={!!testingVoice && testingVoice !== settings.elevenLabsVoiceId}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title="Test selected voice"
                  >
                    {testingVoice === settings.elevenLabsVoiceId
                      ? <span className="h-5 w-5 block" role="img" aria-label="stop">■</span>
                      : <span className="h-5 w-5 block" role="img" aria-label="play">▶</span>
                    }
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleFetchVoices}
                disabled={loadingVoices || !settings.elevenLabsApiKey || !keyValidation.elevenLabsApiKey?.isValid}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loadingVoices ? <Loader className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                <span>{loadingVoices ? 'Loading Voices...' : 'Load Voices'}</span>
              </button>
            )}
             <p className="text-sm text-gray-500 mt-1">Select the voice for the AI assistant.</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {saving ? (
            <Loader className="h-5 w-5 animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>
    </div>
  );
};

export default Settings;