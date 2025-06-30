import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
const session = require('express-session');
import { createServer } from 'http';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { requestLogger, devLogger } from './middleware/requestLogger';
import { securityMiddleware } from './middleware/security';
import { DatabaseService } from './services/database';
import { LLMService } from './services/llmService';
import { AudioStreamService } from './services/audioStreamService';
import { AudioRecordingService } from './services/audioRecordingService';
import { SpeechToTextService } from './services/speechToTextService';
import { TranscriptionProcessorService } from './services/transcriptionProcessorService';
import { EnvValidator } from './utils/envValidator';
import { DashboardWebSocketService } from './services/dashboardWebSocketService';

// Extend express-session with custom SessionData
declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
    shopDomain?: string;
  }
}

dotenv.config();

const app = express();
const server = createServer(app); // Create HTTP server for WebSocket integration
const PORT = process.env.PORT || 3001;

// Validate environment variables on startup
try {
  const envValidation = EnvValidator.validate();
  if (!envValidation.isValid) {
    console.error('❌ Environment validation failed:');
    envValidation.missing.forEach(missing => {
      console.error(`   - Missing: ${missing}`);
    });
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  if (envValidation.warnings.length > 0) {
    console.warn('⚠️  Environment warnings:');
    envValidation.warnings.forEach(warning => {
      console.warn(`   - ${warning}`);
    });
  }
} catch (error) {
  console.error('❌ Fatal environment error:', error instanceof Error ? error.message : error);
  process.exit(1);
}

// Security middleware
app.use(securityMiddleware);

// Session middleware for OAuth state management
app.use(session({
  secret: process.env.JWT_SECRET || 'fallback-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 2 // 2 hours
  }
}));

// Logging middleware
app.use(devLogger);
app.use(requestLogger);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Voice-Enabled Ecommerce Customer Service API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      websockets: 'enabled',
      audioStreaming: 'enabled',
      audioRecording: 'enabled',
      speechToText: 'enabled'
    }
  });
});

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Database connection test and server start
const startServer = async () => {
  try {
    const dbService = DatabaseService.getInstance();
    const isConnected = await dbService.testConnection();
    
    if (!isConnected) {
      console.warn('⚠️  Database connection test failed. Please check your Supabase configuration.');
      console.warn('   Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set correctly.');
    }

    // Initialize LLM Service with available providers
    const envConfig = EnvValidator.getConfig();
    let llmInitialized = false;
    
    const providerConfig: any = {
      maxTokens: 500,
      temperature: 0.7
    };

    // Check for OpenAI API key
    if (envConfig.OPENAI_API_KEY) {
      providerConfig.openai = {
        apiKey: envConfig.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo'
      };
    }

    // Check for Gemini API key
    if (envConfig.GEMINI_API_KEY || envConfig.GOOGLE_API_KEY) {
      providerConfig.gemini = {
        apiKey: envConfig.GEMINI_API_KEY || envConfig.GOOGLE_API_KEY,
        model: 'gemini-2.5-flash'
      };
    }

    // Initialize LLM Service if at least one provider is available
    if (providerConfig.openai || providerConfig.gemini) {
      try {
        const llmService = LLMService.getInstance();
        llmService.initialize(providerConfig);
        
        const availableProviders = llmService.getAvailableProviders();
        llmInitialized = true;
        console.log(`🤖 LLM Service: ✅ Initialized with ${availableProviders.join(', ').toUpperCase()}`);
      } catch (error) {
        console.warn('⚠️  LLM Service initialization failed:', error instanceof Error ? error.message : error);
      }
    } else {
      console.log('🤖 LLM Service: ⏸️  Skipped (No API keys found - set OPENAI_API_KEY or GEMINI_API_KEY/GOOGLE_API_KEY)');
    }

    // Initialize Audio Services
    let audioServicesInitialized = false;
    try {
      // Initialize WebSocket server for audio streaming
      const audioStreamService = AudioStreamService.getInstance();
      audioStreamService.initializeWebSocketServer(server);
      
      // Initialize audio recording service
      const audioRecordingService = AudioRecordingService.getInstance();
      
      audioServicesInitialized = true;
      console.log('🎵 Audio Services: ✅ Initialized (WebSocket + Recording)');
    } catch (error) {
      console.warn('⚠️  Audio Services initialization failed:', error instanceof Error ? error.message : error);
    }

    // Initialize Speech-to-Text Service
    let sttInitialized = false;
    try {
      const sttService = SpeechToTextService.getInstance();
      sttService.autoInitialize();
      
      const sttStatus = sttService.getStatus();
      sttInitialized = sttStatus.available;
      
      if (sttInitialized) {
        console.log(`🗣️ STT Service: ✅ Initialized with ${sttStatus.provider.toUpperCase()}`);
        
        // Run a quick test
        const testResult = await sttService.testService();
        if (!testResult) {
          console.warn('⚠️  STT Service test failed but service is available');
        }
      } else {
        console.log('🗣️ STT Service: ⏸️  Skipped (No compatible API keys found)');
      }
    } catch (error) {
      console.warn('⚠️  STT Service initialization failed:', error instanceof Error ? error.message : error);
    }

    // Initialize Transcription Processor Service
    let transcriptionProcessorInitialized = false;
    try {
      const transcriptionProcessor = TranscriptionProcessorService.getInstance();
      transcriptionProcessorInitialized = true;
      console.log('📝 Transcription Processor: ✅ Initialized');
    } catch (error) {
      console.warn('⚠️  Transcription Processor initialization failed:', error instanceof Error ? error.message : error);
    }

    // Initialize Dashboard WebSocket Service
    let dashboardWSInitialized = false;
    try {
      const dashboardWS = DashboardWebSocketService.getInstance();
      dashboardWS.initializeWebSocketServer(server);
      dashboardWSInitialized = true;
      console.log('📊 Dashboard WebSocket: ✅ Initialized');
    } catch (error) {
      console.warn('⚠️  Dashboard WebSocket initialization failed:', error instanceof Error ? error.message : error);
    }

    // Start the HTTP server (with WebSocket support)
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/api/twilio/audio-stream`);
      console.log(`📊 Dashboard WebSocket: ws://localhost:${PORT}/api/dashboard/ws`);
      console.log(`🗄️  Database: ${isConnected ? '✅ Connected' : '❌ Not Connected'}`);
      console.log(`🤖 LLM Service: ${llmInitialized ? '✅ Ready' : '❌ Not Ready'}`);
      console.log(`🎵 Audio Services: ${audioServicesInitialized ? '✅ Ready' : '❌ Not Ready'}`);
      console.log(`🗣️ STT Service: ${sttInitialized ? '✅ Ready' : '❌ Not Ready'}`);
      console.log(`📝 Transcription Processor: ${transcriptionProcessorInitialized ? '✅ Ready' : '❌ Not Ready'}`);
      console.log(`📊 Dashboard WebSocket: ${dashboardWSInitialized ? '✅ Ready' : '❌ Not Ready'}`);
      
      // Print security configuration status
      EnvValidator.printStatus();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, gracefully shutting down...');
  
  // Close audio streaming sessions
  try {
    const audioStreamService = AudioStreamService.getInstance();
    audioStreamService.closeAllSessions();
  } catch (error) {
    console.error('Error closing audio sessions:', error);
  }
  
  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});

startServer(); 