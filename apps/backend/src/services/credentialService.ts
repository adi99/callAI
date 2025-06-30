import CryptoJS from 'crypto-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DatabaseService } from './database';

export interface EncryptedCredential {
  id: string;
  store_id: string;
  platform: 'shopify' | 'woocommerce' | 'magento';
  credential_type: 'access_token' | 'api_key' | 'secret_key' | 'webhook_secret';
  encrypted_value: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface APIKey {
  id: string;
  name: string;
  key_hash: string;
  permissions: string[];
  created_at: Date;
  last_used_at?: Date;
  expires_at?: Date;
  is_active: boolean;
}

export class CredentialService {
  private static instance: CredentialService;
  private encryptionKey: string;
  private dbService: DatabaseService;

  private constructor() {
    this.encryptionKey = this.getEncryptionKey();
    this.dbService = DatabaseService.getInstance();
  }

  static getInstance(): CredentialService {
    if (!CredentialService.instance) {
      CredentialService.instance = new CredentialService();
    }
    return CredentialService.instance;
  }

  private getEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    if (key.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }
    return key;
  }

  encrypt(plaintext: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(plaintext, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(ciphertext: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, this.encryptionKey);
      const plaintext = bytes.toString(CryptoJS.enc.Utf8);
      if (!plaintext) {
        throw new Error('Failed to decrypt - invalid key or corrupted data');
      }
      return plaintext;
    } catch (error) {
      throw new Error('Failed to decrypt data');
    }
  }

  async storeCredential(
    storeId: string,
    platform: 'shopify' | 'woocommerce' | 'magento',
    credentialType: 'access_token' | 'api_key' | 'secret_key' | 'webhook_secret',
    value: string,
    expiresAt?: Date
  ): Promise<string> {
    try {
      const encryptedValue = this.encrypt(value);
      const credentialId = CryptoJS.lib.WordArray.random(16).toString();
      
      const { error } = await this.dbService.getClient()
        .from('store_credentials')
        .insert({
          id: credentialId,
          store_id: storeId,
          platform,
          credential_type: credentialType,
          encrypted_value: encryptedValue,
          expires_at: expiresAt?.toISOString(),
        });

      if (error) {
        throw new Error(`Failed to store credential: ${error.message}`);
      }

      return credentialId;
    } catch (error) {
      throw new Error(`Failed to store credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCredential(credentialId: string): Promise<string | null> {
    try {
      const { data, error } = await this.dbService.getClient()
        .from('store_credentials')
        .select('encrypted_value')
        .eq('id', credentialId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.decrypt(data.encrypted_value);
    } catch (error) {
      throw new Error(`Failed to retrieve credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStoreCredentials(storeId: string, credentialType?: string): Promise<EncryptedCredential[]> {
    try {
      let query = this.dbService.getClient()
        .from('store_credentials')
        .select('*')
        .eq('store_id', storeId);

      if (credentialType) {
        query = query.eq('credential_type', credentialType);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to retrieve store credentials: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new Error(`Failed to retrieve store credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateCredential(credentialId: string, newValue: string, expiresAt?: Date): Promise<void> {
    try {
      const encryptedValue = this.encrypt(newValue);
      
      const { error } = await this.dbService.getClient()
        .from('store_credentials')
        .update({
          encrypted_value: encryptedValue,
          expires_at: expiresAt?.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', credentialId);

      if (error) {
        throw new Error(`Failed to update credential: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to update credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteCredential(credentialId: string): Promise<void> {
    try {
      const { error } = await this.dbService.getClient()
        .from('store_credentials')
        .delete()
        .eq('id', credentialId);

      if (error) {
        throw new Error(`Failed to delete credential: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to delete credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  generateAPIKey(): string {
    const prefix = 'callai_';
    const randomBytes = CryptoJS.lib.WordArray.random(32);
    return prefix + randomBytes.toString(CryptoJS.enc.Base64url);
  }

  async hashAPIKey(apiKey: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(apiKey, saltRounds);
  }

  async verifyAPIKey(apiKey: string, hashedKey: string): Promise<boolean> {
    return bcrypt.compare(apiKey, hashedKey);
  }

  async storeAPIKey(
    name: string,
    permissions: string[] = [],
    expiresAt?: Date
  ): Promise<{ id: string; apiKey: string }> {
    try {
      const apiKey = this.generateAPIKey();
      const hashedKey = await this.hashAPIKey(apiKey);
      const keyId = CryptoJS.lib.WordArray.random(16).toString();

      const { error } = await this.dbService.getClient()
        .from('api_keys')
        .insert({
          id: keyId,
          name,
          key_hash: hashedKey,
          permissions,
          expires_at: expiresAt?.toISOString(),
          is_active: true,
        });

      if (error) {
        throw new Error(`Failed to store API key: ${error.message}`);
      }

      return { id: keyId, apiKey };
    } catch (error) {
      throw new Error(`Failed to store API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateAPIKey(apiKey: string): Promise<APIKey | null> {
    try {
      const { data, error } = await this.dbService.getClient()
        .from('api_keys')
        .select('*')
        .eq('is_active', true);

      if (error || !data) {
        return null;
      }

      for (const storedKey of data) {
        const isValid = await this.verifyAPIKey(apiKey, storedKey.key_hash);
        if (isValid) {
          if (storedKey.expires_at && new Date(storedKey.expires_at) < new Date()) {
            return null;
          }

          await this.dbService.getClient()
            .from('api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', storedKey.id);

          return storedKey;
        }
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to validate API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  generateJWT(payload: string | object | Buffer, expiresIn: string = '24h'): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }

  verifyJWT(token: string): any {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async cleanupExpiredCredentials(): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      const { error: credError } = await this.dbService.getClient()
        .from('store_credentials')
        .delete()
        .lt('expires_at', now);

      const { error: keyError } = await this.dbService.getClient()
        .from('api_keys')
        .update({ is_active: false })
        .lt('expires_at', now);

      if (credError || keyError) {
        console.warn('Warning: Some expired credentials could not be cleaned up');
      }
    } catch (error) {
      console.error('Failed to cleanup expired credentials:', error);
    }
  }

  validateEnvironmentVariables(): { isValid: boolean; missing: string[] } {
    const required = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    return {
      isValid: missing.length === 0,
      missing
    };
  }
} 