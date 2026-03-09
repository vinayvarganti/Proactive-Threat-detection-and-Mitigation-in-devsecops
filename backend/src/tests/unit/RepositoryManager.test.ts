import { RepositoryManager } from '../../services/RepositoryManager';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock axios.isAxiosError
const mockIsAxiosError = jest.fn();
(axios as any).isAxiosError = mockIsAxiosError;

describe('RepositoryManager Unit Tests', () => {
  let repoManager: RepositoryManager;
  let testTempDir: string;

  beforeAll(async () => {
    testTempDir = path.join(os.tmpdir(), `test-repo-unit-${Date.now()}`);
    await fs.mkdir(testTempDir, { recursive: true });
  });

  beforeEach(() => {
    repoManager = new RepositoryManager();
    jest.clearAllMocks();
    mockIsAxiosError.mockReturnValue(false); // Default to false
  });

  afterAll(async () => {
    try {
      await fs.rm(testTempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test temp directory:', error);
    }
  });

  describe('Repository Download Failure Handling', () => {
    describe('Network Failures', () => {
      it('should throw error on network timeout', async () => {
        const repoFullName = 'test-owner/test-repo';
        const accessToken = 'test-token';

        // Mock network timeout
        const error: any = new Error('Network timeout');
        error.code = 'ETIMEDOUT';
        error.isAxiosError = false;
        mockedAxios.get.mockRejectedValueOnce(error);

        await expect(
          repoManager.downloadRepository(repoFullName, accessToken)
        ).rejects.toThrow();
      });

      it('should throw error on connection refused', async () => {
        const repoFullName = 'test-owner/test-repo';
        const accessToken = 'test-token';

        // Mock connection refused
        const error: any = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        error.isAxiosError = false;
        mockedAxios.get.mockRejectedValueOnce(error);

        await expect(
          repoManager.downloadRepository(repoFullName, accessToken)
        ).rejects.toThrow();
      });

      it('should throw error on DNS resolution failure', async () => {
        const repoFullName = 'test-owner/test-repo';
        const accessToken = 'test-token';

        // Mock DNS failure
        const error: any = new Error('DNS lookup failed');
        error.code = 'ENOTFOUND';
        error.isAxiosError = false;
        mockedAxios.get.mockRejectedValueOnce(error);

        await expect(
          repoManager.downloadRepository(repoFullName, accessToken)
        ).rejects.toThrow();
      });
    });

    describe('Invalid Repository Scenarios', () => {
      it('should throw specific error for 404 (repository not found)', async () => {
        const repoFullName = 'test-owner/nonexistent-repo';
        const accessToken = 'test-token';

        // Mock 404 response
        const error: any = new Error('Request failed with status code 404');
        error.response = {
          status: 404,
          statusText: 'Not Found',
          data: { message: 'Not Found' },
          headers: {},
          config: {} as any
        };
        
        mockIsAxiosError.mockReturnValue(true);
        mockedAxios.get.mockRejectedValueOnce(error);

        await expect(
          repoManager.downloadRepository(repoFullName, accessToken)
        ).rejects.toThrow('Repository not found');
      });

      it('should throw specific error for 403 (access denied)', async () => {
        const repoFullName = 'test-owner/private-repo';
        const accessToken = 'invalid-token';

        // Mock 403 response
        const error: any = new Error('Request failed with status code 403');
        error.response = {
          status: 403,
          statusText: 'Forbidden',
          data: { message: 'Forbidden' },
          headers: {},
          config: {} as any
        };
        
        mockIsAxiosError.mockReturnValue(true);
        mockedAxios.get.mockRejectedValueOnce(error);

        await expect(
          repoManager.downloadRepository(repoFullName, accessToken)
        ).rejects.toThrow('Access denied');
      });

      it('should throw error for 401 (unauthorized)', async () => {
        const repoFullName = 'test-owner/test-repo';
        const accessToken = 'expired-token';

        // Mock 401 response
        const error: any = new Error('Request failed with status code 401');
        error.response = {
          status: 401,
          statusText: 'Unauthorized',
          data: { message: 'Bad credentials' },
          headers: {},
          config: {} as any
        };
        
        mockIsAxiosError.mockReturnValue(true);
        mockedAxios.get.mockRejectedValueOnce(error);

        await expect(
          repoManager.downloadRepository(repoFullName, accessToken)
        ).rejects.toThrow('Failed to download repository');
      });

      it('should throw error for 500 (server error)', async () => {
        const repoFullName = 'test-owner/test-repo';
        const accessToken = 'test-token';

        // Mock 500 response
        const error: any = new Error('Request failed with status code 500');
        error.response = {
          status: 500,
          statusText: 'Internal Server Error',
          data: { message: 'Internal Server Error' },
          headers: {},
          config: {} as any
        };
        
        mockIsAxiosError.mockReturnValue(true);
        mockedAxios.get.mockRejectedValueOnce(error);

        await expect(
          repoManager.downloadRepository(repoFullName, accessToken)
        ).rejects.toThrow('Failed to download repository');
      });
    });

    describe('Corrupted Archive Handling', () => {
      it('should throw error when tarball extraction fails', async () => {
        const repoFullName = 'test-owner/test-repo';
        const accessToken = 'test-token';

        // Mock response with invalid tarball data
        const invalidStream = {
          pipe: jest.fn().mockImplementation(() => {
            throw new Error('Invalid gzip data');
          }),
          on: jest.fn()
        };

        mockedAxios.get.mockResolvedValueOnce({
          data: invalidStream,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any
        });

        await expect(
          repoManager.downloadRepository(repoFullName, accessToken)
        ).rejects.toThrow();
      });

      it('should handle empty tarball gracefully', async () => {
        const repoFullName = 'test-owner/empty-repo';
        const accessToken = 'test-token';

        // Create an empty tarball
        const { Readable } = require('stream');
        const emptyStream = Readable.from(Buffer.from([]));

        mockedAxios.get.mockResolvedValueOnce({
          data: emptyStream,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any
        });

        await expect(
          repoManager.downloadRepository(repoFullName, accessToken)
        ).rejects.toThrow();
      });
    });

    describe('Repository Listing Failures', () => {
      it('should throw error when listing repositories fails', async () => {
        const accessToken = 'test-token';

        // Mock network error
        const error: any = new Error('Network error');
        mockIsAxiosError.mockReturnValue(true);
        mockedAxios.get.mockRejectedValueOnce(error);

        await expect(
          repoManager.listRepositories(accessToken)
        ).rejects.toThrow('Failed to list repositories');
      });

      it('should throw error for unauthorized access when listing', async () => {
        const accessToken = 'invalid-token';

        // Mock 401 response
        const error: any = new Error('Request failed with status code 401');
        error.response = {
          status: 401,
          statusText: 'Unauthorized',
          data: { message: 'Bad credentials' },
          headers: {},
          config: {} as any
        };
        mockIsAxiosError.mockReturnValue(true);
        mockedAxios.get.mockRejectedValueOnce(error);

        await expect(
          repoManager.listRepositories(accessToken)
        ).rejects.toThrow('Failed to list repositories');
      });
    });
  });

  describe('Cleanup Safety', () => {
    it('should not delete files outside temp directory', async () => {
      const unsafePath = '/etc/important-file';

      await expect(
        repoManager.cleanupTemporaryFiles(unsafePath)
      ).rejects.toThrow('Invalid path: not in temporary directory');
    });

    it('should handle cleanup of nonexistent paths gracefully within temp dir', async () => {
      // Create a path within temp directory that doesn't exist
      const tempDirPath = path.join(os.tmpdir(), 'devsecops-repos', 'nonexistent-subdir');

      // Should not throw error even if path doesn't exist (within temp dir)
      await expect(
        repoManager.cleanupTemporaryFiles(tempDirPath)
      ).resolves.not.toThrow();
    });
  });
});

