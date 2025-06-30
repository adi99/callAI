-- CallAI Database Enums and Types
-- This file must be run FIRST before any table creation
-- Contains all custom types and enums used throughout the schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS AND TYPES
-- =============================================================================

-- Store related enums
DO $$ BEGIN
    CREATE TYPE store_platform AS ENUM ('shopify', 'woocommerce', 'magento', 'bigcommerce', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE store_status AS ENUM ('connected', 'disconnected', 'error', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE setting_category AS ENUM ('voice', 'ai', 'integration', 'notification', 'security', 'general');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Product related enums
DO $$ BEGIN
    CREATE TYPE product_status AS ENUM ('active', 'draft', 'archived', 'discontinued');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE product_availability AS ENUM ('in_stock', 'out_of_stock', 'low_stock', 'backorder', 'discontinued');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Order related enums
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'returned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fulfillment_status AS ENUM ('unfulfilled', 'partial', 'fulfilled', 'restocked', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Communication related enums
DO $$ BEGIN
    CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE call_status AS ENUM ('initiated', 'ringing', 'answered', 'completed', 'failed', 'busy', 'no_answer', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE conversation_channel AS ENUM ('voice', 'chat', 'email', 'sms', 'whatsapp');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE conversation_status AS ENUM ('active', 'paused', 'completed', 'escalated', 'abandoned', 'resolved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_role AS ENUM ('customer', 'ai_assistant', 'human_agent', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_type AS ENUM ('text', 'audio', 'image', 'file', 'system_event', 'action_result');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$; 