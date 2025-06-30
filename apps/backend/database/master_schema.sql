-- CallAI Master Database Schema
-- Voice-Enabled Ecommerce Customer Service Platform
-- Complete schema with all tables, relationships, and constraints

-- IMPORTANT: Run 00_enums_and_types.sql FIRST before running this file!
-- The enums and types are defined separately to ensure proper creation order.

-- =============================================================================
-- CORE TABLES (Foundation)
-- =============================================================================

-- Stores Table - Core store connection information
CREATE TABLE IF NOT EXISTS stores (
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

-- Customers Table - Customer information for better service
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- External platform identifiers
    external_id VARCHAR(255) NOT NULL, -- Customer ID from platform
    
    -- Customer information
    email VARCHAR(255),
    phone VARCHAR(20),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    
    -- Customer status and preferences
    accepts_marketing BOOLEAN DEFAULT false,
    preferred_language VARCHAR(10) DEFAULT 'en',
    
    -- Customer analytics
    total_spent DECIMAL(10,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    lifetime_value DECIMAL(10,2) DEFAULT 0,
    
    -- Customer service history
    last_order_date TIMESTAMPTZ,
    last_contact_date TIMESTAMPTZ,
    
    -- Tags and categorization
    tags TEXT[], -- Customer tags
    
    -- Platform-specific data
    platform_data JSONB,
    
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash VARCHAR(64),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(store_id, external_id),
    CONSTRAINT valid_customer_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_customer_phone CHECK (phone IS NULL OR phone ~* '^\+[1-9]\d{1,14}$'),
    CONSTRAINT positive_totals CHECK (total_spent >= 0 AND total_orders >= 0 AND lifetime_value >= 0)
);

-- =============================================================================
-- STORE CONFIGURATION TABLES
-- =============================================================================

-- Settings Table - System and store-specific configuration
CREATE TABLE IF NOT EXISTS settings (
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
CREATE TABLE IF NOT EXISTS store_phone_numbers (
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

-- =============================================================================
-- ECOMMERCE DATA TABLES
-- =============================================================================

-- Products Table - Synced product catalog from ecommerce platforms
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- External platform identifiers
    external_id VARCHAR(255) NOT NULL, -- Product ID from platform
    external_variant_id VARCHAR(255), -- Variant ID if applicable
    
    -- Basic product information
    title VARCHAR(500) NOT NULL,
    description TEXT,
    handle VARCHAR(255), -- URL handle/slug
    
    -- Product categorization
    product_type VARCHAR(255),
    vendor VARCHAR(255),
    tags TEXT[], -- Array of tags
    
    -- Pricing information
    price DECIMAL(10,2) NOT NULL,
    compare_at_price DECIMAL(10,2),
    cost_per_item DECIMAL(10,2),
    currency_code VARCHAR(10) DEFAULT 'USD',
    
    -- Inventory management
    sku VARCHAR(255),
    barcode VARCHAR(255),
    inventory_quantity INTEGER DEFAULT 0,
    inventory_tracked BOOLEAN DEFAULT false,
    availability product_availability DEFAULT 'in_stock',
    
    -- Physical properties
    weight DECIMAL(8,3),
    weight_unit VARCHAR(10) DEFAULT 'kg',
    
    -- SEO and metadata
    seo_title VARCHAR(255),
    seo_description TEXT,
    
    -- Platform-specific data (JSON for flexibility)
    platform_data JSONB,
    
    -- Status and sync
    status product_status DEFAULT 'active',
    is_published BOOLEAN DEFAULT true,
    published_at TIMESTAMPTZ,
    
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash VARCHAR(64), -- For detecting changes
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(store_id, external_id),
    CONSTRAINT positive_price CHECK (price >= 0),
    CONSTRAINT positive_inventory CHECK (inventory_quantity >= 0)
);

-- Product Images Table
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Image details
    external_id VARCHAR(255),
    url TEXT NOT NULL,
    alt_text VARCHAR(255),
    position INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_url CHECK (url ~* '^https?://.*')
);

-- Orders Table - Customer orders from ecommerce platforms
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- External platform identifiers
    external_id VARCHAR(255) NOT NULL, -- Order ID from platform
    order_number VARCHAR(255), -- Human-readable order number
    
    -- Customer information (denormalized for easier access)
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_first_name VARCHAR(255),
    customer_last_name VARCHAR(255),
    customer_external_id VARCHAR(255), -- Customer ID from platform
    
    -- Order totals
    subtotal_price DECIMAL(10,2) NOT NULL,
    total_tax DECIMAL(10,2) DEFAULT 0,
    total_shipping DECIMAL(10,2) DEFAULT 0,
    total_discounts DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL,
    currency_code VARCHAR(10) DEFAULT 'USD',
    
    -- Order status tracking
    status order_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'pending',
    fulfillment_status fulfillment_status DEFAULT 'unfulfilled',
    
    -- Shipping information
    shipping_address JSONB,
    billing_address JSONB,
    shipping_method VARCHAR(255),
    tracking_number VARCHAR(255),
    tracking_url TEXT,
    
    -- Important dates
    order_date TIMESTAMPTZ NOT NULL,
    shipped_date TIMESTAMPTZ,
    delivered_date TIMESTAMPTZ,
    cancelled_date TIMESTAMPTZ,
    
    -- Platform-specific data
    platform_data JSONB,
    
    -- Notes and communication
    customer_notes TEXT,
    internal_notes TEXT,
    
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash VARCHAR(64),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(store_id, external_id),
    CONSTRAINT positive_totals CHECK (subtotal_price >= 0 AND total_price >= 0),
    CONSTRAINT valid_customer_email CHECK (customer_email IS NULL OR customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Order Line Items Table - Individual products within orders
CREATE TABLE IF NOT EXISTS order_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    -- External identifiers
    external_id VARCHAR(255),
    external_product_id VARCHAR(255),
    external_variant_id VARCHAR(255),
    
    -- Product details (snapshot at time of order)
    title VARCHAR(500) NOT NULL,
    variant_title VARCHAR(255),
    sku VARCHAR(255),
    
    -- Pricing and quantity
    price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Product properties at time of purchase
    properties JSONB, -- Custom properties/options
    
    -- Fulfillment tracking
    fulfillment_status fulfillment_status DEFAULT 'unfulfilled',
    fulfilled_quantity INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_price_quantity CHECK (price >= 0 AND quantity > 0),
    CONSTRAINT positive_fulfilled_quantity CHECK (fulfilled_quantity >= 0 AND fulfilled_quantity <= quantity)
);

-- =============================================================================
-- COMMUNICATION AND SUPPORT TABLES
-- =============================================================================

-- Conversations Table - Multi-turn conversation records across channels
CREATE TABLE IF NOT EXISTS conversations (
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

-- Calls Table - Individual phone call records
CREATE TABLE IF NOT EXISTS calls (
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
CREATE TABLE IF NOT EXISTS conversation_messages (
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
CREATE TABLE IF NOT EXISTS call_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Time period for analytics
    date_period DATE NOT NULL,
    hour_period INTEGER CHECK (hour_period >= 0 AND hour_period <= 23),
    
    -- Call volume metrics
    total_calls INTEGER DEFAULT 0,
    inbound_calls INTEGER DEFAULT 0,
    outbound_calls INTEGER DEFAULT 0,
    
    -- Call outcome metrics
    answered_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,
    dropped_calls INTEGER DEFAULT 0,
    
    -- Call quality metrics
    average_call_duration DECIMAL(8,2), -- Average duration in seconds
    average_quality_score DECIMAL(3,2),
    average_satisfaction_rating DECIMAL(3,2),
    
    -- AI performance metrics
    ai_resolution_rate DECIMAL(5,2), -- Percentage of calls resolved by AI
    human_escalation_rate DECIMAL(5,2), -- Percentage escalated to humans
    average_response_time_ms INTEGER,
    
    -- Intent and outcome analysis
    top_intents JSONB, -- Most common customer intents
    resolution_categories JSONB, -- Types of issues resolved
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(store_id, date_period, hour_period),
    CONSTRAINT valid_percentages CHECK (
        ai_resolution_rate IS NULL OR (ai_resolution_rate >= 0 AND ai_resolution_rate <= 100) AND
        human_escalation_rate IS NULL OR (human_escalation_rate >= 0 AND human_escalation_rate <= 100)
    ),
    CONSTRAINT valid_call_counts CHECK (
        total_calls >= 0 AND inbound_calls >= 0 AND outbound_calls >= 0 AND
        answered_calls >= 0 AND missed_calls >= 0 AND dropped_calls >= 0
    )
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Store indexes
CREATE INDEX IF NOT EXISTS idx_stores_domain ON stores(domain);
CREATE INDEX IF NOT EXISTS idx_stores_platform ON stores(platform);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
CREATE INDEX IF NOT EXISTS idx_stores_created_at ON stores(created_at);

-- Settings indexes
CREATE INDEX IF NOT EXISTS idx_settings_store_id ON settings(store_id);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category_key ON settings(category, key);

-- Phone numbers indexes
CREATE INDEX IF NOT EXISTS idx_phone_numbers_store_id ON store_phone_numbers(store_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_active ON store_phone_numbers(is_active);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_primary ON store_phone_numbers(is_primary);

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_external_id ON customers(external_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_last_order_date ON customers(last_order_date);
CREATE INDEX IF NOT EXISTS idx_customers_tags ON customers USING GIN(tags);

-- Product indexes
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_external_id ON products(external_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_availability ON products(availability);
CREATE INDEX IF NOT EXISTS idx_products_last_synced ON products(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN(tags);

-- Product image indexes
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_position ON product_images(position);

-- Order indexes
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_external_id ON orders(external_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_last_synced ON orders(last_synced_at);

-- Order line item indexes
CREATE INDEX IF NOT EXISTS idx_order_line_items_order_id ON order_line_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_product_id ON order_line_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_external_product_id ON order_line_items(external_product_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_sku ON order_line_items(sku) WHERE sku IS NOT NULL;

-- Call indexes
CREATE INDEX IF NOT EXISTS idx_calls_store_id ON calls(store_id);
CREATE INDEX IF NOT EXISTS idx_calls_conversation_id ON calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_calls_twilio_call_sid ON calls(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_order_id ON calls(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_customer_id ON calls(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_start_time ON calls(start_time);
CREATE INDEX IF NOT EXISTS idx_calls_phone_numbers ON calls(from_phone, to_phone);

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversations_store_id ON conversations(store_id);
CREATE INDEX IF NOT EXISTS idx_conversations_key ON conversations(conversation_key);
CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON conversations(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_start_time ON conversations(start_time);
CREATE INDEX IF NOT EXISTS idx_conversations_last_activity ON conversations(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_identifier ON conversations(customer_identifier);
CREATE INDEX IF NOT EXISTS idx_conversations_tags ON conversations USING GIN(tags);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_index ON conversation_messages(message_index);
CREATE INDEX IF NOT EXISTS idx_messages_role ON conversation_messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_type ON conversation_messages(type);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON conversation_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_order ON conversation_messages(conversation_id, message_index);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_call_analytics_store_id ON call_analytics(store_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_date ON call_analytics(date_period);
CREATE INDEX IF NOT EXISTS idx_call_analytics_store_date ON call_analytics(store_id, date_period);

-- =============================================================================
-- TRIGGERS AND FUNCTIONS
-- =============================================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers for all tables
CREATE TRIGGER update_stores_updated_at 
    BEFORE UPDATE ON stores 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at 
    BEFORE UPDATE ON settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phone_numbers_updated_at 
    BEFORE UPDATE ON store_phone_numbers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_line_items_updated_at 
    BEFORE UPDATE ON order_line_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Customer lifetime value calculation
CREATE OR REPLACE FUNCTION update_customer_lifetime_value()
RETURNS TRIGGER AS $$
BEGIN
    -- Update customer statistics when orders change
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE customers 
        SET 
            total_spent = COALESCE((
                SELECT SUM(total_price) 
                FROM orders 
                WHERE customer_id = NEW.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0),
            total_orders = COALESCE((
                SELECT COUNT(*) 
                FROM orders 
                WHERE customer_id = NEW.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0),
            last_order_date = (
                SELECT MAX(order_date) 
                FROM orders 
                WHERE customer_id = NEW.customer_id
            ),
            lifetime_value = COALESCE((
                SELECT SUM(total_price) 
                FROM orders 
                WHERE customer_id = NEW.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0)
        WHERE id = NEW.customer_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE customers 
        SET 
            total_spent = COALESCE((
                SELECT SUM(total_price) 
                FROM orders 
                WHERE customer_id = OLD.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0),
            total_orders = COALESCE((
                SELECT COUNT(*) 
                FROM orders 
                WHERE customer_id = OLD.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0),
            last_order_date = (
                SELECT MAX(order_date) 
                FROM orders 
                WHERE customer_id = OLD.customer_id
            ),
            lifetime_value = COALESCE((
                SELECT SUM(total_price) 
                FROM orders 
                WHERE customer_id = OLD.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0)
        WHERE id = OLD.customer_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customer_ltv_trigger
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_customer_lifetime_value();

-- Conversation activity tracking
CREATE OR REPLACE FUNCTION update_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_activity_at = NEW.timestamp
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_activity_trigger
    AFTER INSERT ON conversation_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_activity();

-- Auto-complete inactive conversations
CREATE OR REPLACE FUNCTION auto_complete_inactive_conversations()
RETURNS void AS $$
BEGIN
    UPDATE conversations 
    SET 
        status = 'completed',
        end_time = last_activity_at
    WHERE 
        status = 'active' 
        AND last_activity_at < NOW() - INTERVAL '1 hour';
END;
$$ language 'plpgsql';

-- Calculate resolution time
CREATE OR REPLACE FUNCTION calculate_resolution_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('completed', 'resolved') AND OLD.status NOT IN ('completed', 'resolved') THEN
        NEW.resolution_time_seconds = EXTRACT(EPOCH FROM (COALESCE(NEW.end_time, NOW()) - NEW.start_time));
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_resolution_time_trigger
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION calculate_resolution_time();

-- Calculate call duration
CREATE OR REPLACE FUNCTION calculate_call_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time IS NOT NULL AND OLD.end_time IS NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time));
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_call_duration_trigger
    BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION calculate_call_duration();

-- Default settings creation for new stores
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

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) SETUP
-- =============================================================================

-- Enable RLS on all tables for multi-tenancy
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_analytics ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SAMPLE DATA AND INITIAL SETUP
-- =============================================================================

-- Note: RLS policies and sample data would be added here based on 
-- the specific authentication and authorization requirements
-- These will be implemented when the authentication system is in place

-- Schema creation complete
-- Total tables: 12 core tables
-- Total indexes: 50+ performance indexes  
-- Total triggers: 10+ business logic triggers
-- Total functions: 8 utility and business functions 
 