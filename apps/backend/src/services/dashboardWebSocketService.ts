import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';

interface DashboardClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  storeId?: string;
  connectedAt: Date;
  lastPing: Date;
}

interface DashboardMessage {
  type: 'auth' | 'ping' | 'subscribe' | 'unsubscribe';
  payload?: any;
  timestamp?: string;
}

interface BroadcastMessage {
  type: 'call_status' | 'store_sync' | 'order_update' | 'product_update' | 'notification';
  payload: any;
  timestamp: string;
  storeId?: string;
}

export class DashboardWebSocketService {
  private static instance: DashboardWebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, DashboardClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): DashboardWebSocketService {
    if (!DashboardWebSocketService.instance) {
      DashboardWebSocketService.instance = new DashboardWebSocketService();
    }
    return DashboardWebSocketService.instance;
  }

  public initializeWebSocketServer(server: any): void {
    console.log('📊 Initializing Dashboard WebSocket server...');
    
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/dashboard/ws'
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startPingInterval();
    
    console.log('✅ Dashboard WebSocket server initialized at /api/dashboard/ws');
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const clientId = this.generateClientId();
    const client: DashboardClient = {
      id: clientId,
      ws,
      connectedAt: new Date(),
      lastPing: new Date()
    };

    this.clients.set(clientId, client);
    console.log(`📊 New dashboard client connected: ${clientId}`);

    // Send welcome message
    this.sendToClient(client, {
      type: 'connected',
      payload: { clientId, timestamp: new Date().toISOString() }
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message: DashboardMessage = JSON.parse(data.toString());
        this.handleClientMessage(client, message);
      } catch (error) {
        console.error('❌ Error parsing dashboard message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`📊 Dashboard client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    });

    ws.on('error', (error) => {
      console.error(`❌ Dashboard client error (${clientId}):`, error);
      this.clients.delete(clientId);
    });
  }

  private handleClientMessage(client: DashboardClient, message: DashboardMessage): void {
    switch (message.type) {
      case 'auth':
        this.handleAuth(client, message.payload);
        break;
      
      case 'ping':
        client.lastPing = new Date();
        this.sendToClient(client, { type: 'pong', payload: { timestamp: new Date().toISOString() } });
        break;
      
      case 'subscribe':
        this.handleSubscribe(client, message.payload);
        break;
      
      case 'unsubscribe':
        this.handleUnsubscribe(client, message.payload);
        break;
      
      default:
        console.log('📩 Unknown dashboard message type:', message.type);
    }
  }

  private handleAuth(client: DashboardClient, payload: any): void {
    // Simple authentication - in production, validate JWT token
    if (payload?.userId) {
      client.userId = payload.userId;
      client.storeId = payload.storeId;
      
      this.sendToClient(client, {
        type: 'auth_success',
        payload: { 
          userId: client.userId,
          storeId: client.storeId,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`✅ Dashboard client authenticated: ${client.id} (User: ${client.userId})`);
    } else {
      this.sendToClient(client, {
        type: 'auth_error',
        payload: { message: 'Invalid authentication data' }
      });
    }
  }

  private handleSubscribe(client: DashboardClient, payload: any): void {
    // Handle subscription to specific data channels
    const channel = payload?.channel;
    if (channel) {
      console.log(`📊 Client ${client.id} subscribed to ${channel}`);
      this.sendToClient(client, {
        type: 'subscribed',
        payload: { channel, timestamp: new Date().toISOString() }
      });
    }
  }

  private handleUnsubscribe(client: DashboardClient, payload: any): void {
    // Handle unsubscription from data channels
    const channel = payload?.channel;
    if (channel) {
      console.log(`📊 Client ${client.id} unsubscribed from ${channel}`);
      this.sendToClient(client, {
        type: 'unsubscribed',
        payload: { channel, timestamp: new Date().toISOString() }
      });
    }
  }

  private sendToClient(client: DashboardClient, message: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`❌ Error sending message to client ${client.id}:`, error);
      }
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = new Date();
      const staleThreshold = 60000; // 1 minute

      this.clients.forEach((client, clientId) => {
        if (now.getTime() - client.lastPing.getTime() > staleThreshold) {
          console.log(`🧹 Removing stale client: ${clientId}`);
          client.ws.close();
          this.clients.delete(clientId);
        }
      });
    }, 30000); // Check every 30 seconds
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for broadcasting updates

  public broadcastCallUpdate(callData: any): void {
    const message: BroadcastMessage = {
      type: 'call_status',
      payload: callData,
      timestamp: new Date().toISOString(),
      storeId: callData.storeId
    };
    
    this.broadcast(message);
  }

  public broadcastStoreSyncUpdate(storeId: string, syncData: any): void {
    const message: BroadcastMessage = {
      type: 'store_sync',
      payload: syncData,
      timestamp: new Date().toISOString(),
      storeId
    };
    
    this.broadcast(message, storeId);
  }

  public broadcastOrderUpdate(storeId: string, orderData: any): void {
    const message: BroadcastMessage = {
      type: 'order_update',
      payload: orderData,
      timestamp: new Date().toISOString(),
      storeId
    };
    
    this.broadcast(message, storeId);
  }

  public broadcastProductUpdate(storeId: string, productData: any): void {
    const message: BroadcastMessage = {
      type: 'product_update',
      payload: productData,
      timestamp: new Date().toISOString(),
      storeId
    };
    
    this.broadcast(message, storeId);
  }

  public broadcastNotification(notification: any, storeId?: string): void {
    const message: BroadcastMessage = {
      type: 'notification',
      payload: notification,
      timestamp: new Date().toISOString(),
      storeId
    };
    
    this.broadcast(message, storeId);
  }

  private broadcast(message: BroadcastMessage, targetStoreId?: string): void {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach((client) => {
      // Send to all clients or filter by store ID
      if (!targetStoreId || client.storeId === targetStoreId) {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(messageStr);
            sentCount++;
          } catch (error) {
            console.error(`❌ Error broadcasting to client ${client.id}:`, error);
          }
        }
      }
    });

    console.log(`📡 Broadcasted ${message.type} to ${sentCount} clients${targetStoreId ? ` (store: ${targetStoreId})` : ''}`);
  }

  // Status and monitoring methods

  public getConnectedClients(): DashboardClient[] {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      userId: client.userId,
      storeId: client.storeId,
      connectedAt: client.connectedAt,
      lastPing: client.lastPing,
      ws: client.ws // Note: WebSocket object for reference only
    }));
  }

  public getStats(): {
    totalClients: number;
    authenticatedClients: number;
    clientsByStore: Record<string, number>;
  } {
    const clients = Array.from(this.clients.values());
    const authenticatedClients = clients.filter(c => c.userId).length;
    const clientsByStore: Record<string, number> = {};

    clients.forEach(client => {
      if (client.storeId) {
        clientsByStore[client.storeId] = (clientsByStore[client.storeId] || 0) + 1;
      }
    });

    return {
      totalClients: clients.length,
      authenticatedClients,
      clientsByStore
    };
  }

  public shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((client) => {
      client.ws.close();
    });

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
    }

    console.log('📊 Dashboard WebSocket service shut down');
  }
} 