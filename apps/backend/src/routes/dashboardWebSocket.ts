import { Router, Request, Response } from 'express';
import { DashboardWebSocketService } from '../services/dashboardWebSocketService';

const router = Router();
const dashboardWS = DashboardWebSocketService.getInstance();

// Get WebSocket status and connected clients
router.get('/status', (req: Request, res: Response) => {
  try {
    const stats = dashboardWS.getStats();
    const clients = dashboardWS.getConnectedClients().map(client => ({
      id: client.id,
      userId: client.userId,
      storeId: client.storeId,
      connectedAt: client.connectedAt,
      lastPing: client.lastPing
    }));

    res.json({
      service: 'Dashboard WebSocket Service',
      status: 'active',
      endpoint: '/api/dashboard/ws',
      stats,
      clients,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting dashboard WebSocket status:', error);
    res.status(500).json({
      service: 'Dashboard WebSocket Service',
      status: 'error',
      error: 'Failed to get service status',
      timestamp: new Date().toISOString()
    });
  }
});

// Test broadcasting functionality
router.post('/test-broadcast', (req: Request, res: Response) => {
  try {
    const { type, payload, storeId } = req.body;

    if (!type || !payload) {
      res.status(400).json({
        success: false,
        error: 'Type and payload are required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Broadcast test message
    switch (type) {
      case 'call_status':
        dashboardWS.broadcastCallUpdate(payload);
        break;
      case 'store_sync':
        dashboardWS.broadcastStoreSyncUpdate(storeId || 'test-store', payload);
        break;
      case 'order_update':
        dashboardWS.broadcastOrderUpdate(storeId || 'test-store', payload);
        break;
      case 'product_update':
        dashboardWS.broadcastProductUpdate(storeId || 'test-store', payload);
        break;
      case 'notification':
        dashboardWS.broadcastNotification(payload, storeId);
        break;
      default:
        res.status(400).json({
          success: false,
          error: 'Invalid broadcast type',
          timestamp: new Date().toISOString()
        });
        return;
    }

    res.json({
      success: true,
      message: `Test broadcast sent: ${type}`,
      payload,
      storeId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error testing broadcast:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Broadcast call status update
router.post('/broadcast/call-status', (req: Request, res: Response) => {
  try {
    const callData = req.body;

    if (!callData.callSid) {
      res.status(400).json({
        success: false,
        error: 'callSid is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    dashboardWS.broadcastCallUpdate(callData);

    res.json({
      success: true,
      message: 'Call status update broadcasted',
      callSid: callData.callSid,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error broadcasting call status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Broadcast store sync update
router.post('/broadcast/store-sync', (req: Request, res: Response) => {
  try {
    const { storeId, syncData } = req.body;

    if (!storeId || !syncData) {
      res.status(400).json({
        success: false,
        error: 'storeId and syncData are required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    dashboardWS.broadcastStoreSyncUpdate(storeId, syncData);

    res.json({
      success: true,
      message: 'Store sync update broadcasted',
      storeId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error broadcasting store sync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Broadcast notification
router.post('/broadcast/notification', (req: Request, res: Response) => {
  try {
    const { notification, storeId } = req.body;

    if (!notification) {
      res.status(400).json({
        success: false,
        error: 'notification is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    dashboardWS.broadcastNotification(notification, storeId);

    res.json({
      success: true,
      message: 'Notification broadcasted',
      storeId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error broadcasting notification:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 