import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { SpeechToTextService } from './speechToTextService';
import { TranscriptionProcessorService } from './transcriptionProcessorService';

interface RecordingMetadata {
  callSid: string;
  recordingSid: string;
  recordingUrl: string;
  recordingDuration: string;
  from: string;
  to?: string;
  timestamp: Date;
  localFilePath?: string;
  transcription?: string;
  transcriptionResult?: any; // Full STT result with metadata
  processed: boolean;
  processingStarted?: Date;
  processingCompleted?: Date;
  processingError?: string;
}

export class AudioRecordingService {
  private static instance: AudioRecordingService;
  private recordings: Map<string, RecordingMetadata> = new Map();
  private recordingsDir: string;
  private sttService: SpeechToTextService;
  private transcriptionProcessor: TranscriptionProcessorService;

  private constructor() {
    // Create recordings directory if it doesn't exist
    this.recordingsDir = path.join(process.cwd(), 'temp', 'recordings');
    this.ensureDirectoryExists(this.recordingsDir);
    
    // Get STT service instance
    this.sttService = SpeechToTextService.getInstance();
    
    // Get transcription processor service instance
    this.transcriptionProcessor = TranscriptionProcessorService.getInstance();
  }

  public static getInstance(): AudioRecordingService {
    if (!AudioRecordingService.instance) {
      AudioRecordingService.instance = new AudioRecordingService();
    }
    return AudioRecordingService.instance;
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created recordings directory: ${dirPath}`);
    }
  }

  /**
   * Process a recording completion webhook from Twilio
   */
  public async processRecordingComplete(
    callSid: string,
    recordingSid: string,
    recordingUrl: string,
    recordingDuration: string,
    from: string,
    to?: string
  ): Promise<RecordingMetadata> {
    console.log(`🎙️ Processing recording completion:`, {
      callSid,
      recordingSid,
      recordingUrl,
      duration: recordingDuration
    });

    const metadata: RecordingMetadata = {
      callSid,
      recordingSid,
      recordingUrl,
      recordingDuration,
      from,
      to,
      timestamp: new Date(),
      processed: false
    };

    this.recordings.set(recordingSid, metadata);

    try {
      // Download the recording file
      await this.downloadRecording(metadata);
      
      // Process with STT service
      await this.transcribeRecording(metadata);
      
      console.log(`✅ Recording ${recordingSid} processed and transcribed successfully`);
    } catch (error) {
      console.error(`❌ Error processing recording ${recordingSid}:`, error);
      metadata.processed = false;
      metadata.processingError = error instanceof Error ? error.message : 'Unknown error';
    }

    return metadata;
  }

  /**
   * Download a recording file from Twilio
   */
  private async downloadRecording(metadata: RecordingMetadata): Promise<void> {
    const fileName = `${metadata.recordingSid}_${metadata.callSid}.wav`;
    const filePath = path.join(this.recordingsDir, fileName);

    console.log(`⬇️ Downloading recording from: ${metadata.recordingUrl}`);
    console.log(`💾 Saving to: ${filePath}`);

    try {
      // Download the audio file
      const response = await axios({
        method: 'GET',
        url: metadata.recordingUrl,
        responseType: 'stream',
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID || '',
          password: process.env.TWILIO_AUTH_TOKEN || ''
        }
      });

      // Save to file
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(undefined));
        writer.on('error', reject);
      });

      metadata.localFilePath = filePath;
      console.log(`✅ Recording downloaded successfully: ${fileName}`);

    } catch (error) {
      console.error(`❌ Error downloading recording:`, error);
      throw error;
    }
  }

  /**
   * Transcribe a downloaded recording using STT service
   */
  private async transcribeRecording(metadata: RecordingMetadata): Promise<void> {
    if (!metadata.localFilePath) {
      throw new Error('Recording file not downloaded');
    }

    // Check if STT service is available
    const sttStatus = this.sttService.getStatus();
    if (!sttStatus.available) {
      console.warn(`⚠️ STT service not available for recording ${metadata.recordingSid}, skipping transcription`);
      return;
    }

    metadata.processingStarted = new Date();
    console.log(`🗣️ Starting transcription for recording ${metadata.recordingSid}`);

    try {
      // Use the STT service to transcribe the audio file
      const transcriptionResult = await this.sttService.transcribeFile(metadata.localFilePath, {
        language: 'en', // Could be made configurable
        prompt: 'This is a customer service call. Please transcribe accurately.',
        format: 'verbose_json'
      });

      // Store the transcription results
      metadata.transcription = transcriptionResult.text;
      metadata.transcriptionResult = transcriptionResult;
      metadata.processed = true;
      metadata.processingCompleted = new Date();

      const processingTime = metadata.processingCompleted.getTime() - metadata.processingStarted.getTime();
      
      console.log(`✅ Transcription completed for ${metadata.recordingSid}:`);
      console.log(`   Text: "${transcriptionResult.text.substring(0, 100)}${transcriptionResult.text.length > 100 ? '...' : ''}"`);
      console.log(`   Duration: ${transcriptionResult.duration}s`);
      console.log(`   Processing time: ${processingTime}ms`);
      console.log(`   Provider: ${transcriptionResult.provider}`);

      // Process transcription with TranscriptionProcessorService
      try {
        await this.transcriptionProcessor.processRecordingTranscription(
          metadata.callSid,
          metadata.recordingSid,
          transcriptionResult,
          metadata.from // Use 'from' as customer phone
        );
        console.log(`📝 Transcription processed through TranscriptionProcessorService`);
      } catch (processorError) {
        console.error(`⚠️ TranscriptionProcessor failed for ${metadata.recordingSid}:`, processorError);
        // Don't throw here - transcription itself was successful
      }

    } catch (error) {
      console.error(`❌ Transcription failed for ${metadata.recordingSid}:`, error);
      metadata.processingError = error instanceof Error ? error.message : 'Transcription failed';
      metadata.processingCompleted = new Date();
      throw error;
    }
  }

  /**
   * Manually trigger transcription for a recording (for retries or batch processing)
   */
  public async retryTranscription(recordingSid: string): Promise<boolean> {
    const metadata = this.recordings.get(recordingSid);
    if (!metadata) {
      console.error(`❌ Recording ${recordingSid} not found`);
      return false;
    }

    if (!metadata.localFilePath || !fs.existsSync(metadata.localFilePath)) {
      console.error(`❌ Audio file not found for recording ${recordingSid}`);
      return false;
    }

    try {
      await this.transcribeRecording(metadata);
      return true;
    } catch (error) {
      console.error(`❌ Retry transcription failed for ${recordingSid}:`, error);
      return false;
    }
  }

  /**
   * Get recording metadata by recording SID
   */
  public getRecording(recordingSid: string): RecordingMetadata | undefined {
    return this.recordings.get(recordingSid);
  }

  /**
   * Get all recordings for a specific call
   */
  public getRecordingsByCallSid(callSid: string): RecordingMetadata[] {
    return Array.from(this.recordings.values()).filter(
      recording => recording.callSid === callSid
    );
  }

  /**
   * Get all unprocessed recordings (for batch processing)
   */
  public getUnprocessedRecordings(): RecordingMetadata[] {
    return Array.from(this.recordings.values()).filter(
      recording => !recording.processed && recording.localFilePath && !recording.processingStarted
    );
  }

  /**
   * Get recordings that failed processing
   */
  public getFailedRecordings(): RecordingMetadata[] {
    return Array.from(this.recordings.values()).filter(
      recording => recording.processingError && !recording.processed
    );
  }

  /**
   * Mark a recording as processed with transcription (legacy method)
   */
  public markRecordingProcessed(recordingSid: string, transcription: string): void {
    const recording = this.recordings.get(recordingSid);
    if (recording) {
      recording.transcription = transcription;
      recording.processed = true;
      recording.processingCompleted = new Date();
      console.log(`✅ Recording ${recordingSid} marked as processed`);
    }
  }

  /**
   * Batch process unprocessed recordings
   */
  public async batchProcessRecordings(): Promise<{
    processed: number;
    failed: number;
    skipped: number;
  }> {
    const unprocessed = this.getUnprocessedRecordings();
    console.log(`🔄 Starting batch processing of ${unprocessed.length} recordings`);

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const recording of unprocessed) {
      try {
        if (!this.sttService.getStatus().available) {
          console.warn(`⚠️ STT service not available, skipping ${recording.recordingSid}`);
          skipped++;
          continue;
        }

        await this.transcribeRecording(recording);
        processed++;
        
        // Add small delay between processing to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Batch processing failed for ${recording.recordingSid}:`, error);
        failed++;
      }
    }

    console.log(`✅ Batch processing completed: ${processed} processed, ${failed} failed, ${skipped} skipped`);
    return { processed, failed, skipped };
  }

  /**
   * Clean up old recording files (optional cleanup method)
   */
  public async cleanupOldRecordings(olderThanHours: number = 24): Promise<void> {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [recordingSid, recording] of this.recordings.entries()) {
      if (recording.timestamp.getTime() < cutoffTime && recording.localFilePath) {
        try {
          if (fs.existsSync(recording.localFilePath)) {
            fs.unlinkSync(recording.localFilePath);
            console.log(`🗑️ Deleted old recording file: ${recording.localFilePath}`);
          }
          this.recordings.delete(recordingSid);
          deletedCount++;
        } catch (error) {
          console.error(`❌ Error deleting recording file:`, error);
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} old recordings`);
    }
  }

  /**
   * Get statistics about recordings
   */
  public getRecordingStats(): {
    total: number;
    processed: number;
    unprocessed: number;
    failed: number;
    withFiles: number;
    withTranscriptions: number;
  } {
    const recordings = Array.from(this.recordings.values());
    return {
      total: recordings.length,
      processed: recordings.filter(r => r.processed).length,
      unprocessed: recordings.filter(r => !r.processed && !r.processingError).length,
      failed: recordings.filter(r => r.processingError).length,
      withFiles: recordings.filter(r => r.localFilePath).length,
      withTranscriptions: recordings.filter(r => r.transcription).length
    };
  }

  /**
   * Get the path to a downloaded recording file
   */
  public getRecordingFilePath(recordingSid: string): string | undefined {
    const recording = this.recordings.get(recordingSid);
    return recording?.localFilePath;
  }

  /**
   * Get the transcription for a recording
   */
  public getTranscription(recordingSid: string): {
    text?: string;
    result?: any;
    metadata?: any;
  } | undefined {
    const recording = this.recordings.get(recordingSid);
    if (!recording) return undefined;

    return {
      text: recording.transcription,
      result: recording.transcriptionResult,
      metadata: {
        processed: recording.processed,
        processingStarted: recording.processingStarted,
        processingCompleted: recording.processingCompleted,
        processingError: recording.processingError
      }
    };
  }
} 