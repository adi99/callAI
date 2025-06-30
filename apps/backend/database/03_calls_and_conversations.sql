-- Calls and Conversations Tables for Voice-Enabled Ecommerce Customer Service Platform

-- Enums are now in 00_enums_and_types.sql

-- Conversations Table - Multi-turn conversation records across channels (CREATE FIRST)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Conversation identification
    conversation_key VARCHAR(255) UNIQUE, -- For external reference
    
    -- Related entities (optional associations)
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Conversation metadata
    channel conversation_channel NOT NULL,
    status conversation_status DEFAULT 'active',
    
    -- Participant information
    customer_identifier VARCHAR(255), -- Phone, email, chat ID, etc.
    customer_name VARCHAR(255),
    
    -- Conversation timing
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Conversation summary and analysis
    title VARCHAR(500), -- Auto-generated or manual title
    summary TEXT,
    primary_intent VARCHAR(255),
    resolution_status VARCHAR(255),
    
    -- AI conversation state
    ai_context JSONB, -- Persistent conversation context for AI
    conversation_history JSONB, -- Structured conversation flow
    
    -- Quality and outcome metrics
    sentiment_score DECIMAL(3,2), -- Overall conversation sentiment
    satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
    escalated_to_human BOOLEAN DEFAULT false,
    resolution_time_seconds INTEGER,
    
    -- Agent assignment (for human escalation)
    assigned_agent_id UUID, -- Reference to agent/user table when implemented
    escalation_reason TEXT,
    
    -- Metadata and tags
    tags TEXT[], -- Conversation tags for categorization
    priority_level INTEGER DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 5),
    
    -- Platform-specific data
    platform_data JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_resolution_time CHECK (resolution_time_seconds IS NULL OR resolution_time_seconds >= 0),
    CONSTRAINT valid_sentiment CHECK (sentiment_score IS NULL OR (sentiment_score >= -1 AND sentiment_score <= 1)),
    CONSTRAINT end_after_start CHECK (end_time IS NULL OR end_time >= start_time),
    CONSTRAINT activity_within_timeframe CHECK (last_activity_at BETWEEN start_time AND COALESCE(end_time, NOW() + INTERVAL '1 day'))
);

-- Calls Table - Individual phone call records (CREATE AFTER conversations)
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    
    -- Call identification
    twilio_call_sid VARCHAR(100) UNIQUE NOT NULL,
    call_id VARCHAR(100) UNIQUE, -- Internal call identifier
    
    -- Related entities (optional associations)
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Call participants
    from_phone VARCHAR(20) NOT NULL,
    to_phone VARCHAR(20) NOT NULL,
    direction call_direction NOT NULL,
    
    -- Call timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Call status and outcome
    status call_status DEFAULT 'initiated',
    
    -- Recording and transcription
    recording_url TEXT,
    recording_sid VARCHAR(100),
    transcript TEXT,
    transcript_confidence DECIMAL(3,2), -- 0.00 to 1.00
    
    -- AI and conversation data
    ai_summary TEXT,
    intent_detected VARCHAR(255),
    sentiment_score DECIMAL(3,2), -- -1.00 to 1.00
    satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
    
    -- Call quality metrics
    quality_score DECIMAL(3,2), -- 0.00 to 1.00
    dropped_call BOOLEAN DEFAULT false,
    
    -- Platform-specific data
    twilio_data JSONB,
    ai_context JSONB, -- LLM conversation context
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_phone_numbers CHECK (
        from_phone ~* '^\+[1-9]\d{1,14}$' AND 
        to_phone ~* '^\+[1-9]\d{1,14}$'
    ),
    CONSTRAINT valid_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    CONSTRAINT valid_confidence CHECK (transcript_confidence IS NULL OR (transcript_confidence >= 0 AND transcript_confidence <= 1)),
    CONSTRAINT valid_sentiment CHECK (sentiment_score IS NULL OR (sentiment_score >= -1 AND sentiment_score <= 1)),
    CONSTRAINT valid_quality CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)),
    CONSTRAINT end_after_start CHECK (end_time IS NULL OR end_time >= start_time)
);

-- Messages Table - Individual messages within conversations
CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Message identification and ordering
    message_index INTEGER NOT NULL, -- Sequential order within conversation
    external_message_id VARCHAR(255), -- ID from external platform
    
    -- Message metadata
    role message_role NOT NULL,
    type message_type DEFAULT 'text',
    
    -- Message content
    content TEXT NOT NULL,
    content_type VARCHAR(100) DEFAULT 'text/plain',
    
    -- Media attachments
    attachments JSONB, -- URLs and metadata for files, images, audio
    
    -- AI-specific data
    ai_model VARCHAR(100), -- Which AI model generated this message
    ai_prompt TEXT, -- The prompt used to generate AI response
    ai_metadata JSONB, -- Token usage, confidence, etc.
    
    -- Message processing
    processed_at TIMESTAMPTZ,
    processing_time_ms INTEGER,
    
    -- Message analysis
    intent VARCHAR(255),
    entities JSONB, -- Extracted entities (names, dates, order numbers, etc.)
    sentiment_score DECIMAL(3,2),
    
    -- External platform data
    platform_data JSONB,
    
    -- Timestamps
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(conversation_id, message_index),
    CONSTRAINT valid_sentiment CHECK (sentiment_score IS NULL OR (sentiment_score >= -1 AND sentiment_score <= 1)),
    CONSTRAINT valid_processing_time CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0),
    CONSTRAINT non_empty_content CHECK (length(trim(content)) > 0)
);

-- Call Analytics Table - Aggregated call metrics and insights
CREATE TABLE call_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Time period for analytics
    date_period DATE NOT NULL,
    hour_period INTEGER CHECK (hour_period BETWEEN 0 AND 23),
    
    -- Call volume metrics
    total_calls INTEGER DEFAULT 0,
    inbound_calls INTEGER DEFAULT 0,
    outbound_calls INTEGER DEFAULT 0,
    answered_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,
    
    -- Call quality metrics
    average_duration_seconds DECIMAL(8,2),
    average_quality_score DECIMAL(3,2),
    average_satisfaction_rating DECIMAL(3,2),
    
    -- AI performance metrics
    ai_resolution_rate DECIMAL(3,2), -- Percentage resolved by AI
    human_escalation_rate DECIMAL(3,2), -- Percentage escalated to humans
    average_response_time_ms INTEGER,
    
    -- Common intents and issues
    top_intents JSONB, -- Array of intent counts
    issue_categories JSONB, -- Categorized issue counts
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(store_id, date_period, hour_period),
    CONSTRAINT valid_percentages CHECK (
        ai_resolution_rate IS NULL OR (ai_resolution_rate >= 0 AND ai_resolution_rate <= 1) AND
        human_escalation_rate IS NULL OR (human_escalation_rate >= 0 AND human_escalation_rate <= 1)
    )
);

-- Indexes for performance
CREATE INDEX idx_calls_store_id ON calls(store_id);
CREATE INDEX idx_calls_conversation_id ON calls(conversation_id);
CREATE INDEX idx_calls_twilio_call_sid ON calls(twilio_call_sid);
CREATE INDEX idx_calls_order_id ON calls(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_calls_customer_id ON calls(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_calls_direction ON calls(direction);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_start_time ON calls(start_time);
CREATE INDEX idx_calls_phone_numbers ON calls(from_phone, to_phone);

CREATE INDEX idx_conversations_store_id ON conversations(store_id);
CREATE INDEX idx_conversations_key ON conversations(conversation_key);
CREATE INDEX idx_conversations_order_id ON conversations(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_conversations_customer_id ON conversations(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_start_time ON conversations(start_time);
CREATE INDEX idx_conversations_last_activity ON conversations(last_activity_at);
CREATE INDEX idx_conversations_customer_identifier ON conversations(customer_identifier);
CREATE INDEX idx_conversations_tags ON conversations USING GIN(tags);

CREATE INDEX idx_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX idx_messages_index ON conversation_messages(message_index);
CREATE INDEX idx_messages_role ON conversation_messages(role);
CREATE INDEX idx_messages_type ON conversation_messages(type);
CREATE INDEX idx_messages_timestamp ON conversation_messages(timestamp);
CREATE INDEX idx_messages_conversation_order ON conversation_messages(conversation_id, message_index);

CREATE INDEX idx_call_analytics_store_id ON call_analytics(store_id);
CREATE INDEX idx_call_analytics_date ON call_analytics(date_period);
CREATE INDEX idx_call_analytics_store_date ON call_analytics(store_id, date_period);

-- Add updated_at triggers
CREATE TRIGGER update_calls_updated_at 
    BEFORE UPDATE ON calls 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_messages_updated_at 
    BEFORE UPDATE ON conversation_messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_analytics_updated_at 
    BEFORE UPDATE ON call_analytics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_analytics ENABLE ROW LEVEL SECURITY;

-- Trigger to update conversation last_activity_at when messages are added
CREATE OR REPLACE FUNCTION update_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_activity_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_activity_trigger
    AFTER INSERT ON conversation_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_activity();

-- Function to auto-complete conversations after inactivity
CREATE OR REPLACE FUNCTION auto_complete_inactive_conversations()
RETURNS void AS $$
BEGIN
    UPDATE conversations 
    SET status = 'completed',
        end_time = last_activity_at,
        updated_at = NOW()
    WHERE status = 'active' 
    AND last_activity_at < NOW() - INTERVAL '1 hour'
    AND channel IN ('voice', 'chat'); -- Don't auto-complete email conversations
END;
$$ language 'plpgsql';

-- Function to calculate conversation resolution time
CREATE OR REPLACE FUNCTION calculate_resolution_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('completed', 'resolved') AND OLD.status NOT IN ('completed', 'resolved') THEN
        NEW.resolution_time_seconds = EXTRACT(EPOCH FROM (NOW() - NEW.start_time))::INTEGER;
        NEW.end_time = NOW();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_resolution_time_trigger
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION calculate_resolution_time();

-- Function to update call duration when call ends
CREATE OR REPLACE FUNCTION calculate_call_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time IS NOT NULL AND OLD.end_time IS NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_call_duration_trigger
    BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION calculate_call_duration(); 