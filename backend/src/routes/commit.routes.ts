import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/session';
import { GitHubCommitService, FileChange } from '../services/GitHubCommitService';
import { AuthenticationService } from '../services/AuthenticationService';
import VulnerabilityModel from '../models/Vulnerability';
import RepositoryModel from '../models/Repository';
import CommitModel from '../models/Commit';
import ScanReportModel from '../models/ScanReport';

const router = Router();
const commitService = new GitHubCommitService();
const authService = new AuthenticationService();

/**
 * POST /api/commits
 * Commit fixes to GitHub repository
 * Body: { repositoryId, vulnerabilityIds, files, branch? }
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { repositoryId, vulnerabilityIds, files, branch } = req.body;

    // Validate input
    if (!repositoryId || !vulnerabilityIds || !Array.isArray(vulnerabilityIds) || vulnerabilityIds.length === 0) {
      res.status(400).json({
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'repositoryId and vulnerabilityIds array are required',
          retryable: false,
          suggestedAction: 'Provide all required parameters'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({
        error: {
          code: 'MISSING_FILES',
          message: 'files array is required',
          retryable: false,
          suggestedAction: 'Provide files to commit'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Verify repository exists and belongs to user
    const repository = await RepositoryModel.findById(repositoryId);
    if (!repository) {
      res.status(404).json({
        error: {
          code: 'REPOSITORY_NOT_FOUND',
          message: 'Repository not found',
          retryable: false,
          suggestedAction: 'Check the repository ID'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Verify all vulnerabilities exist and belong to user
    const vulnerabilities = await VulnerabilityModel.find({
      _id: { $in: vulnerabilityIds }
    });

    if (vulnerabilities.length !== vulnerabilityIds.length) {
      res.status(404).json({
        error: {
          code: 'VULNERABILITIES_NOT_FOUND',
          message: 'One or more vulnerabilities not found',
          retryable: false,
          suggestedAction: 'Check the vulnerability IDs'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Verify ownership of vulnerabilities
    for (const vuln of vulnerabilities) {
      const scanReport = await ScanReportModel.findOne({
        _id: vuln.reportId,
        userId
      });

      if (!scanReport) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to one or more vulnerabilities',
            retryable: false,
            suggestedAction: 'Check your permissions'
          },
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }
    }

    // Get access token
    const accessToken = await authService.getToken(userId);
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

    // Generate commit message
    const fixSummary = vulnerabilities.map(v => ({
      severity: v.severity,
      title: v.title
    }));
    const commitMessage = commitService.generateCommitMessage(fixSummary);

    // Prepare file changes
    const fileChanges: FileChange[] = files.map((file: any) => ({
      path: file.path,
      content: file.content,
      operation: file.operation || 'modify'
    }));

    // Commit changes to GitHub
    const commitResult = await commitService.commitChanges(
      repositoryId,
      fileChanges,
      commitMessage,
      accessToken.token,
      branch
    );

    if (!commitResult.success) {
      res.status(409).json({
        error: {
          code: 'COMMIT_CONFLICT',
          message: 'Commit failed due to conflicts',
          details: { conflicts: commitResult.conflicts },
          retryable: true,
          suggestedAction: 'Resolve conflicts and try again'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Update vulnerability statuses to 'verified'
    await commitService.updateVulnerabilityStatuses(
      vulnerabilityIds,
      commitResult.commitSha,
      repositoryId,
      userId
    );

    // Create commit record
    const targetBranch = branch || repository.defaultBranch;
    const commitRecord = await CommitModel.create({
      repositoryId,
      userId,
      commitSha: commitResult.commitSha,
      message: commitMessage,
      branch: targetBranch,
      fixedVulnerabilities: vulnerabilityIds,
      timestamp: new Date(),
      success: true,
      conflicts: []
    });

    res.json({
      success: true,
      commit: {
        id: commitRecord._id,
        sha: commitResult.commitSha,
        message: commitMessage,
        branch: targetBranch,
        fixedCount: vulnerabilityIds.length
      },
      message: 'Fixes committed successfully to GitHub'
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'COMMIT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to commit changes',
        retryable: true,
        suggestedAction: 'Try again or check repository access'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * GET /api/commits/:id/status
 * Get the status of a commit
 */
router.get('/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const commitId = req.params.id;

    // Find the commit
    const commit = await CommitModel.findById(commitId)
      .populate('repositoryId', 'name fullName')
      .populate('fixedVulnerabilities', 'title severity fixStatus');

    if (!commit) {
      res.status(404).json({
        error: {
          code: 'COMMIT_NOT_FOUND',
          message: 'Commit not found',
          retryable: false,
          suggestedAction: 'Check the commit ID'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Verify ownership
    if (commit.userId.toString() !== userId) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this commit',
          retryable: false,
          suggestedAction: 'Check your permissions'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    res.json({
      success: true,
      commit: {
        id: commit._id,
        sha: commit.commitSha,
        message: commit.message,
        branch: commit.branch,
        timestamp: commit.timestamp,
        success: commit.success,
        conflicts: commit.conflicts,
        fixedVulnerabilities: commit.fixedVulnerabilities,
        repository: commit.repositoryId
      }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'COMMIT_STATUS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get commit status',
        retryable: true,
        suggestedAction: 'Try again'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

export default router;
