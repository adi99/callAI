import { promises as fs, createReadStream, createWriteStream } from 'fs';
import { join, extname, basename } from 'path';
import { EnvValidator } from '../utils/envValidator';

export interface AudioFile {
  id: string;
  filename: string;
  filepath: string;
  url: string;
  contentType: string;
  size: number;
  duration?: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface AudioProcessingOptions {
  ttl?: number;
  publicUrl?: string;
  filename?: string;
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface AudioStreamingOptions {
  contentType?: string;
  range?: string;
  chunkSize?: number;
}

export class AudioProcessingService {
  private static instance: AudioProcessingService;
  private audioDir: string;
  private publicDir: string;
  private baseUrl: string;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    const config = EnvValidator.getConfig();
    
    this.audioDir = join(process.cwd(), 'temp', 'audio');
    this.publicDir = join(process.cwd(), 'temp', 'public', 'audio');
    
    this.baseUrl = config.WEBHOOK_BASE_URL || config.FRONTEND_URL || 'http://localhost:3001';
    
    this.initializeDirectories();
    this.startCleanupScheduler();
  }

  public static getInstance(): AudioProcessingService {
    if (!AudioProcessingService.instance) {
      AudioProcessingService.instance = new AudioProcessingService();
    }
    return AudioProcessingService.instance;
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
      await fs.mkdir(this.publicDir, { recursive: true });
      console.log('[AudioProcessing] Directories initialized');
    } catch (error) {
      console.error('[AudioProcessing] Failed to initialize directories:', error);
      throw error;
    }
  }

  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredFiles().catch(error => {
        console.error('[AudioProcessing] Cleanup failed:', error);
      });
    }, 30 * 60 * 1000);
  }

  public async processAndStoreAudio(
    audioBuffer: Buffer,
    options: AudioProcessingOptions = {}
  ): Promise<AudioFile> {
    try {
      const audioId = this.generateAudioId();
      const fileExtension = this.getFileExtension(options.format || 'mp3');
      const filename = options.filename || `audio-${audioId}${fileExtension}`;
      
      const privatePath = join(this.audioDir, filename);
      const publicPath = join(this.publicDir, filename);
      
      await fs.writeFile(privatePath, audioBuffer);
      await fs.copyFile(privatePath, publicPath);
      
      console.log(`[AudioProcessing] Audio saved: ${filename} (${audioBuffer.length} bytes)`);

      const ttl = options.ttl || 3600;
      const expiresAt = new Date(Date.now() + ttl * 1000);
      
      const audioFile: AudioFile = {
        id: audioId,
        filename,
        filepath: privatePath,
        url: `${this.baseUrl}/public/audio/${filename}`,
        contentType: this.getContentType(fileExtension),
        size: audioBuffer.length,
        createdAt: new Date(),
        expiresAt
      };

      await this.saveAudioMetadata(audioFile);
      return audioFile;

    } catch (error) {
      console.error('[AudioProcessing] Failed to process audio:', error);
      throw error;
    }
  }

  public async getAudioFile(audioId: string): Promise<AudioFile | null> {
    try {
      const metadata = await this.loadAudioMetadata(audioId);
      
      if (!metadata) {
        return null;
      }

      try {
        await fs.access(metadata.filepath);
        return metadata;
      } catch {
        await this.deleteAudioMetadata(audioId);
        return null;
      }

    } catch (error) {
      console.error(`[AudioProcessing] Failed to get audio file ${audioId}:`, error);
      return null;
    }
  }

  public async deleteAudioFile(audioId: string): Promise<boolean> {
    try {
      const audioFile = await this.getAudioFile(audioId);
      
      if (!audioFile) {
        return false;
      }

      try {
        await fs.unlink(audioFile.filepath);
      } catch (error) {
        console.warn(`[AudioProcessing] Could not delete private file: ${audioFile.filepath}`);
      }

      const publicPath = join(this.publicDir, audioFile.filename);
      try {
        await fs.unlink(publicPath);
      } catch (error) {
        console.warn(`[AudioProcessing] Could not delete public file: ${publicPath}`);
      }

      await this.deleteAudioMetadata(audioId);

      console.log(`[AudioProcessing] Deleted audio file: ${audioFile.filename}`);
      
      return true;

    } catch (error) {
      console.error(`[AudioProcessing] Failed to delete audio file ${audioId}:`, error);
      return false;
    }
  }

  public async cleanupExpiredFiles(): Promise<number> {
    let cleanedCount = 0;
    
    try {
      console.log('[AudioProcessing] Starting cleanup of expired files...');
      
      const files = await fs.readdir(this.audioDir);
      
      for (const filename of files) {
        if (filename.endsWith('.json')) {
          continue;
        }

        const audioId = this.extractAudioId(filename);
        if (!audioId) {
          continue;
        }

        const audioFile = await this.getAudioFile(audioId);
        
        if (!audioFile) {
          try {
            await fs.unlink(join(this.audioDir, filename));
            await fs.unlink(join(this.publicDir, filename));
            cleanedCount++;
          } catch (error) {
            console.warn(`[AudioProcessing] Could not delete orphaned file: ${filename}`);
          }
          continue;
        }

        if (audioFile.expiresAt && audioFile.expiresAt < new Date()) {
          await this.deleteAudioFile(audioId);
          cleanedCount++;
        }
      }

      console.log(`[AudioProcessing] Cleanup completed. Removed ${cleanedCount} files.`);
      
    } catch (error) {
      console.error('[AudioProcessing] Cleanup failed:', error);
    }

    return cleanedCount;
  }

  private async saveAudioMetadata(audioFile: AudioFile): Promise<void> {
    const metadataPath = join(this.audioDir, `${audioFile.id}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(audioFile, null, 2));
  }

  private async loadAudioMetadata(audioId: string): Promise<AudioFile | null> {
    try {
      const metadataPath = join(this.audioDir, `${audioId}.json`);
      const data = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(data);
      
      metadata.createdAt = new Date(metadata.createdAt);
      if (metadata.expiresAt) {
        metadata.expiresAt = new Date(metadata.expiresAt);
      }
      
      return metadata;
    } catch {
      return null;
    }
  }

  private async deleteAudioMetadata(audioId: string): Promise<void> {
    try {
      const metadataPath = join(this.audioDir, `${audioId}.json`);
      await fs.unlink(metadataPath);
    } catch {
      // Ignore errors
    }
  }

  private generateAudioId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getFileExtension(format: string): string {
    switch (format.toLowerCase()) {
      case 'mp3': return '.mp3';
      case 'wav': return '.wav';
      case 'ogg': return '.ogg';
      default: return '.mp3';
    }
  }

  private getContentType(extension: string): string {
    switch (extension.toLowerCase()) {
      case '.mp3': return 'audio/mpeg';
      case '.wav': return 'audio/wav';
      case '.ogg': return 'audio/ogg';
      default: return 'audio/mpeg';
    }
  }

  private extractAudioId(filename: string): string | null {
    const match = filename.match(/audio-([a-z0-9]+)\./);
    return match ? match[1] : null;
  }

  public async dispose(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    await this.cleanupExpiredFiles();
    console.log('[AudioProcessing] Service disposed');
  }
} 