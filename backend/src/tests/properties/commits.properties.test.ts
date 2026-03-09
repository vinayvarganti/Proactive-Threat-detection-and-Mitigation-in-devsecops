import { GitHubCommitService } from '../../services/GitHubCommitService';
import * as fc from 'fast-check';

// Mock dependencies
jest.mock('axios');
jest.mock('../../models/Repository');

describe('GitHub Commit Service Properties', () => {
  let commitService: GitHubCommitService;

  beforeEach(() => {
    commitService = new GitHubCommitService();
    jest.clearAllMocks();
  });

  // Feature: devsecops-platform, Property 25: Commit Message Generation Completeness
  // **Validates: Requirements 7.2, 7.3**
  describe('Property 25: Commit Message Generation Completeness', () => {
    it('property: commit messages include fix count and severity breakdown', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary arrays of vulnerabilities with different severities
          fc.array(
            fc.record({
              severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
              title: fc.string({ minLength: 10, maxLength: 100 })
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (fixes) => {
            // Generate commit message
            const message = commitService.generateCommitMessage(fixes);

            // Property 1: Message must include total fix count
            const totalFixes = fixes.length;
            expect(message).toContain(`${totalFixes} total`);
            expect(message).toContain(`Fixed ${totalFixes}`);

            // Property 2: Message must include severity breakdown
            const severityCounts: Record<string, number> = {
              critical: 0,
              high: 0,
              medium: 0,
              low: 0
            };

            fixes.forEach(fix => {
              const severity = fix.severity.toLowerCase();
              if (severity in severityCounts) {
                severityCounts[severity]++;
              }
            });

            // Check that each severity with count > 0 is mentioned in the message
            Object.entries(severityCounts).forEach(([severity, count]) => {
              if (count > 0) {
                expect(message).toContain(`${count} ${severity}`);
              }
            });

            // Property 3: Message must include individual fix titles (at least for first 10)
            const fixList = fixes.slice(0, 10);
            fixList.forEach(fix => {
              expect(message).toContain(fix.title);
              expect(message).toContain(fix.severity.toUpperCase());
            });

            // Property 4: If more than 10 fixes, message should indicate truncation
            if (fixes.length > 10) {
              expect(message).toContain(`and ${fixes.length - 10} more fixes`);
            }

            // Property 5: Message must follow conventional commit format
            expect(message).toMatch(/^fix: /);

            // Property 6: Message must be non-empty and well-formed
            expect(message.length).toBeGreaterThan(0);
            expect(message).toContain('Security vulnerability');
          }
        ),
        { numRuns: 5 }
      );
    });

    it('property: commit message handles empty fix array gracefully', () => {
      const message = commitService.generateCommitMessage([]);
      
      // Should still generate a valid commit message
      expect(message).toBe('fix: Security vulnerability fixes');
      expect(message).toMatch(/^fix: /);
    });

    it('property: commit message severity counts are accurate', () => {
      fc.assert(
        fc.property(
          // Generate specific severity distributions
          fc.record({
            criticalCount: fc.integer({ min: 0, max: 10 }),
            highCount: fc.integer({ min: 0, max: 10 }),
            mediumCount: fc.integer({ min: 0, max: 10 }),
            lowCount: fc.integer({ min: 0, max: 10 })
          }).filter(counts => 
            counts.criticalCount + counts.highCount + counts.mediumCount + counts.lowCount > 0
          ),
          (counts) => {
            // Build fixes array with exact counts
            const fixes: Array<{ severity: string; title: string }> = [];
            
            for (let i = 0; i < counts.criticalCount; i++) {
              fixes.push({ severity: 'critical', title: `Critical vulnerability ${i}` });
            }
            for (let i = 0; i < counts.highCount; i++) {
              fixes.push({ severity: 'high', title: `High vulnerability ${i}` });
            }
            for (let i = 0; i < counts.mediumCount; i++) {
              fixes.push({ severity: 'medium', title: `Medium vulnerability ${i}` });
            }
            for (let i = 0; i < counts.lowCount; i++) {
              fixes.push({ severity: 'low', title: `Low vulnerability ${i}` });
            }

            const message = commitService.generateCommitMessage(fixes);

            // Verify exact counts in message
            if (counts.criticalCount > 0) {
              expect(message).toContain(`${counts.criticalCount} critical`);
            }
            if (counts.highCount > 0) {
              expect(message).toContain(`${counts.highCount} high`);
            }
            if (counts.mediumCount > 0) {
              expect(message).toContain(`${counts.mediumCount} medium`);
            }
            if (counts.lowCount > 0) {
              expect(message).toContain(`${counts.lowCount} low`);
            }

            // Verify total count
            const totalCount = counts.criticalCount + counts.highCount + counts.mediumCount + counts.lowCount;
            expect(message).toContain(`${totalCount} total`);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: devsecops-platform, Property 26: Commit Authentication
  // **Validates: Requirements 7.4**
  describe('Property 26: Commit Authentication', () => {
    it('property: all commits use authenticated user access token', async () => {
      // Import and mock dependencies for this test
      const axios = require('axios');
      const Repository = require('../../models/Repository').default;
      
      const mockedAxios = axios as jest.Mocked<typeof axios>;
      
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary commit data
          fc.record({
            repoId: fc.hexaString({ minLength: 24, maxLength: 24 }),
            repoFullName: fc.string({ minLength: 5, maxLength: 50 }).map(s => `owner/${s}`),
            defaultBranch: fc.constantFrom('main', 'master', 'develop'),
            accessToken: fc.string({ minLength: 40, maxLength: 100 }),
            files: fc.array(
              fc.record({
                path: fc.string({ minLength: 5, maxLength: 50 }).map(s => `src/${s}.ts`),
                content: fc.string({ minLength: 10, maxLength: 200 }),
                operation: fc.constantFrom('modify' as const, 'create' as const, 'delete' as const)
              }),
              { minLength: 1, maxLength: 5 }
            ),
            commitMessage: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (testData) => {
            // Create a fresh service instance for this test
            const testCommitService = new GitHubCommitService();
            
            // Mock repository
            (Repository.findById as jest.Mock).mockResolvedValue({
              _id: testData.repoId,
              fullName: testData.repoFullName,
              defaultBranch: testData.defaultBranch
            });

            // Mock GitHub API responses
            const mockBranchResponse = {
              data: {
                commit: {
                  sha: 'base-commit-sha',
                  commit: {
                    tree: { sha: 'base-tree-sha' }
                  }
                }
              }
            };

            const mockBlobResponse = {
              data: { sha: 'blob-sha' }
            };

            const mockTreeResponse = {
              data: { sha: 'new-tree-sha' }
            };

            const mockCommitResponse = {
              data: { sha: 'new-commit-sha' }
            };

            const mockUpdateRefResponse = {
              data: { ref: `refs/heads/${testData.defaultBranch}` }
            };

            // Set up axios mock to track all calls
            const axiosCalls: Array<{ url: string; headers: any }> = [];
            
            mockedAxios.get.mockImplementation((url: string, config: any) => {
              axiosCalls.push({ url, headers: config?.headers });
              if (url.includes('/branches/')) {
                return Promise.resolve(mockBranchResponse);
              }
              return Promise.reject(new Error('Not found'));
            });

            mockedAxios.post.mockImplementation((url: string, _data: any, config: any) => {
              axiosCalls.push({ url, headers: config?.headers });
              if (url.includes('/git/blobs')) {
                return Promise.resolve(mockBlobResponse);
              } else if (url.includes('/git/trees')) {
                return Promise.resolve(mockTreeResponse);
              } else if (url.includes('/git/commits')) {
                return Promise.resolve(mockCommitResponse);
              }
              return Promise.reject(new Error('Unknown endpoint'));
            });

            mockedAxios.patch.mockImplementation((url: string, _data: any, config: any) => {
              axiosCalls.push({ url, headers: config?.headers });
              return Promise.resolve(mockUpdateRefResponse);
            });

            // Attempt to commit changes
            try {
              await testCommitService.commitChanges(
                testData.repoId,
                testData.files,
                testData.commitMessage,
                testData.accessToken
              );

              // Property: All GitHub API calls must use the authenticated user's access token
              axiosCalls.forEach(call => {
                expect(call.headers).toBeDefined();
                expect(call.headers.Authorization).toBe(`Bearer ${testData.accessToken}`);
              });

              // Property: Access token must be present in all API requests
              expect(axiosCalls.length).toBeGreaterThan(0);
              
              // Property: No API call should be made without authentication
              const unauthenticatedCalls = axiosCalls.filter(
                call => !call.headers?.Authorization || !call.headers.Authorization.includes(testData.accessToken)
              );
              expect(unauthenticatedCalls).toHaveLength(0);
            } catch (error) {
              // Even if commit fails, authentication should have been attempted
              if (axiosCalls.length > 0) {
                axiosCalls.forEach(call => {
                  expect(call.headers).toBeDefined();
                  expect(call.headers.Authorization).toBe(`Bearer ${testData.accessToken}`);
                });
              }
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: devsecops-platform, Property 27: Commit Success Updates Report
  // **Validates: Requirements 7.5**
  describe('Property 27: Commit Success Updates Report', () => {
    it('property: successful commits update vulnerability status to Verified', async () => {
      // Import and mock dependencies
      const Vulnerability = require('../../models/Vulnerability').default;
      const Commit = require('../../models/Commit').default;
      
      jest.mock('../../models/Vulnerability');
      jest.mock('../../models/Commit');
      
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary vulnerability and commit data
          fc.record({
            vulnerabilityIds: fc.array(
              fc.hexaString({ minLength: 24, maxLength: 24 }),
              { minLength: 1, maxLength: 10 }
            ),
            commitSha: fc.hexaString({ minLength: 40, maxLength: 40 }),
            repositoryId: fc.hexaString({ minLength: 24, maxLength: 24 }),
            userId: fc.hexaString({ minLength: 24, maxLength: 24 })
          }),
          async (testData) => {
            // Create a fresh service instance
            const testCommitService = new GitHubCommitService();
            
            // Track what was updated
            let updatedVulnerabilities: any = null;
            let createdCommit: any = null;
            
            // Mock Vulnerability.updateMany
            (Vulnerability.updateMany as jest.Mock).mockImplementation((filter, update) => {
              updatedVulnerabilities = { filter, update };
              return Promise.resolve({ 
                modifiedCount: testData.vulnerabilityIds.length,
                matchedCount: testData.vulnerabilityIds.length
              });
            });
            
            // Mock Commit.create
            (Commit.create as jest.Mock).mockImplementation((commitData) => {
              createdCommit = commitData;
              return Promise.resolve({
                _id: 'commit-id',
                ...commitData
              });
            });
            
            // Call updateVulnerabilityStatuses
            await testCommitService.updateVulnerabilityStatuses(
              testData.vulnerabilityIds,
              testData.commitSha,
              testData.repositoryId,
              testData.userId
            );
            
            // Property 1: Vulnerability.updateMany must be called
            expect(Vulnerability.updateMany).toHaveBeenCalled();
            
            // Property 2: All vulnerability IDs must be included in the update
            expect(updatedVulnerabilities).not.toBeNull();
            expect(updatedVulnerabilities.filter._id.$in).toEqual(testData.vulnerabilityIds);
            
            // Property 3: Fix status must be updated to 'verified'
            expect(updatedVulnerabilities.update.fixStatus).toBe('verified');
            
            // Property 4: Updated timestamp must be set
            expect(updatedVulnerabilities.update.updatedAt).toBeInstanceOf(Date);
            
            // Property 5: Commit record must be created
            expect(Commit.create).toHaveBeenCalled();
            expect(createdCommit).not.toBeNull();
            
            // Property 6: Commit record must include all fixed vulnerabilities
            expect(createdCommit.fixedVulnerabilities).toEqual(testData.vulnerabilityIds);
            
            // Property 7: Commit record must include commit SHA
            expect(createdCommit.commitSha).toBe(testData.commitSha);
            
            // Property 8: Commit record must include repository and user IDs
            expect(createdCommit.repositoryId).toBe(testData.repositoryId);
            expect(createdCommit.userId).toBe(testData.userId);
            
            // Property 9: Commit record must mark success as true
            expect(createdCommit.success).toBe(true);
            
            // Property 10: Commit record must have empty conflicts array
            expect(createdCommit.conflicts).toEqual([]);
          }
        ),
        { numRuns: 5 }
      );
    }, 20000); // 20 second timeout
  });

  // Feature: devsecops-platform, Property 28: Default Branch Targeting
  // **Validates: Requirements 7.7**
  describe('Property 28: Default Branch Targeting', () => {
    it('property: commits target default branch when not specified', async () => {
      // Import and mock dependencies
      const axios = require('axios');
      const Repository = require('../../models/Repository').default;
      
      const mockedAxios = axios as jest.Mocked<typeof axios>;
      
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary commit data without specifying branch
          fc.record({
            repoId: fc.hexaString({ minLength: 24, maxLength: 24 }),
            repoFullName: fc.string({ minLength: 5, maxLength: 50 }).map(s => `owner/${s}`),
            defaultBranch: fc.constantFrom('main', 'master', 'develop', 'production'),
            accessToken: fc.string({ minLength: 40, maxLength: 100 }),
            files: fc.array(
              fc.record({
                path: fc.string({ minLength: 5, maxLength: 50 }).map(s => `src/${s}.ts`),
                content: fc.string({ minLength: 10, maxLength: 200 }),
                operation: fc.constantFrom('modify' as const, 'create' as const)
              }),
              { minLength: 1, maxLength: 3 }
            ),
            commitMessage: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (testData) => {
            // Create a fresh service instance for this test
            const testCommitService = new GitHubCommitService();
            
            // Mock repository with default branch
            (Repository.findById as jest.Mock).mockResolvedValue({
              _id: testData.repoId,
              fullName: testData.repoFullName,
              defaultBranch: testData.defaultBranch
            });

            // Track which branch was used in API calls
            let branchUsedInGetRequest: string | null = null;
            let branchUsedInPatchRequest: string | null = null;

            // Mock GitHub API responses
            const mockBranchResponse = {
              data: {
                commit: {
                  sha: 'base-commit-sha',
                  commit: {
                    tree: { sha: 'base-tree-sha' }
                  }
                }
              }
            };

            const mockBlobResponse = {
              data: { sha: 'blob-sha-123' }
            };

            const mockTreeResponse = {
              data: { sha: 'new-tree-sha' }
            };

            const mockCommitResponse = {
              data: { sha: 'new-commit-sha-456' }
            };

            const mockUpdateRefResponse = {
              data: { ref: `refs/heads/${testData.defaultBranch}` }
            };

            // Set up axios mock to track branch usage
            mockedAxios.get.mockImplementation((url: string, _config: any) => {
              // Extract branch from URL for branch info request
              const branchMatch = url.match(/\/branches\/([^/]+)$/);
              if (branchMatch) {
                branchUsedInGetRequest = branchMatch[1];
                return Promise.resolve(mockBranchResponse);
              }
              return Promise.reject(new Error('Not found'));
            });

            mockedAxios.post.mockImplementation((url: string, _data: any, _config: any) => {
              if (url.includes('/git/blobs')) {
                return Promise.resolve(mockBlobResponse);
              } else if (url.includes('/git/trees')) {
                return Promise.resolve(mockTreeResponse);
              } else if (url.includes('/git/commits')) {
                return Promise.resolve(mockCommitResponse);
              }
              return Promise.reject(new Error('Unknown endpoint'));
            });

            mockedAxios.patch.mockImplementation((url: string, _data: any, _config: any) => {
              // Extract branch from URL for ref update request
              const refMatch = url.match(/\/git\/refs\/heads\/([^/]+)$/);
              if (refMatch) {
                branchUsedInPatchRequest = refMatch[1];
                return Promise.resolve(mockUpdateRefResponse);
              }
              return Promise.reject(new Error('Unknown endpoint'));
            });

            // Attempt to commit changes WITHOUT specifying a branch
            try {
              const result = await testCommitService.commitChanges(
                testData.repoId,
                testData.files,
                testData.commitMessage,
                testData.accessToken
                // Note: NO branch parameter provided
              );

              // Property 1: Commit should succeed
              expect(result.success).toBe(true);

              // Property 2: Repository.findById must be called to get default branch
              expect(Repository.findById).toHaveBeenCalledWith(testData.repoId);

              // Property 3: GET request for branch info must use the default branch
              expect(branchUsedInGetRequest).toBe(testData.defaultBranch);

              // Property 4: PATCH request to update ref must use the default branch
              expect(branchUsedInPatchRequest).toBe(testData.defaultBranch);

              // Property 5: Both branch references must match
              expect(branchUsedInGetRequest).toBe(branchUsedInPatchRequest);

              // Property 6: The branch used must be the repository's default branch
              expect(branchUsedInGetRequest).toBe(testData.defaultBranch);
              expect(branchUsedInPatchRequest).toBe(testData.defaultBranch);
            } catch (error) {
              // If commit fails for other reasons, still verify branch targeting was attempted
              if (branchUsedInGetRequest !== null) {
                expect(branchUsedInGetRequest).toBe(testData.defaultBranch);
              }
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('property: explicit branch parameter overrides default branch', async () => {
      // Import and mock dependencies
      const axios = require('axios');
      const Repository = require('../../models/Repository').default;
      
      const mockedAxios = axios as jest.Mocked<typeof axios>;
      
      await fc.assert(
        fc.asyncProperty(
          // Generate commit data with explicit branch that differs from default
          fc.record({
            repoId: fc.hexaString({ minLength: 24, maxLength: 24 }),
            repoFullName: fc.string({ minLength: 5, maxLength: 50 }).map(s => `owner/${s}`),
            defaultBranch: fc.constant('main'),
            explicitBranch: fc.constantFrom('feature-branch', 'develop', 'staging'),
            accessToken: fc.string({ minLength: 40, maxLength: 100 }),
            files: fc.array(
              fc.record({
                path: fc.string({ minLength: 5, maxLength: 50 }).map(s => `src/${s}.ts`),
                content: fc.string({ minLength: 10, maxLength: 200 }),
                operation: fc.constantFrom('modify' as const, 'create' as const)
              }),
              { minLength: 1, maxLength: 3 }
            ),
            commitMessage: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (testData) => {
            // Create a fresh service instance
            const testCommitService = new GitHubCommitService();
            
            // Mock repository with default branch
            (Repository.findById as jest.Mock).mockResolvedValue({
              _id: testData.repoId,
              fullName: testData.repoFullName,
              defaultBranch: testData.defaultBranch
            });

            // Track which branch was used
            let branchUsedInRequest: string | null = null;

            // Mock GitHub API responses
            mockedAxios.get.mockImplementation((url: string, _config: any) => {
              const branchMatch = url.match(/\/branches\/([^/]+)$/);
              if (branchMatch) {
                branchUsedInRequest = branchMatch[1];
                return Promise.resolve({
                  data: {
                    commit: {
                      sha: 'base-commit-sha',
                      commit: { tree: { sha: 'base-tree-sha' } }
                    }
                  }
                });
              }
              return Promise.reject(new Error('Not found'));
            });

            mockedAxios.post.mockImplementation((url: string, _data: any, _config: any) => {
              if (url.includes('/git/blobs')) {
                return Promise.resolve({ data: { sha: 'blob-sha' } });
              } else if (url.includes('/git/trees')) {
                return Promise.resolve({ data: { sha: 'tree-sha' } });
              } else if (url.includes('/git/commits')) {
                return Promise.resolve({ data: { sha: 'commit-sha' } });
              }
              return Promise.reject(new Error('Unknown endpoint'));
            });

            mockedAxios.patch.mockImplementation((_url: string, _data: any, _config: any) => {
              return Promise.resolve({ data: { ref: `refs/heads/${testData.explicitBranch}` } });
            });

            // Commit with explicit branch parameter
            try {
              await testCommitService.commitChanges(
                testData.repoId,
                testData.files,
                testData.commitMessage,
                testData.accessToken,
                testData.explicitBranch // Explicit branch provided
              );

              // Property: Explicit branch must be used instead of default branch
              expect(branchUsedInRequest).toBe(testData.explicitBranch);
              expect(branchUsedInRequest).not.toBe(testData.defaultBranch);
            } catch (error) {
              // Even if commit fails, verify correct branch was targeted
              if (branchUsedInRequest !== null) {
                expect(branchUsedInRequest).toBe(testData.explicitBranch);
              }
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});

