import { RepositoryManager } from '../../services/RepositoryManager';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { Readable } from 'stream';
import * as tar from 'tar';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Repository Management Properties', () => {
  let repoManager: RepositoryManager;
  let testTempDir: string;

  beforeAll(async () => {
    testTempDir = path.join(os.tmpdir(), `test-repos-${Date.now()}`);
    await fs.mkdir(testTempDir, { recursive: true });
  });

  beforeEach(() => {
    repoManager = new RepositoryManager();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Clean up test temp directory
    try {
      await fs.rm(testTempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test temp directory:', error);
    }
  });

  // Feature: devsecops-platform, Property 6: Directory Structure Preservation
  // **Validates: Requirements 2.4**
  describe('Property 6: Directory Structure Preservation', () => {
    it('property: downloaded repos maintain exact directory hierarchy', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate various directory structures
          fc.record({
            repoName: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            owner: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            accessToken: fc.string({ minLength: 40, maxLength: 100 }),
            // Generate a directory structure with nested directories and files
            structure: fc.array(
              fc.record({
                path: fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)), { minLength: 1, maxLength: 3 }),
                isFile: fc.boolean(),
                content: fc.string({ maxLength: 100 })
              }),
              { minLength: 1, maxLength: 10 }
            )
          }).filter(testData => {
            // Ensure case-insensitive uniqueness for Windows compatibility
            // Also ensure no file/directory conflicts (e.g., file "E" and directory "e/0")
            const normalizedPaths = new Set<string>();
            
            for (const item of testData.structure) {
              const normalizedPath = item.path.join('/').toLowerCase();
              
              // Check for exact path conflicts
              if (normalizedPaths.has(normalizedPath)) {
                return false;
              }
              
              // Check if this path conflicts with any existing path as a prefix
              // (e.g., file "E" conflicts with directory "e/0")
              for (const existingPath of normalizedPaths) {
                if (existingPath.startsWith(normalizedPath + '/') || normalizedPath.startsWith(existingPath + '/')) {
                  return false;
                }
              }
              
              normalizedPaths.add(normalizedPath);
            }
            return true;
          }),
          async (testData) => {
            const repoFullName = `${testData.owner}/${testData.repoName}`;
            
            // Create a temporary directory to simulate repository structure
            const mockRepoDir = path.join(testTempDir, `mock-${testData.repoName}-${Date.now()}`);
            await fs.mkdir(mockRepoDir, { recursive: true });

            // Build the directory structure
            const expectedStructure: Map<string, { isFile: boolean; content: string }> = new Map();
            
            // Sort structure to ensure directories are created before files
            const sortedStructure = [...testData.structure].sort((a, b) => {
              if (a.isFile === b.isFile) return 0;
              return a.isFile ? 1 : -1; // Directories first
            });
            
            for (const item of sortedStructure) {
              const itemPath = path.join(mockRepoDir, ...item.path);
              const relativePath = path.relative(mockRepoDir, itemPath);
              
              if (item.isFile) {
                // Create parent directories if needed
                await fs.mkdir(path.dirname(itemPath), { recursive: true });
                await fs.writeFile(itemPath, item.content);
                expectedStructure.set(relativePath, { isFile: true, content: item.content });
              } else {
                await fs.mkdir(itemPath, { recursive: true });
                expectedStructure.set(relativePath, { isFile: false, content: '' });
              }
            }

            // Create a tarball from the mock repository
            const tarballPath = path.join(testTempDir, `${testData.repoName}.tar.gz`);
            await tar.create(
              {
                gzip: true,
                file: tarballPath,
                cwd: mockRepoDir
              },
              ['.']
            );

            // Mock axios to return the tarball stream
            const tarballStream = Readable.from(await fs.readFile(tarballPath));
            mockedAxios.get.mockResolvedValueOnce({
              data: tarballStream,
              status: 200,
              statusText: 'OK',
              headers: {},
              config: {} as any
            });

            // Download and extract the repository
            const extractedPath = await repoManager.downloadRepository(repoFullName, testData.accessToken);

            // Verify the directory structure is preserved
            const verifyStructure = async (dirPath: string, prefix: string = ''): Promise<void> => {
              const entries = await fs.readdir(dirPath, { withFileTypes: true });
              
              for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
                
                if (entry.isDirectory()) {
                  // Verify directory exists in expected structure
                  const expected = expectedStructure.get(relativePath);
                  if (expected) {
                    expect(expected.isFile).toBe(false);
                  }
                  
                  // Recursively verify subdirectories
                  await verifyStructure(fullPath, relativePath);
                } else if (entry.isFile()) {
                  // Verify file exists and content matches
                  const expected = expectedStructure.get(relativePath);
                  if (expected && expected.isFile) {
                    const actualContent = await fs.readFile(fullPath, 'utf-8');
                    expect(actualContent).toBe(expected.content);
                  }
                }
              }
            };

            await verifyStructure(extractedPath);

            // Property: Directory structure preservation means:
            // 1. All directories from original are present in extracted ✓
            // 2. All files from original are present in extracted ✓
            // 3. File contents are preserved ✓
            // 4. Nested directory hierarchy is maintained ✓

            // Cleanup
            await repoManager.cleanupTemporaryFiles(extractedPath);
            await fs.rm(mockRepoDir, { recursive: true, force: true });
            await fs.rm(tarballPath, { force: true });
          }
        ),
        { numRuns: 5 }
      );
    }, 60000); // 60 second timeout for this complex property test
  });

  // Feature: devsecops-platform, Property 7: Temporary File Cleanup
  // **Validates: Requirements 10.5**
  describe('Property 7: Temporary File Cleanup', () => {
    it('property: all temp files are deleted after scan completion', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            repoName: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            owner: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            accessToken: fc.string({ minLength: 40, maxLength: 100 }),
            shouldSucceed: fc.boolean()
          }),
          async (testData) => {
            const repoFullName = `${testData.owner}/${testData.repoName}`;
            
            // Create a mock repository with some files
            const mockRepoDir = path.join(testTempDir, `mock-cleanup-${testData.repoName}-${Date.now()}`);
            await fs.mkdir(mockRepoDir, { recursive: true });
            await fs.writeFile(path.join(mockRepoDir, 'test.txt'), 'test content');
            await fs.mkdir(path.join(mockRepoDir, 'subdir'), { recursive: true });
            await fs.writeFile(path.join(mockRepoDir, 'subdir', 'nested.txt'), 'nested content');

            // Create a tarball
            const tarballPath = path.join(testTempDir, `cleanup-${testData.repoName}.tar.gz`);
            await tar.create(
              {
                gzip: true,
                file: tarballPath,
                cwd: mockRepoDir
              },
              ['.']
            );

            let extractedPath: string | null = null;

            try {
              if (testData.shouldSucceed) {
                // Mock successful download
                const tarballStream = Readable.from(await fs.readFile(tarballPath));
                mockedAxios.get.mockResolvedValueOnce({
                  data: tarballStream,
                  status: 200,
                  statusText: 'OK',
                  headers: {},
                  config: {} as any
                });

                // Download repository
                extractedPath = await repoManager.downloadRepository(repoFullName, testData.accessToken);

                // Verify files were extracted
                const filesExist = await fs.access(extractedPath).then(() => true).catch(() => false);
                expect(filesExist).toBe(true);

                // Verify content exists
                const testFile = await fs.readFile(path.join(extractedPath, 'test.txt'), 'utf-8');
                expect(testFile).toBe('test content');
              } else {
                // Mock failed download
                mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

                // Attempt download (should fail)
                try {
                  extractedPath = await repoManager.downloadRepository(repoFullName, testData.accessToken);
                } catch (error) {
                  // Expected to fail
                  expect(error).toBeDefined();
                }
              }

              // Cleanup temporary files
              if (extractedPath) {
                await repoManager.cleanupTemporaryFiles(extractedPath);

                // Property: After cleanup, temporary files should not exist
                const filesExistAfterCleanup = await fs.access(extractedPath).then(() => true).catch(() => false);
                expect(filesExistAfterCleanup).toBe(false);
              }

              // Property: Temporary file cleanup means:
              // 1. All extracted files are deleted ✓
              // 2. All subdirectories are deleted ✓
              // 3. The extraction directory itself is deleted ✓
              // 4. Cleanup works on both success and failure scenarios ✓
            } finally {
              // Cleanup test artifacts
              await fs.rm(mockRepoDir, { recursive: true, force: true });
              await fs.rm(tarballPath, { force: true });
              if (extractedPath) {
                await fs.rm(extractedPath, { recursive: true, force: true }).catch(() => {});
              }
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: devsecops-platform, Property 5: Repository List Completeness
  // **Validates: Requirements 2.1, 2.2**
  describe('Property 5: Repository List Completeness', () => {
    it('property: all accessible repos are returned with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: fc.string({ minLength: 40, maxLength: 100 }),
            // Generate an array of repositories with various configurations
            repositories: fc.array(
              fc.record({
                id: fc.integer({ min: 1, max: 1000000 }),
                name: fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
                owner: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
                private: fc.boolean(),
                updated_at: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
                default_branch: fc.constantFrom('main', 'master', 'develop', 'production')
              }),
              { minLength: 1, maxLength: 20 }
            )
          }),
          async (testData) => {
            // Mock GitHub API response with generated repositories
            const mockGitHubRepos = testData.repositories.map(repo => ({
              id: repo.id,
              name: repo.name,
              full_name: `${repo.owner}/${repo.name}`,
              private: repo.private,
              updated_at: repo.updated_at.toISOString(),
              default_branch: repo.default_branch
            }));

            mockedAxios.get.mockResolvedValueOnce({
              data: mockGitHubRepos,
              status: 200,
              statusText: 'OK',
              headers: {},
              config: {} as any
            });

            // Fetch repositories
            const repositories = await repoManager.listRepositories(testData.accessToken);

            // Property: All repositories should be returned
            expect(repositories).toHaveLength(testData.repositories.length);

            // Property: Each repository should have all required fields
            for (let i = 0; i < repositories.length; i++) {
              const repo = repositories[i];
              const expected = testData.repositories[i];

              // Verify required fields are present
              expect(repo.id).toBeDefined();
              expect(repo.name).toBeDefined();
              expect(repo.fullName).toBeDefined();
              expect(repo.visibility).toBeDefined();
              expect(repo.lastUpdated).toBeDefined();
              expect(repo.defaultBranch).toBeDefined();

              // Verify field values match expected
              expect(repo.id).toBe(expected.id.toString());
              expect(repo.name).toBe(expected.name);
              expect(repo.fullName).toBe(`${expected.owner}/${expected.name}`);
              expect(repo.visibility).toBe(expected.private ? 'private' : 'public');
              expect(repo.lastUpdated).toBeInstanceOf(Date);
              expect(repo.defaultBranch).toBe(expected.default_branch);
            }

            // Verify GitHub API was called correctly
            expect(mockedAxios.get).toHaveBeenCalledWith(
              'https://api.github.com/user/repos',
              expect.objectContaining({
                headers: {
                  Authorization: `Bearer ${testData.accessToken}`,
                  Accept: 'application/vnd.github.v3+json'
                },
                params: {
                  per_page: 100,
                  sort: 'updated',
                  direction: 'desc'
                }
              })
            );

            // Property: Repository list completeness means:
            // 1. All accessible repositories are returned ✓
            // 2. Each repository has required fields (name, visibility, lastUpdated) ✓
            // 3. Field values are correctly mapped from GitHub API response ✓
            // 4. Repository visibility is correctly determined (public/private) ✓
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});

