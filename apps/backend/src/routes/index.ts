import { Router } from 'express';
import { DatabaseService } from '../services/database';
import storesRouter from './stores';
import credentialsRouter from './credentials';
import twilioRouter from './twilio';
import singleTurnCallRouter from './singleTurnCall';
import multiTurnCallRouter from './multiTurnCall';
import callLogsRouter from './callLogs';
import llmRouter from './llm';
import inputProcessorRouter from './inputProcessor';
import shopifyRouter from './shopify';
import webhooksRouter from './webhooks';
import productsRouter from './products';
import transcriptionsRouter from './transcriptions';
import audioRouter from './audio';
import contextManagerRouter from './contextManager';
import llmFunctionsRouter from './llmFunctions';
import dashboardWebSocketRouter from './dashboardWebSocket';
import settingsRouter from './settings';

const router = Router();

// API routes
router.use('/settings', settingsRouter);
router.use('/stores', storesRouter);
router.use('/credentials', credentialsRouter);
router.use('/twilio', twilioRouter);
router.use('/single-turn', singleTurnCallRouter);
router.use('/multi-turn', multiTurnCallRouter);
router.use('/call-logs', callLogsRouter);
router.use('/llm', llmRouter);
router.use('/llm-functions', llmFunctionsRouter);
router.use('/input', inputProcessorRouter);
router.use('/auth/shopify', shopifyRouter);
router.use('/webhooks', webhooksRouter);
router.use('/products', productsRouter);
router.use('/transcriptions', transcriptionsRouter);
router.use('/context', contextManagerRouter);
router.use('/dashboard/ws', dashboardWebSocketRouter);
router.use('/', audioRouter);

// Enhanced health check endpoint
router.get('/health', async (req, res) => {
  try {
    const dbService = DatabaseService.getInstance();
    const isDatabaseHealthy = await dbService.testConnection();
    
    const healthStatus = {
      success: true,
      message: 'API is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        api: 'healthy',
        database: isDatabaseHealthy ? 'healthy' : 'unhealthy'
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };

    const statusCode = isDatabaseHealthy ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Voice-Enabled Ecommerce Customer Service API',
    version: '1.0.0',
    endpoints: {
      settings: '/api/settings',
      stores: '/api/stores',
      credentials: '/api/credentials',
      twilio: '/api/twilio',
      singleTurn: '/api/single-turn',
      multiTurn: '/api/multi-turn',
      llm: '/api/llm',
      llmFunctions: '/api/llm-functions',
      input: '/api/input',
      shopify: '/api/auth/shopify',
      webhooks: '/api/webhooks',
      products: '/api/products',
      transcriptions: '/api/transcriptions',
      context: '/api/context',
      audio: '/api/audio',
      health: '/api/health'
    },
    documentation: 'https://github.com/your-repo/api-docs'
  });
});

export default router; 