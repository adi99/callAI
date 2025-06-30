import { Router, Request, Response } from 'express';
import { join } from 'path';
import { createReadStream, promises as fs } from 'fs';
import { AudioProcessingService } from '../services/audioProcessingService';

const router = Router();
const audioService = AudioProcessingService.getInstance();

// Serve audio files publicly
router.get('/public/audio/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    
    // Basic security check
    if (!filename || filename.includes('..') || filename.includes('/')) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    const audioPath = join(process.cwd(), 'temp', 'public', 'audio', filename);
    
    // Check if file exists
    try {
      await fs.access(audioPath);
    } catch {
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }

    const stat = await fs.stat(audioPath);
    
    // Set appropriate headers
    res.setHeader('Content-Type', getContentType(filename));
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Handle range requests for audio streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', chunksize);
      
      const stream = createReadStream(audioPath, { start, end });
      stream.pipe(res);
    } else {
      // Stream the entire file
      const stream = createReadStream(audioPath);
      stream.pipe(res);
    }

  } catch (error) {
    console.error('[AudioRoute] Error serving audio file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get audio file info
router.get('/audio/:audioId/info', async (req: Request, res: Response): Promise<void> => {
  try {
    const { audioId } = req.params;
    
    const audioFile = await audioService.getAudioFile(audioId);
    
    if (!audioFile) {
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }

    // Don't expose internal file paths
    const publicInfo = {
      id: audioFile.id,
      filename: audioFile.filename,
      url: audioFile.url,
      contentType: audioFile.contentType,
      size: audioFile.size,
      duration: audioFile.duration,
      createdAt: audioFile.createdAt,
      expiresAt: audioFile.expiresAt
    };

    res.json(publicInfo);

  } catch (error) {
    console.error('[AudioRoute] Error getting audio info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete audio file (admin/cleanup endpoint)
router.delete('/audio/:audioId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { audioId } = req.params;
    
    const deleted = await audioService.deleteAudioFile(audioId);
    
    if (!deleted) {
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }

    res.json({ message: 'Audio file deleted successfully' });

  } catch (error) {
    console.error('[AudioRoute] Error deleting audio file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cleanup expired files (admin endpoint)
router.post('/audio/cleanup', async (req: Request, res: Response): Promise<void> => {
  try {
    const cleanedCount = await audioService.cleanupExpiredFiles();
    
    res.json({ 
      message: 'Cleanup completed',
      filesRemoved: cleanedCount
    });

  } catch (error) {
    console.error('[AudioRoute] Error during cleanup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    default:
      return 'audio/mpeg';
  }
}

export default router; 