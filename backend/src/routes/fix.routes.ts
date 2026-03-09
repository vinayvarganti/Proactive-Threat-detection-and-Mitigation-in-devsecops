import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/jwtAuth';
import { FixManager } from '../services/FixManager';
import VulnerabilityModel from '../models/Vulnerability';
import ScanReportModel from '../models/ScanReport';
import { RepositoryManager } from '../services/RepositoryManager';
import { AuthenticationService } from '../services/AuthenticationService';

const router = Router();
const fixManager = new FixManager();
const repoManager = new RepositoryManager();
const authService = new AuthenticationService();

/**
 * POST /api/fixes/manual
 * Submit a manual fix for a vulnerability
 * Body: { vulnerabilityId, fixedCode, repositoryFullName }
 */
router.post('/manual', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const githubId = req.user!.githubId;
    const { vulnerabilityId, fixedCode, repositoryFullName } = req.body;

    // Validate input
    if (!vulnerabilityId || !fixedCode || !repositoryFullName) {
      res.status(400).json({
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'vulnerabilityId, fixedCode, and repositoryFullName are required',
          retryable: false,
          suggestedAction: 'Provide all required parameters'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Get the MongoDB User document to get the ObjectId
    const UserModel = (await import('../models/User')).default;
    const user = await UserModel.findOne({ githubId });
    
    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found in database',
          retryable: false,
          suggestedAction: 'Please log in again'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Verify the vulnerability exists and belongs to the user
    const vulnerability = await VulnerabilityModel.findById(vulnerabilityId);
    if (!vulnerability) {
      res.status(404).json({
        error: {
          code: 'VULNERABILITY_NOT_FOUND',
          message: 'Vulnerability not found',
          retryable: false,
          suggestedAction: 'Check the vulnerability ID'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Verify ownership
    const scanReport = await ScanReportModel.findOne({
      _id: vulnerability.reportId,
      userId: user._id
    });

    if (!scanReport) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this vulnerability',
          retryable: false,
          suggestedAction: 'Check your permissions'
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

    // Download repository to apply fix
    const localPath = await repoManager.downloadRepository(repositoryFullName, accessToken.token);

    try {
      // Apply the manual fix
      await fixManager.applyManualFix(vulnerabilityId, githubId, fixedCode, localPath);

      // Cleanup temporary files
      await repoManager.cleanupTemporaryFiles(localPath);

      res.json({
        success: true,
        message: 'Manual fix applied successfully',
        vulnerabilityId,
        fixStatus: 'fixed'
      });
    } catch (fixError) {
      // Cleanup on error
      await repoManager.cleanupTemporaryFiles(localPath);
      throw fixError;
    }
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'MANUAL_FIX_FAILED',
        message: error instanceof Error ? error.message : 'Failed to apply manual fix',
        retryable: true,
        suggestedAction: 'Try again or check the code syntax'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * POST /api/fixes/ai
 * Request an AI-generated fix for a vulnerability
 * Body: { vulnerabilityId, codeContext }
 */
router.post('/ai', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const githubId = req.user!.githubId;
    const { vulnerabilityId, codeContext } = req.body;

    // Validate input
    if (!vulnerabilityId) {
      res.status(400).json({
        error: {
          code: 'MISSING_VULNERABILITY_ID',
          message: 'vulnerabilityId is required',
          retryable: false,
          suggestedAction: 'Provide vulnerability ID'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Get the MongoDB User document to get the ObjectId
    const UserModel = (await import('../models/User')).default;
    const user = await UserModel.findOne({ githubId });
    
    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found in database',
          retryable: false,
          suggestedAction: 'Please log in again'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Verify the vulnerability exists and belongs to the user
    const vulnerability = await VulnerabilityModel.findById(vulnerabilityId);
    if (!vulnerability) {
      res.status(404).json({
        error: {
          code: 'VULNERABILITY_NOT_FOUND',
          message: 'Vulnerability not found',
          retryable: false,
          suggestedAction: 'Check the vulnerability ID'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Verify ownership
    const scanReport = await ScanReportModel.findOne({
      _id: vulnerability.reportId,
      userId: user._id
    });

    if (!scanReport) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this vulnerability',
          retryable: false,
          suggestedAction: 'Check your permissions'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Request AI fix
    const proposal = await fixManager.requestAIFix(
      vulnerabilityId,
      codeContext || vulnerability.codeSnippet
    );

    res.json({
      success: true,
      proposal,
      message: 'AI fix proposal generated successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'AI_FIX_REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate AI fix',
        retryable: true,
        suggestedAction: 'Try again or use manual correction'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * POST /api/fixes/ai/:id/approve
 * Approve and apply an AI-generated fix
 * Body: { repositoryFullName }
 */
router.post('/ai/:id/approve', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const githubId = req.user!.githubId;
    const proposalId = req.params.id;
    const { repositoryFullName } = req.body;

    // Validate input
    if (!repositoryFullName) {
      res.status(400).json({
        error: {
          code: 'MISSING_REPOSITORY_NAME',
          message: 'repositoryFullName is required',
          retryable: false,
          suggestedAction: 'Provide repository full name'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Get the MongoDB User document to get the ObjectId
    const UserModel = (await import('../models/User')).default;
    const user = await UserModel.findOne({ githubId });
    
    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found in database',
          retryable: false,
          suggestedAction: 'Please log in again'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Get the proposal
    const proposal = fixManager.getAIFixProposal(proposalId);
    if (!proposal) {
      res.status(404).json({
        error: {
          code: 'PROPOSAL_NOT_FOUND',
          message: 'AI fix proposal not found or expired',
          retryable: false,
          suggestedAction: 'Request a new AI fix'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Verify the vulnerability belongs to the user
    const vulnerability = await VulnerabilityModel.findById(proposal.vulnerabilityId);
    if (!vulnerability) {
      res.status(404).json({
        error: {
          code: 'VULNERABILITY_NOT_FOUND',
          message: 'Vulnerability not found',
          retryable: false,
          suggestedAction: 'Check the vulnerability ID'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    const scanReport = await ScanReportModel.findOne({
      _id: vulnerability.reportId,
      userId: user._id
    });

    if (!scanReport) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this vulnerability',
          retryable: false,
          suggestedAction: 'Check your permissions'
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

    // Download repository to apply fix
    const localPath = await repoManager.downloadRepository(repositoryFullName, accessToken.token);

    try {
      // Approve and apply the AI fix
      await fixManager.approveAIFix(proposalId, githubId, localPath);

      // Cleanup temporary files
      await repoManager.cleanupTemporaryFiles(localPath);

      res.json({
        success: true,
        message: 'AI fix approved and applied successfully',
        vulnerabilityId: proposal.vulnerabilityId,
        fixStatus: 'fixed'
      });
    } catch (fixError) {
      // Cleanup on error
      await repoManager.cleanupTemporaryFiles(localPath);
      throw fixError;
    }
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'AI_FIX_APPROVAL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to approve AI fix',
        retryable: true,
        suggestedAction: 'Try again or use manual correction'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * POST /api/fixes/ai/:id/reject
 * Reject an AI-generated fix
 */
router.post('/ai/:id/reject', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;

    // Get the proposal to verify it exists
    const proposal = fixManager.getAIFixProposal(proposalId);
    if (!proposal) {
      res.status(404).json({
        error: {
          code: 'PROPOSAL_NOT_FOUND',
          message: 'AI fix proposal not found or expired',
          retryable: false,
          suggestedAction: 'Request a new AI fix'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Reject the fix
    const result = await fixManager.rejectAIFix(proposalId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'AI_FIX_REJECTION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to reject AI fix',
        retryable: true,
        suggestedAction: 'Try again'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

export default router;
