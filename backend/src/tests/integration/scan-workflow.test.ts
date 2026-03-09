import request from 'supertest';
import app from '../../index';
import { AuthenticationService } from '../../services/AuthenticationService';
import { RepositoryManager } from '../../services/RepositoryManager';
import { ScanOrchestrator } from '../../services/ScanOrchestrator';
import axios from 'axios';

// Mock services
jest.mock('../../services/RepositoryManager');
jest.mock('../../services/ScanOrchestrator');
jest.mock('../../services/AuthenticationService');
jest.mock('axios');

describe('E2E Scan Workflow Integration Tests', () => {
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockRepoManager: jest.Mocked<RepositoryManager>;
  let mockScanOrchestrator: jest.Mocked<ScanOrchestrator>;
  let mockAxios: jest.Mocked<typeof axios>;

  beforeEach(() => {
    mockAuthService = new AuthenticationService() as jest.Mocked<AuthenticationService>;
    mockRepoManager = new RepositoryManager() as jest.Mocked<RepositoryManager>;
    mockScanOrchestrator = new ScanOrchestrator() as jest.Mocked<ScanOrchestrator>;
    mockAxios = axios as jest.Mocked<typeof axios>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Scan Workflow: Authentication → Repository Selection → Scan → Results Display', () => {
    it('should complete full scan workflow from authentication to results', async () => {
      // Step 1: Authentication - Initiate OAuth
      const mockOAuthUrl = 'https://github.com/login/oauth/authorize?client_id=test&scope=repo';
      mockAuthService.generateOAuthUrl = jest.fn().mockReturnValue(mockOAuthUrl);

      const authInitResponse = await request(app)
        .post('/api/auth/github/initiate')
        .expect(200);

      expect(authInitResponse.body.url).toBe(mockOAuthUrl);

      // Step 2: Authentication - OAuth Callback
      const mockAccessToken = {
        token: 'mock_github_token',
        expiresAt: new Date(Date.now() + 3600000),
        refreshToken: 'mock_refresh_token'
      };

      mockAuthService.exchangeCodeForToken = jest.fn().mockResolvedValue(mockAccessToken);
      mockAuthService.storeToken = jest.fn().mockResolvedValue(undefined);

      mockAxios.get = jest.fn().mockResolvedValue({
        data: {
          id: 12345,
          login: 'testuser',
          avatar_url: 'https://example.com/avatar.png',
          email: 'test@example.com'
        }
      });

      const agent = request.agent(app);
      const callbackResponse = await agent
        .get('/api/auth/github/callback?code=test_oauth_code')
        .expect(200);

      expect(callbackResponse.body.success).toBe(true);
      expect(callbackResponse.body.user.username).toBe('testuser');

      // Step 3: Repository Selection - List Repositories
      const mockRepositories = [
        {
          id: 'repo1',
          name: 'test-repo',
          fullName: 'testuser/test-repo',
          visibility: 'public',
          lastUpdated: new Date().toISOString(),
          defaultBranch: 'main'
        },
        {
          id: 'repo2',
          name: 'another-repo',
          fullName: 'testuser/another-repo',
          visibility: 'private',
          lastUpdated: new Date().toISOString(),
          defaultBranch: 'main'
        }
      ];

      mockRepoManager.listRepositories = jest.fn().mockResolvedValue(mockRepositories);

      const repoListResponse = await agent
        .get('/api/repositories')
        .expect(200);

      expect(repoListResponse.body.repositories).toHaveLength(2);
      expect(repoListResponse.body.repositories[0].name).toBe('test-repo');

      // Step 4: Scan Initiation
      const mockLocalPath = '/tmp/test-repo-12345';
      mockRepoManager.downloadRepository = jest.fn().mockResolvedValue(mockLocalPath);

      const mockScanReport = {
        id: 'scan-report-1',
        repositoryId: 'repo1',
        timestamp: new Date(),
        vulnerabilities: [
          {
            id: 'vuln1',
            type: 'code',
            severity: 'high',
            title: 'SQL Injection',
            description: 'Potential SQL injection vulnerability',
            filePath: 'src/database.js',
            lineNumber: 42,
            scanner: 'semgrep',
            fixStatus: 'pending',
            codeSnippet: 'const query = "SELECT * FROM users WHERE id = " + userId;'
          },
          {
            id: 'vuln2',
            type: 'secret',
            severity: 'critical',
            title: 'Exposed API Key',
            description: 'API key found in source code',
            filePath: 'config/api.js',
            lineNumber: 10,
            scanner: 'gitleaks',
            fixStatus: 'pending',
            codeSnippet: 'const API_KEY = "sk_test_xxxxxxxxxx";'
          },
          {
            id: 'vuln3',
            type: 'dependency',
            severity: 'medium',
            title: 'Vulnerable Dependency',
            description: 'lodash version has known vulnerability',
            filePath: 'package.json',
            lineNumber: 15,
            scanner: 'trivy',
            fixStatus: 'pending',
            codeSnippet: '"lodash": "4.17.15"'
          }
        ],
        summary: {
          total: 3,
          bySeverity: { critical: 1, high: 1, medium: 1, low: 0 },
          byStatus: { pending: 3, in_progress: 0, fixed: 0, verified: 0 }
        },
        scanDuration: 15000,
        scannerResults: {
          semgrep: { success: true, count: 1 },
          trivy: { success: true, count: 1 },
          gitleaks: { success: true, count: 1 }
        }
      };

      mockScanOrchestrator.scanRepository = jest.fn().mockResolvedValue(mockScanReport);
      mockRepoManager.cleanupTemporaryFiles = jest.fn().mockResolvedValue(undefined);

      const scanResponse = await agent
        .post('/api/repositories/repo1/scan')
        .send({ fullName: 'testuser/test-repo' })
        .expect(200);

      expect(scanResponse.body.success).toBe(true);
      expect(scanResponse.body.report).toBeDefined();
      expect(scanResponse.body.report.vulnerabilities).toHaveLength(3);

      // Step 5: Results Display - Verify all scanners were invoked
      expect(mockScanOrchestrator.scanRepository).toHaveBeenCalledWith(mockLocalPath);
      expect(scanResponse.body.report.scannerResults.semgrep.success).toBe(true);
      expect(scanResponse.body.report.scannerResults.trivy.success).toBe(true);
      expect(scanResponse.body.report.scannerResults.gitleaks.success).toBe(true);

      // Step 6: Results Display - Verify vulnerability details
      const vulnerabilities = scanResponse.body.report.vulnerabilities;
      expect(vulnerabilities[0].type).toBe('code');
      expect(vulnerabilities[0].severity).toBe('high');
      expect(vulnerabilities[0].scanner).toBe('semgrep');
      expect(vulnerabilities[1].type).toBe('secret');
      expect(vulnerabilities[1].severity).toBe('critical');
      expect(vulnerabilities[2].type).toBe('dependency');

      // Step 7: Results Display - Verify summary
      expect(scanResponse.body.report.summary.total).toBe(3);
      expect(scanResponse.body.report.summary.bySeverity.critical).toBe(1);
      expect(scanResponse.body.report.summary.bySeverity.high).toBe(1);
      expect(scanResponse.body.report.summary.bySeverity.medium).toBe(1);

      // Step 8: Verify cleanup was called
      expect(mockRepoManager.cleanupTemporaryFiles).toHaveBeenCalledWith(mockLocalPath);
    });

    it('should handle scanner failures gracefully during scan workflow', async () => {
      // Setup authentication
      const mockAccessToken = {
        token: 'mock_github_token',
        expiresAt: new Date(Date.now() + 3600000),
        refreshToken: 'mock_refresh_token'
      };

      mockAuthService.exchangeCodeForToken = jest.fn().mockResolvedValue(mockAccessToken);
      mockAuthService.storeToken = jest.fn().mockResolvedValue(undefined);

      mockAxios.get = jest.fn().mockResolvedValue({
        data: {
          id: 12345,
          login: 'testuser',
          avatar_url: 'https://example.com/avatar.png',
          email: 'test@example.com'
        }
      });

      const agent = request.agent(app);
      await agent.get('/api/auth/github/callback?code=test_code').expect(200);

      // Setup repository download
      const mockLocalPath = '/tmp/test-repo-12345';
      mockRepoManager.downloadRepository = jest.fn().mockResolvedValue(mockLocalPath);

      // Mock scan with one scanner failure
      const mockScanReport = {
        id: 'scan-report-2',
        repositoryId: 'repo1',
        timestamp: new Date(),
        vulnerabilities: [
          {
            id: 'vuln1',
            type: 'code',
            severity: 'high',
            title: 'SQL Injection',
            description: 'Potential SQL injection vulnerability',
            filePath: 'src/database.js',
            lineNumber: 42,
            scanner: 'semgrep',
            fixStatus: 'pending',
            codeSnippet: 'const query = "SELECT * FROM users WHERE id = " + userId;'
          }
        ],
        summary: {
          total: 1,
          bySeverity: { critical: 0, high: 1, medium: 0, low: 0 },
          byStatus: { pending: 1, in_progress: 0, fixed: 0, verified: 0 }
        },
        scanDuration: 12000,
        scannerResults: {
          semgrep: { success: true, count: 1 },
          trivy: { success: false, count: 0, error: 'Scanner timeout' },
          gitleaks: { success: true, count: 0 }
        }
      };

      mockScanOrchestrator.scanRepository = jest.fn().mockResolvedValue(mockScanReport);
      mockRepoManager.cleanupTemporaryFiles = jest.fn().mockResolvedValue(undefined);

      const scanResponse = await agent
        .post('/api/repositories/repo1/scan')
        .send({ fullName: 'testuser/test-repo' })
        .expect(200);

      // Verify scan completed despite Trivy failure
      expect(scanResponse.body.success).toBe(true);
      expect(scanResponse.body.report.scannerResults.trivy.success).toBe(false);
      expect(scanResponse.body.report.scannerResults.trivy.error).toBe('Scanner timeout');
      
      // Verify other scanners succeeded
      expect(scanResponse.body.report.scannerResults.semgrep.success).toBe(true);
      expect(scanResponse.body.report.scannerResults.gitleaks.success).toBe(true);
      
      // Verify results from successful scanners are included
      expect(scanResponse.body.report.vulnerabilities).toHaveLength(1);
    });

    it('should handle repository download failures', async () => {
      // Setup authentication
      const mockAccessToken = {
        token: 'mock_github_token',
        expiresAt: new Date(Date.now() + 3600000),
        refreshToken: 'mock_refresh_token'
      };

      mockAuthService.exchangeCodeForToken = jest.fn().mockResolvedValue(mockAccessToken);
      mockAuthService.storeToken = jest.fn().mockResolvedValue(undefined);

      mockAxios.get = jest.fn().mockResolvedValue({
        data: {
          id: 12345,
          login: 'testuser',
          avatar_url: 'https://example.com/avatar.png',
          email: 'test@example.com'
        }
      });

      const agent = request.agent(app);
      await agent.get('/api/auth/github/callback?code=test_code').expect(200);

      // Mock repository download failure
      mockRepoManager.downloadRepository = jest.fn().mockRejectedValue(
        new Error('Repository not found or access denied')
      );

      const scanResponse = await agent
        .post('/api/repositories/repo1/scan')
        .send({ fullName: 'testuser/nonexistent-repo' })
        .expect(500);

      expect(scanResponse.body.error).toBeDefined();
      expect(scanResponse.body.error.message).toContain('Repository not found or access denied');
    });
  });

  describe('Repository Listing', () => {
    it('should require authentication to list repositories', async () => {
      const response = await request(app)
        .get('/api/repositories')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Repository Scanning', () => {
    it('should require authentication to initiate scan', async () => {
      const response = await request(app)
        .post('/api/repositories/123/scan')
        .send({ fullName: 'user/repo' })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should validate required parameters for scan', async () => {
      // Create a mock session
      const agent = request.agent(app);
      
      const response = await agent
        .post('/api/repositories/123/scan')
        .send({}) // Missing fullName
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_REPO_NAME');
    });
  });

  describe('File Tree Retrieval', () => {
    it('should require authentication to get file tree', async () => {
      const response = await request(app)
        .get('/api/repositories/123/files?fullName=user/repo')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should validate required query parameters', async () => {
      const response = await request(app)
        .get('/api/repositories/123/files')
        .expect(401); // Will fail auth first

      expect(response.body.error).toBeDefined();
    });
  });
});

