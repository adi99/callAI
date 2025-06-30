# CallAI Database Schema

This directory contains the database schema files for the CallAI voice-enabled ecommerce customer service platform.

## Files Overview

- **00_enums_and_types.sql** - Contains all custom enum types and type definitions (MUST BE RUN FIRST)
- **01_stores_and_settings.sql** - Core store and configuration tables
- **02_products_and_orders.sql** - Ecommerce data tables (products, orders, customers)
- **03_calls_and_conversations.sql** - Voice communication and conversation tracking tables
- **master_schema.sql** - Complete schema with all tables, indexes, and triggers

## Execution Order in Supabase

To properly set up the database, execute the files in this specific order:

### Option 1: Run Individual Files (Recommended for Supabase)

1. **First, run the enums file:**
   ```sql
   -- Copy and paste the contents of 00_enums_and_types.sql
   -- This creates all the custom types needed by the tables
   ```

2. **Then run the table creation files in order:**
   - 01_stores_and_settings.sql
   - 02_products_and_orders.sql
   - 03_calls_and_conversations.sql

### Option 2: Run Master Schema (Alternative)

1. **First, run the enums file:**
   ```sql
   -- Copy and paste the contents of 00_enums_and_types.sql
   ```

2. **Then run the master schema:**
   ```sql
   -- Copy and paste the contents of master_schema.sql
   ```

## Important Notes

- **Enum Types Must Be Created First**: The tables depend on custom enum types. Always run `00_enums_and_types.sql` before any other file.
- **Supabase SQL Editor**: When using Supabase's SQL editor, it's often better to run files separately rather than all at once.
- **Error Prevention**: The enum file uses `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;` blocks to prevent errors if types already exist.
- **Row Level Security**: RLS is enabled on all tables but policies need to be added based on your authentication setup.

## Schema Features

- **Multi-tenancy**: All data is scoped to stores
- **Audit trails**: created_at and updated_at timestamps on all tables
- **Performance indexes**: Optimized indexes for common queries
- **Data integrity**: Foreign key constraints and check constraints
- **Business logic**: Triggers for automatic calculations and updates

## Next Steps

After setting up the schema:

1. Configure Row Level Security policies based on your auth system
2. Set up the Supabase client in your backend
3. Configure environment variables for database connection
4. Test the connection and basic CRUD operations 