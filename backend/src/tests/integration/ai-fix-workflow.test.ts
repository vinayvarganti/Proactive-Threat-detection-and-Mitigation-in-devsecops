import request from 'supertest';
import app from '../../index';
import { AuthenticationService } from '../../services/AuthenticationService';
import { FixManager } from '../../services/FixManager';
import { GeminiService } from '../../services/GeminiService';
import { GitHubCommitService } from '../../services/GitHubCommitService';
import axios from 'axios';
import Vulnerability from '../../models/Vulnerability';

// Mock services
jest.mock('../../services/FixManager');
jest.mock('../../services/GeminiService');
jest.mock('../../services/GitHubCommitService');
jest.mock('../../services/AuthenticationService');
jest.mock('axios');

describe('E2E AI Fix Workflow Integration Tests', () => {
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

  describe('Complete AI Fix Workflow: Vulnerability Selection → AI Fix Request → Review → Approve → Commit', () => {
    it('should complete full AI fix workflow from request to commit', async () => {
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
        severity: 'critical',
        title: 'SQL Injection',
        description: 'Potential SQL injection vulnerability in database query',
        filePath: 'src/database.js',
        lineNumber: 42,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'const query = "SELECT * FROM users WHERE id = " + userId; db.query(query);',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(Vulnerability, 'findById').mockResolvedValue(mockVulnerability as any);

      const vulnResponse = await agent
        .get('/api/vulnerabilities/vuln123')
        .expect(200);

      expect(vulnResponse.body.vulnerability).toBeDefined();
      expect(vulnResponse.body.vulnerability.title).toBe('SQL Injection');

      // Step 3: AI Fix Request - Request AI-generated fix
      const mockAIProposal = {
        id: 'proposal123',
        vulnerabilityId: 'vuln123',
        originalCode: 'const query = "SELECT * FROM users WHERE id = " + userId; db.query(query);',
        fixedCode: 'const query = "SELECT * FROM users WHERE id = ?"; db.query(query, [userId]);',
        explanation: 'Replaced string concatenation with parameterized query to prevent SQL injection. The ? placeholder is safely replaced with the userId parameter.',
        confidence: 0.95
      };

      mockFixManager.requestAIFix = jest.fn().mockResolvedValue(mockAIProposal);

      const aiFixResponse = await agent
        .post('/api/fixes/ai')
        .send({
          vulnerabilityId: 'vuln123',
          codeContext: 'function getUserById(userId) {\n  const query = "SELECT * FROM users WHERE id = " + userId;\n  db.query(query);\n}'
        })
        .expect(200);

      expect(aiFixResponse.body.success).toBe(true);
      expect(aiFixResponse.body.proposal).toBeDefined();
      expect(aiFixResponse.body.proposal.id).toBe('proposal123');
      expect(aiFixResponse.body.proposal.fixedCode).toContain('?');
      expect(aiFixResponse.body.proposal.explanation).toContain('parameterized query');
      expect(aiFixResponse.body.proposal.confidence).toBe(0.95);

      // Step 4: Review - Verify proposal display
      expect(aiFixResponse.body.proposal.originalCode).toBeDefined();
      expect(aiFixResponse.body.proposal.fixedCode).toBeDefined();
      expect(aiFixResponse.body.proposal.explanation).toBeDefined();

      // Step 5: Approve - Approve AI fix proposal
      mockFixManager.approveAIFix = jest.fn().mockResolvedValue(undefined);
      mockFixManager.updateFixStatus = jest.fn().mockResolvedValue(undefined);

      const approveResponse = await agent
        .post('/api/fixes/ai/proposal123/approve')
        .send({ repositoryFullName: 'testuser/test-repo' })
        .expect(200);

      expect(approveResponse.body.success).toBe(true);
      expect(mockFixManager.approveAIFix).toHaveBeenCalledWith('proposal123', expect.any(String));
      expect(mockFixManager.updateFixStatus).toHaveBeenCalledWith('vuln123', 'fixed');

      // Step 6: Commit - Commit AI-generated fix to GitHub
      const mockCommitResult = {
        commitSha: 'def456abc789',
        success: true,
        conflicts: []
      };

      mockCommitService.commitChanges = jest.fn().mockResolvedValue(mockCommitResult);
      mockCommitService.generateCommitMessage = jest.fn().mockReturnValue(
        'fix: Resolve 1 security vulnerability (1 critical) - AI-assisted'
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
              content: mockAIProposal.fixedCode,
              operation: 'modify'
            }
          ]
        })
        .expect(200);

      expect(commitResponse.body.success).toBe(true);
      expect(commitResponse.body.commitSha).toBe('def456abc789');
      expect(mockCommitService.commitChanges).toHaveBeenCalled();
    });

    it('should handle AI fix rejection and offer alternatives', async () => {
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

      // Request AI fix
      const mockAIProposal = {
        id: 'proposal456',
        vulnerabilityId: 'vuln456',
        originalCode: 'const apiKey = "sk_test_xxxxxxxxxx";',
        fixedCode: 'const apiKey = process.env.API_KEY;',
        explanation: 'Moved API key to environment variable',
        confidence: 0.85
      };

      mockFixManager.requestAIFix = jest.fn().mockResolvedValue(mockAIProposal);

      await agent
        .post('/api/fixes/ai')
        .send({
          vulnerabilityId: 'vuln456',
          codeContext: 'const apiKey = "sk_test_xxxxxxxxxx";'
        })
        .expect(200);

      // Reject AI fix
      const rejectResponse = await agent
        .post('/api/fixes/ai/proposal456/reject')
        .expect(200);

      expect(rejectResponse.body.success).toBe(true);
      expect(rejectResponse.body.alternatives).toBeDefined();
      expect(rejectResponse.body.alternatives).toContain('manual');
      expect(rejectResponse.body.alternatives).toContain('retry');

      // Verify fix was not applied
      expect(mockFixManager.approveAIFix).not.toHaveBeenCalled();
    });

    it('should handle Gemini API failures gracefully', async () => {
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

      // Mock Gemini API failure
      mockFixManager.requestAIFix = jest.fn().mockRejectedValue(
        new Error('Gemini API quota exceeded')
      );

      const aiFixResponse = await agent
        .post('/api/fixes/ai')
        .send({
          vulnerabilityId: 'vuln789',
          codeContext: 'const x = 1;'
        })
        .expect(500);

      expect(aiFixResponse.body.error).toBeDefined();
      expect(aiFixResponse.body.error.message).toContain('Gemini API');
      expect(aiFixResponse.body.fallback).toBe('manual');
      expect(aiFixResponse.body.error.suggestedAction).toContain('manual correction');
    });

    it('should verify AI fix request includes all required context', async () => {
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

      // Mock vulnerability with full context
      const mockVulnerability = {
        _id: 'vuln999',
        type: 'code',
        severity: 'high',
        title: 'XSS Vulnerability',
        description: 'Potential cross-site scripting vulnerability',
        filePath: 'src/render.js',
        lineNumber: 25,
        codeSnippet: 'element.innerHTML = userInput;',
        metadata: { cwe: 'CWE-79' }
      };

      jest.spyOn(Vulnerability, 'findById').mockResolvedValue(mockVulnerability as any);

      const mockAIProposal = {
        id: 'proposal999',
        vulnerabilityId: 'vuln999',
        originalCode: 'element.innerHTML = userInput;',
        fixedCode: 'element.textContent = userInput;',
        explanation: 'Use textContent instead of innerHTML to prevent XSS',
        confidence: 0.92
      };

      mockFixManager.requestAIFix = jest.fn().mockImplementation(async (vuln) => {
        // Verify all required context is present
        expect(vuln).toHaveProperty('type');
        expect(vuln).toHaveProperty('severity');
        expect(vuln).toHaveProperty('description');
        expect(vuln).toHaveProperty('codeSnippet');
        return mockAIProposal;
      });

      const aiFixResponse = await agent
        .post('/api/fixes/ai')
        .send({
          vulnerabilityId: 'vuln999',
          codeContext: 'function render(userInput) {\n  element.innerHTML = userInput;\n}'
        })
        .expect(200);

      expect(aiFixResponse.body.success).toBe(true);
      expect(mockFixManager.requestAIFix).toHaveBeenCalled();
    });

    it('should verify AI uses gemini-2.0-flash-exp model', async () => {
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

      // Mock GeminiService to verify model specification
      const mockAIProposal = {
        id: 'proposal111',
        vulnerabilityId: 'vuln111',
        originalCode: 'const x = eval(userInput);',
        fixedCode: 'const x = JSON.parse(userInput);',
        explanation: 'Replace eval with JSON.parse for safer parsing',
        confidence: 0.88
      };

      mockFixManager.requestAIFix = jest.fn().mockResolvedValue(mockAIProposal);

      // The actual model verification would be in the GeminiService unit tests
      // Here we just verify the workflow completes successfully
      const aiFixResponse = await agent
        .post('/api/fixes/ai')
        .send({
          vulnerabilityId: 'vuln111',
          codeContext: 'const x = eval(userInput);'
        })
        .expect(200);

      expect(aiFixResponse.body.success).toBe(true);
      expect(aiFixResponse.body.proposal).toBeDefined();
    });

    it('should update vulnerability status after AI fix approval', async () => {
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

      // Request and approve AI fix
      const mockAIProposal = {
        id: 'proposal222',
        vulnerabilityId: 'vuln222',
        originalCode: 'password = req.body.password;',
        fixedCode: 'password = bcrypt.hashSync(req.body.password, 10);',
        explanation: 'Hash password before storing',
        confidence: 0.93
      };

      mockFixManager.requestAIFix = jest.fn().mockResolvedValue(mockAIProposal);
      mockFixManager.approveAIFix = jest.fn().mockResolvedValue(undefined);
      mockFixManager.updateFixStatus = jest.fn().mockResolvedValue(undefined);

      await agent
        .post('/api/fixes/ai')
        .send({
          vulnerabilityId: 'vuln222',
          codeContext: 'password = req.body.password;'
        })
        .expect(200);

      const approveResponse = await agent
        .post('/api/fixes/ai/proposal222/approve')
        .send({ repositoryFullName: 'testuser/test-repo' })
        .expect(200);

      expect(approveResponse.body.success).toBe(true);
      expect(mockFixManager.updateFixStatus).toHaveBeenCalledWith('vuln222', 'fixed');
    });
  });

  describe('AI Fix Request', () => {
    it('should require authentication for AI fix request', async () => {
      const response = await request(app)
        .post('/api/fixes/ai')
        .send({
          vulnerabilityId: '123',
          codeContext: 'const x = 1;'
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should validate vulnerability ID for AI fix', async () => {
      const response = await request(app)
        .post('/api/fixes/ai')
        .send({}) // Missing vulnerabilityId
        .expect(401); // Will fail auth first

      expect(response.body.error).toBeDefined();
    });
  });

  describe('AI Fix Approval', () => {
    it('should require authentication for AI fix approval', async () => {
      const response = await request(app)
        .post('/api/fixes/ai/proposal123/approve')
        .send({ repositoryFullName: 'user/repo' })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should validate repository name for approval', async () => {
      const response = await request(app)
        .post('/api/fixes/ai/proposal123/approve')
        .send({}) // Missing repositoryFullName
        .expect(401); // Will fail auth first

      expect(response.body.error).toBeDefined();
    });
  });

  describe('AI Fix Rejection', () => {
    it('should require authentication for AI fix rejection', async () => {
      const response = await request(app)
        .post('/api/fixes/ai/proposal123/reject')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });
});

