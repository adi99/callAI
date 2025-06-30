import { Router, Request, Response } from 'express';
import { CredentialService } from '../services/credentialService';
import { jwtAuth, apiKeyAuth, requirePermission } from '../middleware/auth';
import { EnvValidator } from '../utils/envValidator';

const router = Router();

router.get('/status', (req: Request, res: Response) => {
  try {
    const validation = EnvValidator.validate();
    const credentialService = CredentialService.getInstance();
    const credValidation = credentialService.validateEnvironmentVariables();
    
    res.json({
      success: true,
      data: {
        environmentValid: validation.isValid,
        credentialServiceReady: credValidation.isValid,
        missing: validation.missing,
        warnings: validation.warnings,
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check credential status'
    });
  }
});

router.post('/api-keys', jwtAuth, async (req: Request, res: Response) => {
  try {
    const { name, permissions = [], expiresIn } = req.body;
    
    if (!name) {
      res.status(400).json({
        success: false,
        error: 'API key name is required'
      });
      return;
    }

    const credentialService = CredentialService.getInstance();
    let expiresAt: Date | undefined;
    
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresIn);
    }

    const result = await credentialService.storeAPIKey(name, permissions, expiresAt);
    
    res.json({
      success: true,
      data: {
        id: result.id,
        apiKey: result.apiKey,
        name,
        permissions,
        expiresAt: expiresAt?.toISOString(),
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate API key'
    });
  }
});

router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      res.status(400).json({
        success: false,
        error: 'API key is required'
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

    res.json({
      success: true,
      data: {
        valid: true,
        keyId: validKey.id,
        name: validKey.name,
        permissions: validKey.permissions,
        lastUsed: validKey.last_used_at,
        expiresAt: validKey.expires_at
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to validate API key'
    });
  }
});

router.post('/store-credentials', apiKeyAuth, requirePermission('credentials:write'), async (req: Request, res: Response) => {
  try {
    const { storeId, platform, credentialType, value, expiresIn } = req.body;
    
    if (!storeId || !platform || !credentialType || !value) {
      res.status(400).json({
        success: false,
        error: 'storeId, platform, credentialType, and value are required'
      });
      return;
    }

    const credentialService = CredentialService.getInstance();
    let expiresAt: Date | undefined;
    
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresIn);
    }

    const credentialId = await credentialService.storeCredential(
      storeId,
      platform,
      credentialType,
      value,
      expiresAt
    );
    
    res.json({
      success: true,
      data: {
        credentialId,
        storeId,
        platform,
        credentialType,
        expiresAt: expiresAt?.toISOString(),
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to store credential'
    });
  }
});

router.get('/store-credentials/:storeId', apiKeyAuth, requirePermission('credentials:read'), async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { credentialType } = req.query;
    
    const credentialService = CredentialService.getInstance();
    const credentials = await credentialService.getStoreCredentials(
      storeId,
      credentialType as string
    );
    
    const sanitizedCredentials = credentials.map(cred => ({
      id: cred.id,
      storeId: cred.store_id,
      platform: cred.platform,
      credentialType: cred.credential_type,
      expiresAt: cred.expires_at,
      createdAt: cred.created_at,
      updatedAt: cred.updated_at
    }));
    
    res.json({
      success: true,
      data: sanitizedCredentials
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve credentials'
    });
  }
});

router.put('/store-credentials/:credentialId', apiKeyAuth, requirePermission('credentials:write'), async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    const { value, expiresIn } = req.body;
    
    if (!value) {
      res.status(400).json({
        success: false,
        error: 'New credential value is required'
      });
      return;
    }

    const credentialService = CredentialService.getInstance();
    let expiresAt: Date | undefined;
    
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresIn);
    }

    await credentialService.updateCredential(credentialId, value, expiresAt);
    
    res.json({
      success: true,
      data: {
        credentialId,
        updatedAt: new Date().toISOString(),
        expiresAt: expiresAt?.toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update credential'
    });
  }
});

router.delete('/store-credentials/:credentialId', apiKeyAuth, requirePermission('credentials:delete'), async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    
    const credentialService = CredentialService.getInstance();
    await credentialService.deleteCredential(credentialId);
    
    res.json({
      success: true,
      data: {
        credentialId,
        deletedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete credential'
    });
  }
});

router.post('/cleanup', apiKeyAuth, requirePermission('admin'), async (req: Request, res: Response) => {
  try {
    const credentialService = CredentialService.getInstance();
    await credentialService.cleanupExpiredCredentials();
    
    res.json({
      success: true,
      data: {
        message: 'Expired credentials cleanup completed',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup expired credentials'
    });
  }
});

export default router; 