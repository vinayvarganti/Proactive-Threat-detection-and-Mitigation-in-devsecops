import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import * as tar from 'tar';
import { HTTPSEnforcer } from '../middleware/security';

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  visibility: 'public' | 'private';
  lastUpdated: Date;
  defaultBranch: string;
}

export interface FileNode {
  path: string;
  type: 'file' | 'directory';
  size: number;
  children?: FileNode[];
}

export class RepositoryManager {
  private readonly GITHUB_API_BASE = 'https://api.github.com';
  private readonly tempDir: string;
  private readonly secureAxios = HTTPSEnforcer.createSecureAxiosInstance();

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'devsecops-repos');
  }

  /**
   * List all repositories accessible to the authenticated user
   */
  async listRepositories(accessToken: string): Promise<Repository[]> {
    try {
      const response = await this.secureAxios.get(`${this.GITHUB_API_BASE}/user/repos`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        },
        params: {
          per_page: 100,
          sort: 'updated',
          direction: 'desc'
        }
      });

      return response.data.map((repo: any) => ({
        id: repo.id.toString(),
        name: repo.name,
        fullName: repo.full_name,
        visibility: repo.private ? 'private' : 'public',
        lastUpdated: new Date(repo.updated_at),
        defaultBranch: repo.default_branch || 'main'
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to list repositories: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Download a repository and extract it to a temporary directory
   * Returns the local path to the extracted repository
   */
  async downloadRepository(repoFullName: string, accessToken: string): Promise<string> {
    try {
      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });

      // Create unique directory for this repository
      const repoDir = path.join(this.tempDir, `${repoFullName.replace('/', '-')}-${Date.now()}`);
      await fs.mkdir(repoDir, { recursive: true });

      // Download repository archive (tarball)
      const archiveUrl = `${this.GITHUB_API_BASE}/repos/${repoFullName}/tarball`;
      const response = await this.secureAxios.get(archiveUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        },
        responseType: 'stream'
      });

      // Extract tarball while preserving directory structure
      await pipeline(
        response.data,
        createGunzip(),
        tar.extract({
          cwd: repoDir,
          strip: 1 // Remove the top-level directory created by GitHub
        })
      );

      return repoDir;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Repository not found: ${repoFullName}`);
        }
        if (error.response?.status === 403) {
          throw new Error(`Access denied to repository: ${repoFullName}`);
        }
        throw new Error(`Failed to download repository: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get the file tree structure of a local repository directory
   */
  async getFileTree(localPath: string): Promise<FileNode[]> {
    try {
      const entries = await fs.readdir(localPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        const fullPath = path.join(localPath, entry.name);
        const stats = await fs.stat(fullPath);

        if (entry.isDirectory()) {
          const children = await this.getFileTree(fullPath);
          nodes.push({
            path: entry.name,
            type: 'directory',
            size: 0,
            children
          });
        } else {
          nodes.push({
            path: entry.name,
            type: 'file',
            size: stats.size
          });
        }
      }

      return nodes;
    } catch (error) {
      throw new Error(`Failed to get file tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up temporary files for a repository
   */
  async cleanupTemporaryFiles(localPath: string): Promise<void> {
    try {
      // Verify the path is within our temp directory for safety
      const normalizedPath = path.normalize(localPath);
      const normalizedTempDir = path.normalize(this.tempDir);
      
      if (!normalizedPath.startsWith(normalizedTempDir)) {
        throw new Error('Invalid path: not in temporary directory');
      }

      await fs.rm(localPath, { recursive: true, force: true });
    } catch (error) {
      // If it's a validation error, throw it
      if (error instanceof Error && error.message === 'Invalid path: not in temporary directory') {
        throw error;
      }
      // Log but don't throw - cleanup failures shouldn't break the flow
      console.error(`Failed to cleanup temporary files at ${localPath}:`, error);
    }
  }

  /**
   * Clean up all temporary files in the temp directory
   */
  async cleanupAllTemporaryFiles(): Promise<void> {
    try {
      const exists = await fs.access(this.tempDir).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(this.tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Failed to cleanup all temporary files:', error);
    }
  }
}
