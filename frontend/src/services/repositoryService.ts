import axios from 'axios';

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  visibility: 'public' | 'private';
  lastUpdated: Date;
  defaultBranch: string;
}

export interface ScanResponse {
  success: boolean;
  message: string;
  reportId?: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    suggestedAction?: string;
  };
  timestamp: Date;
  requestId: string;
}

class RepositoryService {
  private baseURL = '/api/repositories';

  /**
   * Fetches the list of repositories for the authenticated user
   */
  async fetchRepositories(): Promise<Repository[]> {
    try {
      const response = await axios.get<{ repositories: Repository[] }>(this.baseURL);
      
      // Convert lastUpdated strings to Date objects
      return response.data.repositories.map(repo => ({
        ...repo,
        lastUpdated: new Date(repo.lastUpdated)
      }));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(errorData.error.message || 'Failed to fetch repositories');
      }
      throw new Error('Failed to fetch repositories');
    }
  }

  /**
   * Initiates a scan for a single repository
   */
  async scanRepository(repositoryId: string, fullName: string): Promise<ScanResponse> {
    try {
      const response = await axios.post<ScanResponse>(
        `${this.baseURL}/${repositoryId}/scan`,
        { fullName }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(errorData.error.message || 'Failed to initiate scan');
      }
      throw new Error('Failed to initiate scan');
    }
  }

  /**
   * Initiates scans for multiple repositories sequentially
   */
  async scanMultipleRepositories(repositories: Repository[]): Promise<ScanResponse[]> {
    const results: ScanResponse[] = [];
    
    for (const repo of repositories) {
      try {
        const result = await this.scanRepository(repo.id, repo.fullName);
        results.push(result);
      } catch (error) {
        // Continue with remaining repositories even if one fails
        results.push({
          success: false,
          message: error instanceof Error ? error.message : 'Scan failed'
        });
      }
    }
    
    return results;
  }
}

export const repositoryService = new RepositoryService();
