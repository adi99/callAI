-- User Settings Table
-- Stores encrypted API keys and configuration for individual users

CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Twilio Configuration
    twilio_phone VARCHAR(20),
    twilio_account_sid TEXT, -- encrypted
    twilio_auth_token TEXT,  -- encrypted
    
    -- AI Provider API Keys (encrypted)
    openai_api_key TEXT,
    gemini_api_key TEXT,
    
    -- Voice Synthesis Configuration
    elevenlabs_api_key TEXT, -- encrypted
    elevenlabs_voice_id VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at);

-- Comments for documentation
COMMENT ON TABLE user_settings IS 'Stores encrypted user-specific API keys and configuration settings';
COMMENT ON COLUMN user_settings.user_id IS 'Unique identifier for the user (can be session-based or actual user ID)';
COMMENT ON COLUMN user_settings.twilio_phone IS 'User configured Twilio phone number';
COMMENT ON COLUMN user_settings.twilio_account_sid IS 'Encrypted Twilio Account SID';
COMMENT ON COLUMN user_settings.twilio_auth_token IS 'Encrypted Twilio Auth Token';
COMMENT ON COLUMN user_settings.openai_api_key IS 'Encrypted OpenAI API key';
COMMENT ON COLUMN user_settings.gemini_api_key IS 'Encrypted Google Gemini API key';
COMMENT ON COLUMN user_settings.elevenlabs_api_key IS 'Encrypted ElevenLabs API key';
COMMENT ON COLUMN user_settings.elevenlabs_voice_id IS 'ElevenLabs voice ID (not encrypted)'; 