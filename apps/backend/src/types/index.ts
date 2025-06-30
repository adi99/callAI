export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Store {
  id: string;
  name: string;
  domain: string;
  platform: 'shopify' | 'woocommerce' | 'magento' | 'bigcommerce' | 'custom';
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  storeUrl?: string;
  currencyCode: string;
  timezone: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSyncAt?: Date;
  syncEnabled: boolean;
  ownerEmail?: string;
  ownerName?: string;
  isConnected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Call {
  id: string;
  storeId: string;
  conversationId?: string;
  twilioCallSid: string;
  callId?: string;
  orderId?: string;
  customerId?: string;
  fromPhone: string;
  toPhone: string;
  direction: 'inbound' | 'outbound';
  startTime: Date;
  endTime?: Date;
  durationSeconds?: number;
  status: 'initiated' | 'ringing' | 'answered' | 'completed' | 'failed' | 'busy' | 'no_answer' | 'cancelled';
  recordingUrl?: string;
  recordingSid?: string;
  transcript?: string;
  transcriptConfidence?: number;
  aiSummary?: string;
  intentDetected?: string;
  sentimentScore?: number;
  satisfactionRating?: number;
  qualityScore?: number;
  droppedCall: boolean;
  twilioData?: Record<string, any>;
  aiContext?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  storeId: string;
  conversationKey?: string;
  orderId?: string;
  customerId?: string;
  channel: 'voice' | 'chat' | 'email' | 'sms' | 'whatsapp';
  status: 'active' | 'paused' | 'completed' | 'escalated' | 'abandoned' | 'resolved';
  customerIdentifier?: string;
  customerName?: string;
  startTime: Date;
  endTime?: Date;
  lastActivityAt: Date;
  title?: string;
  summary?: string;
  primaryIntent?: string;
  resolutionStatus?: string;
  aiContext?: Record<string, any>;
  conversationHistory?: Record<string, any>;
  sentimentScore?: number;
  satisfactionRating?: number;
  escalatedToHuman: boolean;
  resolutionTimeSeconds?: number;
  assignedAgentId?: string;
  escalationReason?: string;
  tags?: string[];
  priorityLevel: number;
  platformData?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  messageIndex: number;
  externalMessageId?: string;
  role: 'customer' | 'ai_assistant' | 'human_agent' | 'system';
  type: 'text' | 'audio' | 'image' | 'file' | 'system_event' | 'action_result';
  content: string;
  contentType: string;
  attachments?: Record<string, any>;
  aiModel?: string;
  aiPrompt?: string;
  aiMetadata?: Record<string, any>;
  processedAt?: Date;
  processingTimeMs?: number;
  intent?: string;
  entities?: Record<string, any>;
  sentimentScore?: number;
  platformData?: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallAnalytics {
  id: string;
  storeId: string;
  datePeriod: Date;
  hourPeriod?: number;
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  answeredCalls: number;
  missedCalls: number;
  averageDurationSeconds?: number;
  averageQualityScore?: number;
  averageSatisfactionRating?: number;
  aiResolutionRate?: number;
  humanEscalationRate?: number;
  averageResponseTimeMs?: number;
  topIntents?: Record<string, any>;
  issueCategories?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCallRequest {
  storeId: string;
  conversationId?: string;
  twilioCallSid: string;
  callId?: string;
  orderId?: string;
  customerId?: string;
  fromPhone: string;
  toPhone: string;
  direction: 'inbound' | 'outbound';
  startTime: Date;
  twilioData?: Record<string, any>;
}

export interface UpdateCallRequest {
  endTime?: Date;
  status?: Call['status'];
  recordingUrl?: string;
  recordingSid?: string;
  transcript?: string;
  transcriptConfidence?: number;
  aiSummary?: string;
  intentDetected?: string;
  sentimentScore?: number;
  satisfactionRating?: number;
  qualityScore?: number;
  droppedCall?: boolean;
  aiContext?: Record<string, any>;
}

export interface CreateConversationRequest {
  storeId: string;
  conversationKey?: string;
  orderId?: string;
  customerId?: string;
  channel: Conversation['channel'];
  customerIdentifier?: string;
  customerName?: string;
  title?: string;
  tags?: string[];
  priorityLevel?: number;
}

export interface UpdateConversationRequest {
  status?: Conversation['status'];
  endTime?: Date;
  title?: string;
  summary?: string;
  primaryIntent?: string;
  resolutionStatus?: string;
  aiContext?: Record<string, any>;
  conversationHistory?: Record<string, any>;
  sentimentScore?: number;
  satisfactionRating?: number;
  escalatedToHuman?: boolean;
  assignedAgentId?: string;
  escalationReason?: string;
  tags?: string[];
  priorityLevel?: number;
}

// Extend Express Request interface for webhook handling
declare global {
  namespace Express {
    interface Request {
      store?: Store;
    }
  }
}

export interface CreateMessageRequest {
  conversationId: string;
  messageIndex: number;
  externalMessageId?: string;
  role: ConversationMessage['role'];
  type?: ConversationMessage['type'];
  content: string;
  contentType?: string;
  attachments?: Record<string, any>;
  aiModel?: string;
  aiPrompt?: string;
  aiMetadata?: Record<string, any>;
  intent?: string;
  entities?: Record<string, any>;
  sentimentScore?: number;
  timestamp?: Date;
} 