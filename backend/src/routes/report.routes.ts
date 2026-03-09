import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/session';
import ScanReportModel from '../models/ScanReport';
import VulnerabilityModel from '../models/Vulnerability';

const router = Router();

/**
 * GET /api/reports
 * List scan reports for the authenticated user
 * Query params: repositoryId (optional)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const githubId = req.session.userId!;
    const { repositoryId } = req.query;

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

    // Build filter query
    const filter: any = { userId: user._id };

    // Filter by repository if provided
    if (repositoryId && typeof repositoryId === 'string') {
      filter.repositoryId = repositoryId;
    }

    // Find scan reports
    const reports = await ScanReportModel.find(filter)
      .sort({ timestamp: -1 }) // Most recent first
      .populate('repositoryId', 'name fullName githubRepoId')
      .populate('vulnerabilities');

    // Format response with summary information and repository details
    const formattedReports = reports.map(report => {
      const repo = report.repositoryId as any;
      return {
        id: report._id,
        repositoryId: repo?._id?.toString() || report.repositoryId,
        repositoryName: repo?.name || 'Unknown',
        repositoryFullName: repo?.fullName || 'Unknown',
        timestamp: report.timestamp,
        summary: {
          total: report.summary.total,
          bySeverity: report.summary.bySeverity,
          byStatus: report.summary.byStatus
        },
        scanDuration: report.scanDuration,
        scannerResults: report.scannerResults
      };
    });

    res.json({
      success: true,
      reports: formattedReports,
      count: formattedReports.length
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'REPORT_LIST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to list reports',
        retryable: true,
        suggestedAction: 'Try again'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * GET /api/reports/:id
 * Get a specific scan report with full details
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const githubId = req.session.userId!;
    const reportId = req.params.id;

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

    // Find the report
    const report = await ScanReportModel.findById(reportId)
      .populate('repositoryId', 'name fullName defaultBranch githubRepoId')
      .populate('vulnerabilities');

    if (!report) {
      res.status(404).json({
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Scan report not found',
          retryable: false,
          suggestedAction: 'Check the report ID'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Verify ownership
    if (report.userId.toString() !== user._id.toString()) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this report',
          retryable: false,
          suggestedAction: 'Check your permissions'
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }

    // Get full vulnerability details
    const vulnerabilities = await VulnerabilityModel.find({
      _id: { $in: report.vulnerabilities }
    }).sort({ severity: 1, createdAt: -1 });

    // Custom sort to ensure correct severity order (critical, high, medium, low)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    vulnerabilities.sort((a, b) => {
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Format vulnerabilities to include repository information
    const repo = report.repositoryId as any;
    const repositoryName = repo?.name || 'Unknown';
    const repositoryFullName = repo?.fullName || 'Unknown';
    const repositoryIdStr = repo?._id?.toString() || report.repositoryId;

    const formattedVulnerabilities = vulnerabilities.map(vuln => ({
      ...vuln.toObject(),
      repositoryId: repositoryIdStr,
      repositoryName,
      repositoryFullName
    }));

    res.json({
      success: true,
      report: {
        id: report._id,
        repositoryId: repositoryIdStr,
        repositoryName,
        repositoryFullName,
        timestamp: report.timestamp,
        vulnerabilities: formattedVulnerabilities,
        summary: report.summary,
        scanDuration: report.scanDuration,
        scannerResults: report.scannerResults
      }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'REPORT_FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch report',
        retryable: true,
        suggestedAction: 'Try again'
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

export default router;
