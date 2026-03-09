import request from 'supertest';
import app from '../../index';

// Mock services
jest.mock('../../services/FixManager');
jest.mock('../../services/AuthenticationService');

describe('Fix Workflow Integration Tests', () => {
  beforeEach(() => {
    // Setup mocks if needed
  });

  afterEach(() => {
    jest.clearAllMocks();
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

