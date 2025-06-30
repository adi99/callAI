-- Stores and Settings Tables for Voice-Enabled Ecommerce Customer Service Platform

-- Enable necessary extensions is now in 00_enums_and_types.sql

-- Store Platforms Enum is now in 00_enums_and_types.sql

-- Store Status Enum is now in 00_enums_and_types.sql

-- Stores Table - Core store connection information
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL UNIQUE,
    platform store_platform NOT NULL,
    
    -- OAuth and API credentials (encrypted)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    
    -- Store configuration
    store_url TEXT,
    currency_code VARCHAR(10) DEFAULT 'USD',
    timezone VARCHAR(100) DEFAULT 'UTC',
    
    -- Connection status
    status store_status DEFAULT 'pending',
    last_sync_at TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT true,
    
    -- Store owner/contact info
    owner_email VARCHAR(255),
    owner_name VARCHAR(255),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_email CHECK (owner_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_domain CHECK (domain ~* '^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$')
);

-- Settings Categories Enum is now in 00_enums_and_types.sql

-- Settings Table - System and store-specific configuration
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Setting identification
    category setting_category NOT NULL,
    key VARCHAR(100) NOT NULL,
    
    -- Setting value (JSON for flexibility)
    value JSONB NOT NULL,
    
    -- Setting metadata
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    is_required BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(store_id, category, key)
);

-- Phone Numbers Table - Twilio phone numbers for stores
CREATE TABLE store_phone_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Phone number details
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    twilio_sid VARCHAR(100) UNIQUE,
    
    -- Status and configuration
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    
    -- Voice settings
    voice_url TEXT,
    voice_method VARCHAR(10) DEFAULT 'POST',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_phone_number CHECK (phone_number ~* '^\+[1-9]\d{1,14}$'),
    CONSTRAINT valid_voice_method CHECK (voice_method IN ('GET', 'POST'))
);

-- Indexes for performance
CREATE INDEX idx_stores_domain ON stores(domain);
CREATE INDEX idx_stores_platform ON stores(platform);
CREATE INDEX idx_stores_status ON stores(status);
CREATE INDEX idx_stores_created_at ON stores(created_at);

CREATE INDEX idx_settings_store_id ON settings(store_id);
CREATE INDEX idx_settings_category ON settings(category);
CREATE INDEX idx_settings_key ON settings(key);
CREATE INDEX idx_settings_category_key ON settings(category, key);

CREATE INDEX idx_phone_numbers_store_id ON store_phone_numbers(store_id);
CREATE INDEX idx_phone_numbers_active ON store_phone_numbers(is_active);
CREATE INDEX idx_phone_numbers_primary ON store_phone_numbers(is_primary);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_stores_updated_at 
    BEFORE UPDATE ON stores 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at 
    BEFORE UPDATE ON settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phone_numbers_updated_at 
    BEFORE UPDATE ON store_phone_numbers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies for multi-tenancy
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (to be customized based on auth strategy)
-- These would typically be based on authenticated user's store access

-- Default sample settings for new stores
CREATE OR REPLACE FUNCTION create_default_store_settings()
RETURNS TRIGGER AS $$
BEGIN
    -- Voice settings
    INSERT INTO settings (store_id, category, key, value, description) VALUES
    (NEW.id, 'voice', 'greeting_message', '"Hello! Thank you for calling. How can I help you today?"', 'Default greeting message for calls'),
    (NEW.id, 'voice', 'max_call_duration', '600', 'Maximum call duration in seconds'),
    (NEW.id, 'voice', 'voice_model', '"en-US-AriaNeural"', 'ElevenLabs voice model to use'),
    
    -- AI settings  
    (NEW.id, 'ai', 'model_provider', '"openai"', 'AI model provider (openai, anthropic)'),
    (NEW.id, 'ai', 'model_name', '"gpt-4"', 'Specific AI model to use'),
    (NEW.id, 'ai', 'max_tokens', '150', 'Maximum tokens for AI responses'),
    (NEW.id, 'ai', 'temperature', '0.7', 'AI response creativity (0-1)'),
    
    -- Integration settings
    (NEW.id, 'integration', 'sync_frequency', '300', 'Data sync frequency in seconds'),
    (NEW.id, 'integration', 'auto_sync', 'true', 'Enable automatic data synchronization'),
    
    -- General settings
    (NEW.id, 'general', 'business_hours_start', '"09:00"', 'Business hours start time'),
    (NEW.id, 'general', 'business_hours_end', '"17:00"', 'Business hours end time'),
    (NEW.id, 'general', 'timezone', '"UTC"', 'Store timezone');
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to create default settings for new stores
CREATE TRIGGER create_default_settings_trigger
    AFTER INSERT ON stores
    FOR EACH ROW EXECUTE FUNCTION create_default_store_settings(); 