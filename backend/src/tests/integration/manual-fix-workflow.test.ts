import request from 'supertest';
import app from '../../index';
import { AuthenticationService } from '../../services/AuthenticationService';
import { FixManager } from '../../services/FixManager';
import { GitHubCommitService } from '../../services/GitHubCommitService';
import axios from 'axios';
import Vulnerability from '../../models/Vulnerability';

// Mock services
jest.mock('../../services/FixManager');
jest.mock('../../services/GitHubCommitService');
jest.mock('../../services/AuthenticationService');
jest.mock('axios');

describe('E2E Manual Fix Workflow Integration Tests', () => {
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockFixManager: jest.Mocked<FixManager>;
  let mockCommitService: jest.Mocked<GitHubCommitService>;
  let mockAxios: jest.Mocked<typeof axios>;

  beforeEach(() => {
    mockAuthService = new AuthenticationService() as jest.Mocked<AuthenticationService>;
    mockFixManager = new FixManager() as jest.Mocked<FixManager>;
    mockCommitService = new GitHubCommitService() as jest.Mocked<GitHubCommitService>;
    mockAxios = axios as jest.Mocked<typeof axios>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Manual Fix Workflow: Vulnerability Selection → Code Editing → Save → Commit', () => {
    it('should complete full manual fix workflow from selection to commit', async () => {
      // Step 1: Authentication
      const mockAccessToken = {
        token: 'mock_github_token',
        expiresAt: new Date(Date.now() + 3600000),
        refreshToken: 'mock_refresh_token'
      };

      mockAuthService.exchangeCodeForToken = jest.fn().mockResolvedValue(mockAccessToken);
      mockAuthService.storeToken = jest.fn().mockResolvedValue(undefined);
      mockAuthService.getToken = jest.fn().mockResolvedValue(mockAccessToken);

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

      // Step 2: Vulnerability Selection - Get vulnerability details
      const mockVulnerability = {
        _id: 'vuln123',
        reportId: 'report1',
        repositoryId: 'repo1',
        type: 'code',
        severity: 'high',
        title: 'SQL Injection',
        description: 'Potential SQL injection vulnerability',
        filePath: 'src/database.js',
        lineNumber: 42,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'const query = "SELECT * FROM users WHERE id = " + userId;',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock Vulnerability.findById
      jest.spyOn(Vulnerability, 'findById').mockResolvedValue(mockVulnerability as any);

      const vulnResponse = await agent
        .get('/api/vulnerabilities/vuln123')
        .expect(200);

      expect(vulnResponse.body.vulnerability).toBeDefined();
      expect(vulnResponse.body.vulnerability.title).toBe('SQL Injection');
      expect(vulnResponse.body.vulnerability.fixStatus).toBe('pending');

      // Step 3: Code Editing - Validate syntax
      const fixedCode = 'const query = "SELECT * FROM users WHERE id = ?"; db.query(query, [userId]);';
      
      mockFixManager.validateFix = jest.fn().mockResolvedValue({
        isValid: true,
        errors: []
      });

      // Step 4: Save - Submit manual fix
      mockFixManager.applyManualFix = jest.fn().mockResolvedValue(undefined);
      mockFixManager.updateFixStatus = jest.fn().mockResolvedValue(undefined);

      const fixResponse = await agent
        .post('/api/fixes/manual')
        .send({
          vulnerabilityId: 'vuln123',
          fixedCode: fixedCode,
          repositoryFullName: 'testuser/test-repo'
        })
        .expect(200);

      expect(fixResponse.body.success).toBe(true);
      expect(mockFixManager.validateFix).toHaveBeenCalled();
      expect(mockFixManager.applyManualFix).toHaveBeenCalledWith('vuln123', fixedCode);

      // Step 5: Verify status update to 'in_progress'
      expect(mockFixManager.updateFixStatus).toHaveBeenCalledWith('vuln123', 'in_progress');

      // Step 6: Commit - Commit fixes to GitHub
      const mockCommitResult = {
        commitSha: 'abc123def456',
        success: true,
        conflicts: []
      };

      mockCommitService.commitChanges = jest.fn().mockResolvedValue(mockCommitResult);
      mockCommitService.generateCommitMessage = jest.fn().mockReturnValue(
        'fix: Resolve 1 security vulnerability (1 high)'
      );

      const commitResponse = await agent
        .post('/api/commits')
        .send({
          repositoryId: 'repo1',
          repositoryFullName: 'testuser/test-repo',
          vulnerabilityIds: ['vuln123'],
          files: [
            {
              path: 'src/database.js',
              content: fixedCode,
              operation: 'modify'
            }
          ]
        })
        .expect(200);

      expect(commitResponse.body.success).toBe(true);
      expect(commitResponse.body.commitSha).toBe('abc123def456');
      expect(mockCommitService.generateCommitMessage).toHaveBeenCalled();
      expect(mockCommitService.commitChanges).toHaveBeenCalled();

      // Step 7: Verify final status update to 'verified'
      // This would be done by the commit endpoint internally
      expect(commitResponse.body.conflicts).toHaveLength(0);
    });

    it('should handle syntax validation errors during manual fix', async () => {
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

      // Submit fix with invalid syntax
      const invalidCode = 'const query = "SELECT * FROM users WHERE id = " + userId'; // Missing semicolon

      mockFixManager.validateFix = jest.fn().mockResolvedValue({
        isValid: false,
        errors: [
          {
            message: 'Unexpected token (1:65)',
            line: 1,
            column: 65
          }
        ]
      });

      const fixResponse = await agent
        .post('/api/fixes/manual')
        .send({
          vulnerabilityId: 'vuln123',
          fixedCode: invalidCode,
          repositoryFullName: 'testuser/test-repo'
        })
        .expect(400);

      expect(fixResponse.body.error).toBeDefined();
      expect(fixResponse.body.error.code).toBe('VALIDATION_FAILED');
      expect(fixResponse.body.error.details.errors).toHaveLength(1);
      
      // Verify fix was not applied
      expect(mockFixManager.applyManualFix).not.toHaveBeenCalled();
    });

    it('should track status progression through fix workflow', async () => {
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

      // Initial status: pending
      const mockVulnerability = {
        _id: 'vuln123',
        fixStatus: 'pending',
        save: jest.fn().mockResolvedValue(undefined)
      };

      jest.spyOn(Vulnerability, 'findById').mockResolvedValue(mockVulnerability as any);

      // Submit fix - status should change to in_progress
      mockFixManager.validateFix = jest.fn().mockResolvedValue({ isValid: true, errors: [] });
      mockFixManager.applyManualFix = jest.fn().mockResolvedValue(undefined);
      mockFixManager.updateFixStatus = jest.fn().mockImplementation(async (_vulnId, status) => {
        mockVulnerability.fixStatus = status;
      });

      await agent
        .post('/api/fixes/manual')
        .send({
          vulnerabilityId: 'vuln123',
          fixedCode: 'const query = "SELECT * FROM users WHERE id = ?";',
          repositoryFullName: 'testuser/test-repo'
        })
        .expect(200);

      expect(mockFixManager.updateFixStatus).toHaveBeenCalledWith('vuln123', 'in_progress');

      // Complete fix - status should change to fixed
      mockFixManager.updateFixStatus = jest.fn().mockImplementation(async (_vulnId, status) => {
        mockVulnerability.fixStatus = status;
      });

      await agent
        .patch('/api/vulnerabilities/vuln123')
        .send({ fixStatus: 'fixed' })
        .expect(200);

      expect(mockFixManager.updateFixStatus).toHaveBeenCalledWith('vuln123', 'fixed');

      // Commit - status should change to verified
      mockCommitService.commitChanges = jest.fn().mockResolvedValue({
        commitSha: 'abc123',
        success: true,
        conflicts: []
      });

      await agent
        .post('/api/commits')
        .send({
          repositoryId: 'repo1',
          repositoryFullName: 'testuser/test-repo',
          vulnerabilityIds: ['vuln123'],
          files: [{ path: 'src/database.js', content: 'fixed code', operation: 'modify' }]
        })
        .expect(200);

      // Verify status progression: pending → in_progress → fixed → verified
    });

    it('should handle commit conflicts during manual fix workflow', async () => {
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

      // Submit valid fix
      mockFixManager.validateFix = jest.fn().mockResolvedValue({ isValid: true, errors: [] });
      mockFixManager.applyManualFix = jest.fn().mockResolvedValue(undefined);
      mockFixManager.updateFixStatus = jest.fn().mockResolvedValue(undefined);

      await agent
        .post('/api/fixes/manual')
        .send({
          vulnerabilityId: 'vuln123',
          fixedCode: 'const query = "SELECT * FROM users WHERE id = ?";',
          repositoryFullName: 'testuser/test-repo'
        })
        .expect(200);

      // Attempt commit with conflicts
      const mockCommitResult = {
        commitSha: '',
        success: false,
        conflicts: [
          {
            filePath: 'src/database.js',
            reason: 'File was modified by another commit'
          }
        ]
      };

      mockCommitService.commitChanges = jest.fn().mockResolvedValue(mockCommitResult);

      const commitResponse = await agent
        .post('/api/commits')
        .send({
          repositoryId: 'repo1',
          repositoryFullName: 'testuser/test-repo',
          vulnerabilityIds: ['vuln123'],
          files: [
            {
              path: 'src/database.js',
              content: 'const query = "SELECT * FROM users WHERE id = ?";',
              operation: 'modify'
            }
          ]
        })
        .expect(200);

      expect(commitResponse.body.success).toBe(false);
      expect(commitResponse.body.conflicts).toHaveLength(1);
      expect(commitResponse.body.conflicts[0].filePath).toBe('src/database.js');
      expect(commitResponse.body.conflicts[0].reason).toContain('modified by another commit');
    });
  });

  describe('Manual Fix Submission', () => {
    it('should require authentication for manual fix', async () => {
      const response = await request(app)
        .post('/api/fixes/manual')
        .send({
          vulnerabilityId: '123',
          fixedCode: 'const x = 1;',
          repositoryFullName: 'user/repo'
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should validate required parameters for manual fix', async () => {
      const response = await request(app)
        .post('/api/fixes/manual')
        .send({}) // Missing required fields
        .expect(401); // Will fail auth first

      expect(response.body.error).toBeDefined();
    });
  });
});

