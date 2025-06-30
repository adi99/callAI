# Settings Setup Guide

This guide explains how to set up and use the new user settings functionality in CallAI.

## What's New

The Settings page now allows users to:
- Configure Twilio phone number and credentials
- Add OpenAI and Google Gemini API keys
- Set up ElevenLabs voice synthesis
- Test API keys for validity
- Save all settings securely (encrypted)

## Backend Setup

### 1. Database Migration

The user settings are stored in a new `user_settings` table. To create this table:

```bash
cd backend
npm run test-settings
```

This will:
- Test database connectivity
- Create the `user_settings` table
- Test encryption/decryption
- Verify CRUD operations

### 2. Environment Variables

Make sure your backend `.env` file has the required encryption keys:

```bash
# Required for settings encryption
ENCRYPTION_KEY=your_32_character_encryption_key_here
JWT_SECRET=your_32_character_jwt_secret_here
API_SECRET_KEY=your_32_character_api_secret_here
```

Generate secure keys if you don't have them:

```bash
npm run generate-credentials
```

## Frontend Usage

### 1. Access Settings

Navigate to the Settings page in your CallAI dashboard:
- URL: `http://localhost:5173/settings`
- Or click "Settings" in the sidebar

### 2. Configure Services

#### Twilio Configuration
- **Phone Number**: Your Twilio phone number (e.g., +1234567890)
- **Account SID**: Your Twilio Account SID (starts with AC...)
- **Auth Token**: Your Twilio Auth Token

#### AI Provider Configuration
- **OpenAI API Key**: Your OpenAI API key (starts with sk-...)
- **Google Gemini API Key**: Your Google AI API key (starts with AI...)

Each API key has a "Test" button to verify validity.

#### Voice Synthesis Configuration
- **ElevenLabs API Key**: Your ElevenLabs API key
- **Voice ID**: The voice ID from ElevenLabs you want to use

### 3. Save Settings

Click "Save Settings" to store all configurations securely. Settings are:
- Encrypted before storage
- Tied to your user session
- Automatically loaded when you return

## API Endpoints

The settings functionality adds these new endpoints:

- `GET /api/settings` - Get user settings
- `POST /api/settings` - Save user settings
- `POST /api/settings/test-api-key` - Test API key validity

## Security Features

- **Encryption**: All sensitive data (API keys, tokens) are encrypted using AES-256
- **User Isolation**: Settings are tied to user sessions/IDs
- **Validation**: API keys are tested against their respective services
- **No Logging**: Sensitive data is never logged in plain text

## Testing

### Backend Test
```bash
cd backend
npm run test-settings
```

### Manual Testing
1. Open the Settings page
2. Add test API keys
3. Click "Test" buttons to verify
4. Save settings
5. Refresh page to confirm persistence

## Troubleshooting

### "Failed to save settings"
- Check database connection
- Verify encryption keys are set
- Check backend logs for detailed errors

### "Failed to test API key"
- Verify the API key format
- Check internet connectivity
- Ensure the service (OpenAI/Gemini/ElevenLabs) is accessible

### "Settings not loading"
- Check if user_settings table exists
- Verify database permissions
- Check network connection to backend

## Development Notes

### Adding New Settings
To add new settings fields:

1. Update the `UserSettings` interface in `src/services/api.ts`
2. Add the field to the database table
3. Update the Settings component form
4. Add encryption/decryption logic if sensitive

### Database Schema
```sql
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    twilio_phone VARCHAR(20),
    twilio_account_sid TEXT, -- encrypted
    twilio_auth_token TEXT,  -- encrypted
    openai_api_key TEXT,     -- encrypted
    gemini_api_key TEXT,     -- encrypted
    elevenlabs_api_key TEXT, -- encrypted
    elevenlabs_voice_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Next Steps

Future enhancements could include:
- User authentication integration
- Settings export/import
- Team/organization settings
- Advanced voice configuration options
- Integration with more AI providers 