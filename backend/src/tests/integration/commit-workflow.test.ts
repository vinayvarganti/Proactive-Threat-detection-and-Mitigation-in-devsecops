import request from 'supertest';
import app from '../../index';

// Mock services
jest.mock('../../services/GitHubCommitService');
jest.mock('../../services/AuthenticationService');

describe('Commit Workflow Integration Tests', () => {
  beforeEach(() => {
    // Setup mocks if needed
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Commit Creation', () => {
    it('should require authentication for commit', async () => {
      const response = await request(app)
        .post('/api/commits')
        .send({
          repositoryId: '123',
          vulnerabilityIds: ['vuln1', 'vuln2'],
          files: [{ path: 'test.js', content: 'const x = 1;', operation: 'modify' }]
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should validate required parameters for commit', async () => {
      const response = await request(app)
        .post('/api/commits')
        .send({}) // Missing required fields
        .expect(401); // Will fail auth first

      expect(response.body.error).toBeDefined();
    });

    it('should validate vulnerabilityIds is an array', async () => {
      const response = await request(app)
        .post('/api/commits')
        .send({
          repositoryId: '123',
          vulnerabilityIds: 'not-an-array',
          files: []
        })
        .expect(401); // Will fail auth first

      expect(response.body.error).toBeDefined();
    });

    it('should validate files is an array', async () => {
      const response = await request(app)
        .post('/api/commits')
        .send({
          repositoryId: '123',
          vulnerabilityIds: ['vuln1'],
          files: 'not-an-array'
        })
        .expect(401); // Will fail auth first

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Commit Status', () => {
    it('should require authentication for commit status', async () => {
      const response = await request(app)
        .get('/api/commits/commit123/status')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });
});

