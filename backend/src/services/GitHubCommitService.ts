import axios from 'axios';
import { Types } from 'mongoose';
import Vulnerability from '../models/Vulnerability';
import Repository from '../models/Repository';
import Commit from '../models/Commit';
import { HTTPSEnforcer } from '../middleware/security';

export interface FileChange {
  path: string;
  content: string;
  operation: 'modify' | 'delete' | 'create';
}

export interface CommitResult {
  commitSha: string;
  success: boolean;
  conflicts: Conflict[];
}

export interface Conflict {
  filePath: string;
  reason: string;
}

export class GitHubCommitService {
  private readonly githubApiBaseUrl = 'https://api.github.com';
  private readonly secureAxios = HTTPSEnforcer.createSecureAxiosInstance();

  /**
   * Generates a commit message with fix summary
   * @param fixes - Array of fixed vulnerabilities
   * @returns Formatted commit message
   */
  generateCommitMessage(fixes: Array<{ severity: string; title: string }>): string {
    if (fixes.length === 0) {
      return 'fix: Security vulnerability fixes';
    }

    // Count vulnerabilities by severity
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

    // Build commit message
    const totalFixes = fixes.length;
    const severityBreakdown = Object.entries(severityCounts)
      .filter(([_, count]) => count > 0)
      .map(([severity, count]) => `${count} ${severity}`)
      .join(', ');

    let message = `fix: Security vulnerability fixes (${totalFixes} total)\n\n`;
    message += `Fixed ${totalFixes} security ${totalFixes === 1 ? 'vulnerability' : 'vulnerabilities'}:\n`;
    message += `- Severity breakdown: ${severityBreakdown}\n\n`;
    
    // Add individual fix titles (limit to first 10 to avoid overly long messages)
    const fixList = fixes.slice(0, 10);
    fixList.forEach(fix => {
      message += `- [${fix.severity.toUpperCase()}] ${fix.title}\n`;
    });

    if (fixes.length > 10) {
      message += `\n... and ${fixes.length - 10} more fixes\n`;
    }

    return message;
  }

  /**
   * Detects conflicts by checking if files have been modified since scan
   * @param repoFullName - Repository full name (owner/repo)
   * @param files - Files to be committed
   * @param branch - Target branch
   * @param accessToken - GitHub access token
   * @returns Array of detected conflicts
   */
  async detectConflicts(
    repoFullName: string,
    files: FileChange[],
    branch: string,
    accessToken: string
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    try {
      // Check if branch exists by attempting to get branch info
      await this.secureAxios.get(
        `${this.githubApiBaseUrl}/repos/${repoFullName}/branches/${branch}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      // Check each file for conflicts
      for (const file of files) {
        try {
          // Get the current file content from GitHub
          await this.secureAxios.get(
            `${this.githubApiBaseUrl}/repos/${repoFullName}/contents/${file.path}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
              },
              params: {
                ref: branch
              }
            }
          );

          // If file exists and we're trying to create it, that's a conflict
          if (file.operation === 'create') {
            conflicts.push({
              filePath: file.path,
              reason: 'File already exists on remote branch'
            });
          }
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            // File doesn't exist on remote
            if (file.operation === 'modify' || file.operation === 'delete') {
              conflicts.push({
                filePath: file.path,
                reason: 'File does not exist on remote branch'
              });
            }
          } else {
            // Other errors (permissions, network, etc.)
            conflicts.push({
              filePath: file.path,
              reason: `Unable to check file status: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
        }
      }
    } catch (error) {
      // If we can't get branch info, treat it as a potential conflict
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          conflicts.push({
            filePath: '*',
            reason: `Branch '${branch}' does not exist`
          });
        } else if (error.response?.status === 403) {
          conflicts.push({
            filePath: '*',
            reason: 'Branch is protected or insufficient permissions'
          });
        } else {
          conflicts.push({
            filePath: '*',
            reason: `Unable to access branch: ${error.message}`
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Commits changes to GitHub repository
   * @param repoId - MongoDB repository ID
   * @param files - Files to commit
   * @param message - Commit message
   * @param accessToken - GitHub access token
   * @param branch - Target branch (optional, defaults to repository's default branch)
   * @returns Commit result with SHA and success status
   */
  async commitChanges(
    repoId: string | Types.ObjectId,
    files: FileChange[],
    message: string,
    accessToken: string,
    branch?: string
  ): Promise<CommitResult> {
    try {
      // Get repository information
      const repository = await Repository.findById(repoId);
      if (!repository) {
        throw new Error('Repository not found');
      }

      // Use provided branch or default to repository's default branch
      const targetBranch = branch || repository.defaultBranch;

      // Detect conflicts before attempting commit
      const conflicts = await this.detectConflicts(
        repository.fullName,
        files,
        targetBranch,
        accessToken
      );

      if (conflicts.length > 0) {
        return {
          commitSha: '',
          success: false,
          conflicts
        };
      }

      // Get the latest commit SHA for the branch
      const branchResponse = await this.secureAxios.get(
        `${this.githubApiBaseUrl}/repos/${repository.fullName}/branches/${targetBranch}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      const baseCommitSha = branchResponse.data.commit.sha;

      // Get the base tree
      const baseTreeSha = branchResponse.data.commit.commit.tree.sha;

      // Create blobs for each file
      const tree: Array<{ path: string; mode: string; type: string; sha?: string }> = [];

      for (const file of files) {
        if (file.operation === 'delete') {
          // For deletions, we don't create a blob
          tree.push({
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: undefined as any // GitHub API uses null for deletions
          });
        } else {
          // Create blob for file content
          const blobResponse = await this.secureAxios.post(
            `${this.githubApiBaseUrl}/repos/${repository.fullName}/git/blobs`,
            {
              content: Buffer.from(file.content).toString('base64'),
              encoding: 'base64'
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
              }
            }
          );

          tree.push({
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: blobResponse.data.sha
          });
        }
      }

      // Create new tree
      const treeResponse = await this.secureAxios.post(
        `${this.githubApiBaseUrl}/repos/${repository.fullName}/git/trees`,
        {
          base_tree: baseTreeSha,
          tree
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      // Create commit
      const commitResponse = await this.secureAxios.post(
        `${this.githubApiBaseUrl}/repos/${repository.fullName}/git/commits`,
        {
          message,
          tree: treeResponse.data.sha,
          parents: [baseCommitSha]
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      const commitSha = commitResponse.data.sha;

      // Update branch reference
      await this.secureAxios.patch(
        `${this.githubApiBaseUrl}/repos/${repository.fullName}/git/refs/heads/${targetBranch}`,
        {
          sha: commitSha,
          force: false
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      return {
        commitSha,
        success: true,
        conflicts: []
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorMessage = error.response?.data?.message || error.message;

        // Handle specific error cases
        if (status === 409) {
          return {
            commitSha: '',
            success: false,
            conflicts: [{
              filePath: '*',
              reason: 'Merge conflict detected: ' + errorMessage
            }]
          };
        } else if (status === 403) {
          return {
            commitSha: '',
            success: false,
            conflicts: [{
              filePath: '*',
              reason: 'Permission denied or branch protection rules: ' + errorMessage
            }]
          };
        } else if (status === 404) {
          return {
            commitSha: '',
            success: false,
            conflicts: [{
              filePath: '*',
              reason: 'Repository or branch not found: ' + errorMessage
            }]
          };
        }

        throw new Error(`GitHub API error: ${errorMessage}`);
      }

      throw new Error(`Failed to commit changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Pushes commits to remote (already handled by commitChanges via GitHub API)
   * This method is kept for interface compatibility but is a no-op
   * since GitHub API commits are automatically pushed
   */
  async pushToRemote(
    _repoId: string | Types.ObjectId,
    _branch: string,
    _accessToken: string
  ): Promise<void> {
    // No-op: GitHub API commits are automatically pushed
    // This method exists for interface compatibility with the design document
    return Promise.resolve();
  }

  /**
   * Updates vulnerability statuses to 'verified' after successful commit
   * @param vulnerabilityIds - Array of vulnerability IDs that were fixed
   * @param commitSha - The commit SHA
   * @param repositoryId - Repository ID
   * @param userId - User ID who made the commit
   */
  async updateVulnerabilityStatuses(
    vulnerabilityIds: Array<string | Types.ObjectId>,
    commitSha: string,
    repositoryId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<void> {
    try {
      // Update all vulnerabilities to 'verified' status
      await Vulnerability.updateMany(
        { _id: { $in: vulnerabilityIds } },
        { 
          fixStatus: 'verified',
          updatedAt: new Date()
        }
      );

      // Create commit record
      await Commit.create({
        repositoryId,
        userId,
        commitSha,
        message: '', // Will be set by caller
        branch: '', // Will be set by caller
        fixedVulnerabilities: vulnerabilityIds,
        timestamp: new Date(),
        success: true,
        conflicts: []
      });
    } catch (error) {
      throw new Error(`Failed to update vulnerability statuses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
