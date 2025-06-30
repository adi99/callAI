import { Request, Response, NextFunction } from 'express';
import { CredentialService } from '../services/credentialService';

export interface AuthenticatedRequest extends Request {
  user?: any;
  apiKey?: any;
  storeId?: string;
}

export const jwtAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authorization header required'
      });
      return;
    }

    const token = authHeader.substring(7);
    const credentialService = CredentialService.getInstance();
    
    const decoded = credentialService.verifyJWT(token);
    req.user = decoded;
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

export const apiKeyAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key required'
      });
      return;
    }

    const credentialService = CredentialService.getInstance();
    const validKey = await credentialService.validateAPIKey(apiKey);
    
    if (!validKey) {
      res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
      return;
    }

    req.apiKey = validKey;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      res.status(403).json({
        success: false,
        error: 'API key authentication required'
      });
      return;
    }

    if (!req.apiKey.permissions.includes(permission) && !req.apiKey.permissions.includes('*')) {
      res.status(403).json({
        success: false,
        error: `Permission required: ${permission}`
      });
      return;
    }

    next();
  };
};

export const webhookAuth = (expectedSecret?: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-webhook-signature'] as string;
    const secret = expectedSecret || process.env.WEBHOOK_SECRET;
    
    if (!signature || !secret) {
      res.status(401).json({
        success: false,
        error: 'Webhook authentication failed'
      });
      return;
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      res.status(401).json({
        success: false,
        error: 'Invalid webhook signature'
      });
      return;
    }

    next();
  };
}; 