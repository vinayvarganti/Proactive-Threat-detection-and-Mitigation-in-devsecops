import { Router, Request, Response } from 'express';
import { RepositoryManager } from '../services/RepositoryManager';
import { ScanOrchestrator } from '../services/ScanOrchestrator';
import { authenticateJWT } from '../middleware/jwtAuth';
import { AuthenticationService } from '../services/AuthenticationService';
import RepositoryModel from '../models/Repository';
import ScanReportModel from '../models/ScanReport';
import { getScanQueue } from '../services/ScanQueue';

const router = Router();
const repoManager = new RepositoryManager();
const scanOrchestrator = new ScanOrchestrator();
const authService = new AuthenticationService();
const scanQueue = getScanQueue();

/**
 * GET /api/repositories
 * List user's repositories from GitHub
 */
router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const githubId = req.user!.githubId;

    // Get access token from database
    const accessToken = await authService.getToken(githubId);
    
    if (!accessToken) {
      res.status(401).json({
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'Access token not found. Please re-authenticate.',
          retryable: false,
          suggestedAction: 'Log in again'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Fetch repositories from GitHub
    const repositories = await repoManager.listRepositories(accessToken.token);

    res.json({
      success: true,
      repositories,
      count: repositories.length
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'REPOSITORY_LIST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to list repositories',
        retryable: true,
        suggestedAction: 'Try again or check your GitHub access'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * POST /api/repositories/:id/scan
 * Initiate a security scan for a repository
 */
router.post('/:id/scan', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const githubId = req.user!.githubId;
    const repoId = req.params.id;
    const { fullName } = req.body;

    if (!fullName) {
      res.status(400).json({
        error: {
          code: 'MISSING_REPO_NAME',
          message: 'Repository full name is required',
          retryable: false,
          suggestedAction: 'Provide repository full name in request body'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Get access token
    const accessToken = await authService.getToken(githubId);
    
    if (!accessToken) {
      res.status(401).json({
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'Access token not found. Please re-authenticate.',
          retryable: false,
          suggestedAction: 'Log in again'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Download repository
    const localPath = await repoManager.downloadRepository(fullName, accessToken.token);

    try {
      // Run security scans
      const scanReport = await scanOrchestrator.scanRepository(localPath);

      // Get the MongoDB User document to get the ObjectId
      const UserModel = (await import('../models/User')).default;
      const user = await UserModel.findOne({ githubId });
      
      if (!user) {
        throw new Error('User not found in database');
      }

      // Save or update repository in database
      let repository = await RepositoryModel.findOne({ githubRepoId: repoId });
      
      if (!repository) {
        repository = new RepositoryModel({
          userId: user._id, // Use MongoDB ObjectId
          githubRepoId: repoId,
          name: fullName.split('/')[1],
          fullName,
          visibility: 'public', // Default, should be updated from GitHub data
          defaultBranch: 'main',
          lastScannedAt: new Date()
        });
      } else {
        repository.lastScannedAt = new Date();
      }
      
      await repository.save();

      // First, save vulnerabilities to the Vulnerability collection
      const VulnerabilityModel = (await import('../models/Vulnerability')).default;
      const vulnerabilityIds = [];
      
      for (const vuln of scanReport.vulnerabilities) {
        const vulnerabilityDoc = new VulnerabilityModel({
          reportId: null, // Will be updated after report is saved
          repositoryId: repository._id,
          type: vuln.type,
          severity: vuln.severity,
          title: vuln.title,
          description: vuln.description,
          filePath: vuln.filePath,
          lineNumber: vuln.lineNumber,
          scanner: vuln.scanner,
          fixStatus: 'pending',
          codeSnippet: vuln.codeSnippet || '',
          metadata: vuln.metadata || {}
        });
        
        await vulnerabilityDoc.save();
        vulnerabilityIds.push(vulnerabilityDoc._id);
      }

      // Save scan report to database with vulnerability references
      const scanReportDoc = new ScanReportModel({
        repositoryId: repository._id,
        userId: user._id, // Use MongoDB ObjectId
        timestamp: scanReport.timestamp,
        vulnerabilities: vulnerabilityIds,
        summary: scanReport.summary,
        scanDuration: scanReport.scanDuration,
        scannerResults: scanReport.scannerResults
      });

      await scanReportDoc.save();

      // Update vulnerabilities with the report ID
      await VulnerabilityModel.updateMany(
        { _id: { $in: vulnerabilityIds } },
        { reportId: scanReportDoc._id }
      );

      // Cleanup temporary files
      await repoManager.cleanupTemporaryFiles(localPath);

      res.json({
        success: true,
        reportId: scanReportDoc._id.toString(),
        scanReport: {
          id: scanReportDoc._id,
          repositoryId: repository._id,
          timestamp: scanReport.timestamp,
          summary: scanReport.summary,
          scanDuration: scanReport.scanDuration,
          scannerResults: scanReport.scannerResults
        },
        message: 'Scan completed successfully'
      });
    } catch (scanError) {
      // Cleanup on error
      await repoManager.cleanupTemporaryFiles(localPath);
      throw scanError;
    }
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'SCAN_FAILED',
        message: error instanceof Error ? error.message : 'Failed to scan repository',
        retryable: true,
        suggestedAction: 'Try again or check repository access'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * POST /api/repositories/scan/batch
 * Initiate sequential scans for multiple repositories
 */
router.post('/scan/batch', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const githubId = req.user!.githubId;
    const { repositories } = req.body;

    if (!repositories || !Array.isArray(repositories) || repositories.length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_REPOSITORIES',
          message: 'Repositories array is required and must not be empty',
          retryable: false,
          suggestedAction: 'Provide an array of repositories with id and fullName'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Get access token
    const accessToken = await authService.getToken(githubId);
    
    if (!accessToken) {
      res.status(401).json({
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'Access token not found. Please re-authenticate.',
          retryable: false,
          suggestedAction: 'Log in again'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Add all repositories to the scan queue
    const jobIds: string[] = [];
    for (const repo of repositories) {
      if (!repo.id || !repo.fullName) {
        continue; // Skip invalid entries
      }

      const jobId = scanQueue.addJob(
        githubId,
        repo.id,
        repo.fullName,
        accessToken.token
      );
      jobIds.push(jobId);
    }

    res.json({
      success: true,
      message: `${jobIds.length} repositories queued for scanning`,
      jobIds,
      queueStatus: scanQueue.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'BATCH_SCAN_FAILED',
        message: error instanceof Error ? error.message : 'Failed to queue batch scan',
        retryable: true,
        suggestedAction: 'Try again or check your access'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * GET /api/repositories/scan/queue/status
 * Get the current status of the scan queue
 */
router.get('/scan/queue/status', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const status = scanQueue.getStatus();
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'QUEUE_STATUS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get queue status',
        retryable: true
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * GET /api/repositories/scan/job/:jobId
 * Get the status of a specific scan job
 */
router.get('/scan/job/:jobId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = scanQueue.getJob(jobId);
    
    if (!job) {
      res.status(404).json({
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Scan job not found',
          retryable: false
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    res.json({
      success: true,
      job
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'JOB_STATUS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get job status',
        retryable: true
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * GET /api/repositories/:id/files
 * Get file tree for a repository
 */
router.get('/:id/files', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const githubId = req.user!.githubId;
    const repoId = req.params.id;
    const { fullName } = req.query;

    if (!fullName || typeof fullName !== 'string') {
      res.status(400).json({
        error: {
          code: 'MISSING_REPO_NAME',
          message: 'Repository full name is required as query parameter',
          retryable: false,
          suggestedAction: 'Provide repository full name in query string'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Get access token
    const accessToken = await authService.getToken(githubId);
    
    if (!accessToken) {
      res.status(401).json({
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'Access token not found. Please re-authenticate.',
          retryable: false,
          suggestedAction: 'Log in again'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Download repository
    const localPath = await repoManager.downloadRepository(fullName, accessToken.token);

    try {
      // Get file tree
      const fileTree = await repoManager.getFileTree(localPath);

      // Cleanup temporary files
      await repoManager.cleanupTemporaryFiles(localPath);

      res.json({
        success: true,
        fileTree,
        repositoryId: repoId
      });
    } catch (fileError) {
      // Cleanup on error
      await repoManager.cleanupTemporaryFiles(localPath);
      throw fileError;
    }
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'FILE_TREE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get file tree',
        retryable: true,
        suggestedAction: 'Try again or check repository access'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

export default router;
