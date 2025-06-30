# Quick Setup Guide - User Settings

## Create the Database Table

Since the test shows the `user_settings` table doesn't exist yet, you need to create it in your Supabase database.

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste this SQL:

```sql
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
```

6. Click **Run** to execute the SQL
7. You should see "Success. No rows returned" message

### Option 2: Using the File

Alternatively, you can run the SQL file directly:

1. Open `backend/database/05_user_settings.sql`
2. Copy the entire content
3. Paste it in Supabase SQL Editor and run

## Test the Setup

After creating the table, run the test again:

```bash
cd backend
npm run test-settings
```

You should now see:
```
✅ Database: Connected
✅ Encryption/Decryption: Working  
✅ Table check: Table exists and accessible
✅ Insert: Success
✅ Retrieval: Success
✅ Decryption: Success
✅ Cleanup: Complete
```

## Start the Application

Once the table is created:

1. **Start the backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend:** (in a new terminal)
   ```bash
   npm run dev
   ```

3. **Access Settings:**
   - Open http://localhost:5173/settings
   - Configure your API keys
   - Test and save your settings

## Troubleshooting

**If you see "relation does not exist" error:**
- Make sure you ran the SQL in the correct Supabase project
- Check that you're connected to the right database
- Verify your `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`

**If encryption fails:**
- Make sure you have `ENCRYPTION_KEY` set in your `.env` file
- Generate keys with: `npm run generate-credentials`

**If API key testing fails:**
- Check your internet connection
- Verify the API key format is correct
- Ensure the service (OpenAI/Gemini/ElevenLabs) is accessible

That's it! Your settings functionality should now be fully working. 🎉 