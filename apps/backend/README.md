# Voice-Enabled Ecommerce Customer Service Backend

## Overview
This is the backend API server for the voice-enabled ecommerce customer service platform. It provides REST APIs for store integration, handles voice processing pipelines, and manages customer interactions.

## Features
- **Store Integration**: OAuth-based connections to Shopify, WooCommerce, and other ecommerce platforms
- **Voice Processing**: Integration with Twilio for call handling, ElevenLabs for TTS, and Whisper for STT
- **AI-Powered Responses**: Context-aware customer service using GPT-4 or Claude
- **Real-time Communication**: WebSocket support for live call monitoring
- **Secure API**: JWT authentication and encrypted credential storage

## Tech Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for sessions and real-time data
- **AI Services**: OpenAI GPT-4 / Anthropic Claude
- **Voice Services**: Twilio Voice API, ElevenLabs TTS

## Project Structure
```
src/
├── controllers/     # Route handlers and business logic
├── middleware/      # Express middleware (auth, validation, etc.)
├── models/         # Database models and schemas
├── routes/         # API route definitions
├── services/       # External service integrations
├── types/          # TypeScript type definitions
├── utils/          # Helper functions and utilities
└── server.ts       # Main application entry point
```

## Development

### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL 14+
- Redis 6+

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Configure your environment variables in `.env`

4. Start development server:
   ```bash
   npm run dev
   ```

### Available Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run clean` - Clean build directory

## API Endpoints
- `GET /` - API status and information
- `GET /health` - Health check endpoint
- `POST /auth/shopify` - Initiate Shopify OAuth flow
- `GET /auth/shopify/callback` - Handle Shopify OAuth callback
- `POST /api/voice/inbound` - Handle inbound Twilio calls
- `POST /api/voice/process-input` - Process voice input and generate responses

## Environment Variables
See `.env.example` for required environment variables.

## License
ISC 