# Supabase Database Setup Guide

## Prerequisites
1. Supabase account and project created
2. Access to Supabase SQL Editor

## Steps to Execute Database Schema

### Step 1: Run Enums and Types (MUST BE FIRST)
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the entire content of `00_enums_and_types.sql`
3. Click "Run" - this creates all the custom types needed

### Step 2: Run Schema Files in Order
Execute these files in the following order:

1. **Stores and Settings Schema**
   - Copy content from `01_stores_and_settings.sql`
   - Paste in SQL Editor and run

2. **Products and Orders Schema** 
   - Copy content from `02_products_and_orders.sql`
   - Paste in SQL Editor and run

3. **Calls and Conversations Schema**
   - Copy content from `03_calls_and_conversations.sql`
   - Paste in SQL Editor and run

### Step 3: Verify Setup
- Check that all tables are created in Supabase Dashboard → Table Editor
- Expected tables:
  - stores, store_integrations, settings
  - products, product_variants, orders, order_line_items, customers
  - calls, conversations, conversation_messages

### Step 4: Test Connection
- Update backend/.env with your Supabase credentials:
  ```
  SUPABASE_URL=your_project_url
  SUPABASE_ANON_KEY=your_anon_key
  ```
- Run backend application and test database connection

## Alternative: Single Script Execution
If you prefer to run everything at once, use the `master_schema.sql` file (after running enums first).

## Important Notes
- Always run `00_enums_and_types.sql` FIRST
- The enum file uses error-safe blocks to prevent duplicate type errors
- All tables have Row Level Security enabled but no policies yet
- Timestamps and audit fields are automatically managed 