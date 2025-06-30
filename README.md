# CallAI - AI-Powered Customer Service for Shopify

CallAI is an intelligent, voice-enabled customer service solution that automatically handles phone calls for your Shopify store. Using advanced AI technology, it provides 24/7 customer support with natural conversation capabilities, real-time order lookup, and seamless integration with your existing e-commerce workflow.

## 🚀 Features

### Core Capabilities
- **AI-Powered Voice Assistant**: Natural language processing with OpenAI GPT or Google Gemini
- **Real-time Voice Synthesis**: High-quality, human-like voice responses using ElevenLabs TTS
- **Shopify Integration**: Direct access to orders, products, and customer data
- **24/7 Availability**: Automated customer service that never sleeps
- **Live Call Monitoring**: Real-time dashboard to monitor active conversations
- **Call History & Analytics**: Complete transcripts and conversation logs

### Technical Features
- **Multi-turn Conversations**: Context-aware dialogue management
- **WebSocket Real-time Updates**: Live call monitoring and status updates
- **Secure OAuth Integration**: Safe connection to Shopify stores
- **Audio Streaming**: Low-latency voice processing pipeline
- **Database Logging**: Complete conversation history and analytics

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (React)       │    │   (Node.js)     │    │   Services      │
│                 │    │                 │    │                 │
│ • Dashboard     │◄──►│ • Express API   │◄──►│ • Twilio        │
│ • Call Monitor  │    │ • WebSocket     │    │ • ElevenLabs    │
│ • Store Mgmt    │    │ • Voice Pipeline│    │ • OpenAI/Gemini │
│ • Analytics     │    │ • DB Management │    │ • Shopify API   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Monorepo Structure

This project is organized as a monorepo with the following structure:

```
callai/
├── apps/
│   ├── frontend/          # React frontend application
│   │   ├── src/           # React components, pages, hooks
│   │   ├── public/        # Static assets
│   │   └── package.json   # Frontend dependencies
│   └── backend/           # Node.js backend application
│       ├── src/           # API routes, services, middleware
│       ├── database/      # Database schemas and migrations
│       └── package.json   # Backend dependencies
├── package.json           # Root workspace configuration
└── README.md              # This file
```

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **WebSocket** for real-time updates

### Backend
- **Node.js** with TypeScript
- **Express.js** web framework
- **PostgreSQL** with Supabase
- **WebSocket** for real-time communication
- **JWT** authentication

### External Services
- **Twilio** - Phone call handling
- **ElevenLabs** - Text-to-speech synthesis
- **OpenAI/Google Gemini** - AI language processing
- **Shopify API** - E-commerce integration

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ and npm
- **PostgreSQL** 14+ (or Supabase account)
- **Git**

You'll also need accounts and API keys for:
- [Twilio](https://www.twilio.com/) (for phone calls)
- [ElevenLabs](https://elevenlabs.io/) (for voice synthesis)
- [OpenAI](https://openai.com/) or [Google AI](https://ai.google.dev/) (for AI processing)
- [Shopify Partner Account](https://partners.shopify.com/) (for store integration)
- [Supabase](https://supabase.com/) (for database, optional if you have PostgreSQL)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/callai.git
cd callai
```

### 2. Install Dependencies

```bash
# Install all dependencies for the monorepo
npm install
```

### 3. Environment Setup

Create environment files for both frontend and backend:

#### Backend Environment (`.env` in `/apps/backend/`)

```bash
# Required - Core Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173

# Required - Database (Supabase)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Required - Security Keys (generate random 32+ character strings)
JWT_SECRET=your_jwt_secret_32_chars_minimum
ENCRYPTION_KEY=your_encryption_key_32_chars_minimum
API_SECRET_KEY=your_api_secret_key_32_chars_minimum

# Required for Voice Calls - Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Required for Voice Synthesis - ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_DEFAULT_VOICE_ID=your_preferred_voice_id

# Required for AI - Choose one or both
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_google_gemini_api_key

# Required for Store Integration - Shopify
SHOPIFY_CLIENT_ID=your_shopify_app_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_app_client_secret
SHOPIFY_WEBHOOK_SECRET=your_shopify_webhook_secret

# Optional - Advanced Configuration
WEBHOOK_BASE_URL=https://your-domain.com
REDIS_URL=your_redis_url
REDIS_PASSWORD=your_redis_password
```

### 4. Database Setup

If using Supabase:
1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and keys to the `.env` file
3. Run the database schema setup:

```bash
# The app will automatically create necessary tables on first run
npm run dev:backend
```

### 5. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# OR start them individually

# Start backend only
npm run dev:backend

# Start frontend only
npm run dev:frontend
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## 📱 Usage

### Initial Setup

1. **Access the Dashboard**: Open http://localhost:5173 in your browser
2. **Connect Your Shopify Store**: 
   - Click "Connect Store" 
   - Authorize the OAuth connection
   - Your store data will sync automatically

3. **Configure Voice Settings**:
   - Test your ElevenLabs voice configuration
   - Adjust AI response parameters
   - Set up custom prompts for your business

4. **Set Up Phone Number**:
   - Configure your Twilio phone number
   - Point webhook URLs to your backend
   - Test incoming call handling

### Managing Calls

- **Live Monitoring**: View active calls in real-time on the dashboard
- **Call History**: Review past conversations and transcripts
- **Analytics**: Track call volume, resolution rates, and common topics
- **Store Management**: View and manage products, orders directly from the dashboard

## 🔧 Configuration

### AI Model Configuration

The system supports multiple AI providers. Configure them in your backend environment:

```bash
# OpenAI (GPT models)
OPENAI_API_KEY=your_openai_key

# Google Gemini
GEMINI_API_KEY=your_gemini_key

# The system will automatically use available providers with fallback
```

### Voice Configuration

Customize voice settings in your environment:

```bash
# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_DEFAULT_VOICE_ID=voice_id_from_elevenlabs
ELEVENLABS_STABILITY=0.5
ELEVENLABS_SIMILARITY_BOOST=0.8
ELEVENLABS_MODEL_ID=eleven_monolingual_v1
```

### Twilio Webhook Setup

Configure your Twilio phone number to point to your backend:

1. **Voice Webhook URL**: `https://your-domain.com/api/twilio/voice`
2. **Status Callback URL**: `https://your-domain.com/api/twilio/status`

For local development, use [ngrok](https://ngrok.com/) to expose your local server:

```bash
ngrok http 3001
# Use the provided HTTPS URL for Twilio webhooks
```

## 🏗️ Development

### Available Scripts

#### Root (Monorepo)
```bash
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start frontend only
npm run dev:backend      # Start backend only
npm run build            # Build both apps
npm run build:frontend   # Build frontend only
npm run build:backend    # Build backend only
npm run start            # Start production backend
npm run lint             # Lint both apps
npm run clean            # Clean build directories
npm run install:all      # Install all dependencies
```

#### Frontend (`apps/frontend`)
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run clean        # Clean build directory
```

#### Backend (`apps/backend`)
```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm run start        # Start production server
npm run clean        # Clean build directory

# Utility Scripts
npm run generate-credentials    # Generate secure API keys
npm run validate-elevenlabs    # Test ElevenLabs configuration
npm run test-elevenlabs        # Test ElevenLabs TTS functionality
```

### API Endpoints

#### Core Endpoints
- `GET /` - API status and health check
- `GET /api/health` - Detailed health check

#### Authentication
- `POST /api/auth/shopify` - Initiate Shopify OAuth
- `GET /api/auth/shopify/callback` - Handle OAuth callback

#### Voice Processing
- `POST /api/twilio/voice` - Handle incoming Twilio calls
- `POST /api/voice/process` - Process voice input
- `GET /api/voice/status` - Get call status

#### Store Management
- `GET /api/stores` - List connected stores
- `GET /api/products` - List store products
- `GET /api/orders` - List store orders

#### Real-time Communication
- `WebSocket /ws` - Real-time call monitoring and updates

## 🚀 Production Deployment

### Environment Variables for Production

```bash
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-frontend-domain.com
WEBHOOK_BASE_URL=https://your-backend-domain.com

# All other variables same as development
# Ensure all secrets are properly secured
```

### Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure proper HTTPS certificates
- [ ] Set up proper database (not development/local)
- [ ] Configure Twilio webhooks with production URLs
- [ ] Set up monitoring and logging
- [ ] Configure CORS for production domains
- [ ] Set up backup strategies for database
- [ ] Configure rate limiting and security headers

### Recommended Hosting

- **Frontend**: Vercel, Netlify, or AWS S3 + CloudFront
- **Backend**: Railway, Render, AWS EC2, or DigitalOcean
- **Database**: Supabase, AWS RDS, or managed PostgreSQL

## 🔒 Security

- All API keys are encrypted before storage
- JWT tokens for authentication
- HTTPS required for production
- Rate limiting on API endpoints
- Input validation and sanitization
- Secure webhook signature verification

## 🐛 Troubleshooting

### Common Issues

**"Environment validation failed"**
- Ensure all required environment variables are set
- Check that keys are at least 32 characters long
- Verify API keys are valid

**"Database connection failed"**
- Check Supabase URL and keys
- Ensure database is accessible
- Verify network connectivity

**"Voice synthesis not working"**
- Verify ElevenLabs API key
- Check voice ID is valid
- Ensure sufficient API credits

**"Shopify connection failed"**
- Verify OAuth app configuration
- Check client ID and secret
- Ensure proper redirect URLs

### Debug Mode

Enable debug logging:

```bash
NODE_ENV=development
DEBUG=callai:*
```

## 📞 Support

For issues, questions, or contributions:

- **Issues**: [GitHub Issues](https://github.com/yourusername/callai/issues)
- **Documentation**: [Wiki](https://github.com/yourusername/callai/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/callai/discussions)

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Twilio](https://www.twilio.com/) for voice infrastructure
- [ElevenLabs](https://elevenlabs.io/) for voice synthesis
- [OpenAI](https://openai.com/) and [Google](https://ai.google.dev/) for AI capabilities
- [Shopify](https://www.shopify.com/) for e-commerce integration
- [Supabase](https://supabase.com/) for database and auth services

---

**Built with ❤️ for better customer service automation** 