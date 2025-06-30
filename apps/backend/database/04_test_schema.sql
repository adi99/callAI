-- CallAI Database Schema Test
-- Run this file after setting up the schema to verify everything is working

-- Test 1: Check if all custom types were created
DO $$
BEGIN
    -- Check store related types
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_platform')), 'store_platform type not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_status')), 'store_status type not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'setting_category')), 'setting_category type not found';
    
    -- Check product related types
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status')), 'product_status type not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_availability')), 'product_availability type not found';
    
    -- Check order related types
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status')), 'order_status type not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status')), 'payment_status type not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_status')), 'fulfillment_status type not found';
    
    -- Check communication types
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_direction')), 'call_direction type not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_status')), 'call_status type not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_channel')), 'conversation_channel type not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_status')), 'conversation_status type not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_role')), 'message_role type not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type')), 'message_type type not found';
    
    RAISE NOTICE 'All custom types created successfully!';
END $$;

-- Test 2: Check if all tables were created
DO $$
BEGIN
    -- Core tables
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stores')), 'stores table not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings')), 'settings table not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_phone_numbers')), 'store_phone_numbers table not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers')), 'customers table not found';
    
    -- Product tables
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products')), 'products table not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_images')), 'product_images table not found';
    
    -- Order tables
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders')), 'orders table not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_line_items')), 'order_line_items table not found';
    
    -- Communication tables
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations')), 'conversations table not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls')), 'calls table not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_messages')), 'conversation_messages table not found';
    ASSERT (SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'call_analytics')), 'call_analytics table not found';
    
    RAISE NOTICE 'All tables created successfully!';
END $$;

-- Test 3: Create a test store
INSERT INTO stores (name, domain, platform, status, owner_email, owner_name)
VALUES ('Test Store', 'test-store.com', 'shopify', 'pending', 'test@example.com', 'Test Owner')
ON CONFLICT (domain) DO NOTHING;

-- Test 4: Verify triggers work (default settings should be created)
DO $$
DECLARE
    test_store_id UUID;
    settings_count INTEGER;
BEGIN
    -- Get the test store ID
    SELECT id INTO test_store_id FROM stores WHERE domain = 'test-store.com' LIMIT 1;
    
    IF test_store_id IS NOT NULL THEN
        -- Count settings created by trigger
        SELECT COUNT(*) INTO settings_count FROM settings WHERE store_id = test_store_id;
        
        ASSERT settings_count > 0, 'Default settings trigger did not create any settings';
        RAISE NOTICE 'Default settings created: % settings', settings_count;
        
        -- Clean up test data
        DELETE FROM stores WHERE id = test_store_id;
        RAISE NOTICE 'Test data cleaned up';
    ELSE
        RAISE NOTICE 'Test store was not created (may already exist)';
    END IF;
END $$;

-- Test 5: Display schema summary
SELECT 
    'Custom Types' as category,
    COUNT(*) as count
FROM pg_type 
WHERE typname IN (
    'store_platform', 'store_status', 'setting_category',
    'product_status', 'product_availability',
    'order_status', 'payment_status', 'fulfillment_status',
    'call_direction', 'call_status', 
    'conversation_channel', 'conversation_status',
    'message_role', 'message_type'
)
UNION ALL
SELECT 
    'Tables' as category,
    COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name IN (
    'stores', 'settings', 'store_phone_numbers', 'customers',
    'products', 'product_images', 'orders', 'order_line_items',
    'conversations', 'calls', 'conversation_messages', 'call_analytics'
)
UNION ALL
SELECT 
    'Indexes' as category,
    COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public'
AND tablename IN (
    'stores', 'settings', 'store_phone_numbers', 'customers',
    'products', 'product_images', 'orders', 'order_line_items',
    'conversations', 'calls', 'conversation_messages', 'call_analytics'
)
UNION ALL
SELECT 
    'Triggers' as category,
    COUNT(*) as count
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY category;

-- If all tests pass, you should see:
-- 1. "All custom types created successfully!"
-- 2. "All tables created successfully!"
-- 3. A summary showing counts of types, tables, indexes, and triggers 