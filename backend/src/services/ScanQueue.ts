import { EventEmitter } from 'events';
import { ScanOrchestrator } from './ScanOrchestrator';
import { RepositoryManager } from './RepositoryManager';
import RepositoryModel from '../models/Repository';
import ScanReportModel from '../models/ScanReport';

export interface ScanJob {
  id: string;
  userId: string;
  repositoryId: string;
  fullName: string;
  accessToken: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  scanReportId?: string;
}

export interface ScanQueueStatus {
  queueLength: number;
  currentJob?: ScanJob;
  completedJobs: number;
  failedJobs: number;
}

/**
 * ScanQueue manages sequential execution of repository scans
 * Ensures scans execute one at a time in order
 */
export class ScanQueue extends EventEmitter {
  private queue: ScanJob[] = [];
  private currentJob: ScanJob | null = null;
  private isProcessing: boolean = false;
  private completedJobs: number = 0;
  private failedJobs: number = 0;

  private readonly scanOrchestrator: ScanOrchestrator;
  private readonly repoManager: RepositoryManager;

  constructor() {
    super();
    this.scanOrchestrator = new ScanOrchestrator();
    this.repoManager = new RepositoryManager();
  }

  /**
   * Add a scan job to the queue
   * Returns the job ID for tracking
   */
  addJob(
    userId: string,
    repositoryId: string,
    fullName: string,
    accessToken: string
  ): string {
    const job: ScanJob = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      repositoryId,
      fullName,
      accessToken,
      status: 'queued',
      createdAt: new Date()
    };

    this.queue.push(job);
    this.emit('job-queued', job);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return job.id;
  }

  /**
   * Get the current status of the queue
   */
  getStatus(): ScanQueueStatus {
    return {
      queueLength: this.queue.length,
      currentJob: this.currentJob || undefined,
      completedJobs: this.completedJobs,
      failedJobs: this.failedJobs
    };
  }

  /**
   * Get a specific job by ID
   */
  getJob(jobId: string): ScanJob | null {
    if (this.currentJob?.id === jobId) {
      return this.currentJob;
    }
    return this.queue.find(job => job.id === jobId) || null;
  }

  /**
   * Process the queue sequentially
   * Waits for each job to complete before starting the next
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.currentJob = job;
      
      job.status = 'in_progress';
      job.startedAt = new Date();
      this.emit('job-started', job);

      try {
        await this.executeJob(job);
        
        job.status = 'completed';
        job.completedAt = new Date();
        this.completedJobs++;
        this.emit('job-completed', job);
      } catch (error) {
        job.status = 'failed';
        job.completedAt = new Date();
        job.error = error instanceof Error ? error.message : 'Unknown error';
        this.failedJobs++;
        this.emit('job-failed', job);
      }

      this.currentJob = null;
    }

    this.isProcessing = false;
    this.emit('queue-empty');
  }

  /**
   * Execute a single scan job
   */
  private async executeJob(job: ScanJob): Promise<void> {
    let localPath: string | null = null;

    try {
      // Download repository
      localPath = await this.repoManager.downloadRepository(
        job.fullName,
        job.accessToken
      );

      // Run security scans
      const scanReport = await this.scanOrchestrator.scanRepository(localPath);

      // Save or update repository in database
      let repository = await RepositoryModel.findOne({ 
        githubRepoId: job.repositoryId 
      });
      
      if (!repository) {
        repository = new RepositoryModel({
          userId: job.userId,
          githubRepoId: job.repositoryId,
          name: job.fullName.split('/')[1],
          fullName: job.fullName,
          visibility: 'public',
          defaultBranch: 'main',
          lastScannedAt: new Date()
        });
      } else {
        repository.lastScannedAt = new Date();
      }
      
      await repository.save();

      // Save scan report to database
      const scanReportDoc = new ScanReportModel({
        repositoryId: repository._id,
        userId: job.userId,
        timestamp: scanReport.timestamp,
        vulnerabilities: scanReport.vulnerabilities,
        summary: scanReport.summary,
        scanDuration: scanReport.scanDuration,
        scannerResults: scanReport.scannerResults
      });

      await scanReportDoc.save();

      // Store scan report ID in job
      job.scanReportId = scanReportDoc._id.toString();

      // Cleanup temporary files
      if (localPath) {
        await this.repoManager.cleanupTemporaryFiles(localPath);
      }
    } catch (error) {
      // Cleanup on error
      if (localPath) {
        await this.repoManager.cleanupTemporaryFiles(localPath);
      }
      throw error;
    }
  }

  /**
   * Clear all completed and failed jobs from history
   */
  clearHistory(): void {
    this.completedJobs = 0;
    this.failedJobs = 0;
  }
}

// Singleton instance
let scanQueueInstance: ScanQueue | null = null;

export function getScanQueue(): ScanQueue {
  if (!scanQueueInstance) {
    scanQueueInstance = new ScanQueue();
  }
  return scanQueueInstance;
}
