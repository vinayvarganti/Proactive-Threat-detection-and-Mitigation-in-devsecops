import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import RepositoryList from './RepositoryList';
import { repositoryService, Repository } from '../services/repositoryService';

// Mock the repositoryService
jest.mock('../services/repositoryService', () => ({
  repositoryService: {
    fetchRepositories: jest.fn(),
    scanRepository: jest.fn(),
    scanMultipleRepositories: jest.fn()
  }
}));

describe('RepositoryList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unit Tests', () => {
    it('should display loading state initially', () => {
      (repositoryService.fetchRepositories as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<RepositoryList />);

      expect(screen.getByRole('status')).toHaveTextContent('Loading repositories...');
    });

    it('should display repositories after loading', async () => {
      const mockRepos: Repository[] = [
        {
          id: '1',
          name: 'test-repo',
          fullName: 'user/test-repo',
          visibility: 'public',
          lastUpdated: new Date('2024-01-01'),
          defaultBranch: 'main'
        }
      ];

      (repositoryService.fetchRepositories as jest.Mock).mockResolvedValue(mockRepos);

      render(<RepositoryList />);

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      expect(screen.getByText('test-repo')).toBeInTheDocument();
      expect(screen.getByText('user/test-repo')).toBeInTheDocument();
      expect(screen.getByText('public')).toBeInTheDocument();
    });

    it('should display error message when fetch fails', async () => {
      const errorMessage = 'Failed to fetch repositories';
      (repositoryService.fetchRepositories as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      render(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
      });
    });

    it('should display no repositories message when list is empty', async () => {
      (repositoryService.fetchRepositories as jest.Mock).mockResolvedValue([]);

      render(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('No repositories found.')).toBeInTheDocument();
      });
    });

    it('should allow selecting a repository', async () => {
      const mockRepos: Repository[] = [
        {
          id: '1',
          name: 'test-repo',
          fullName: 'user/test-repo',
          visibility: 'public',
          lastUpdated: new Date('2024-01-01'),
          defaultBranch: 'main'
        }
      ];

      (repositoryService.fetchRepositories as jest.Mock).mockResolvedValue(mockRepos);

      render(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText('Select test-repo');
      fireEvent.click(checkbox);

      expect(checkbox).toBeChecked();
      expect(screen.getByText(/Scan Selected \(1\)/)).toBeInTheDocument();
    });

    it('should allow selecting multiple repositories', async () => {
      const mockRepos: Repository[] = [
        {
          id: '1',
          name: 'repo-1',
          fullName: 'user/repo-1',
          visibility: 'public',
          lastUpdated: new Date('2024-01-01'),
          defaultBranch: 'main'
        },
        {
          id: '2',
          name: 'repo-2',
          fullName: 'user/repo-2',
          visibility: 'private',
          lastUpdated: new Date('2024-01-02'),
          defaultBranch: 'main'
        }
      ];

      (repositoryService.fetchRepositories as jest.Mock).mockResolvedValue(mockRepos);

      render(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('repo-1')).toBeInTheDocument();
      });

      const checkbox1 = screen.getByLabelText('Select repo-1');
      const checkbox2 = screen.getByLabelText('Select repo-2');

      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);

      expect(checkbox1).toBeChecked();
      expect(checkbox2).toBeChecked();
      expect(screen.getByText(/Scan Selected \(2\)/)).toBeInTheDocument();
    });

    it('should select all repositories when select all is clicked', async () => {
      const mockRepos: Repository[] = [
        {
          id: '1',
          name: 'repo-1',
          fullName: 'user/repo-1',
          visibility: 'public',
          lastUpdated: new Date('2024-01-01'),
          defaultBranch: 'main'
        },
        {
          id: '2',
          name: 'repo-2',
          fullName: 'user/repo-2',
          visibility: 'private',
          lastUpdated: new Date('2024-01-02'),
          defaultBranch: 'main'
        }
      ];

      (repositoryService.fetchRepositories as jest.Mock).mockResolvedValue(mockRepos);

      render(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('repo-1')).toBeInTheDocument();
      });

      const selectAllButton = screen.getByLabelText('Select all');
      fireEvent.click(selectAllButton);

      expect(screen.getByLabelText('Select repo-1')).toBeChecked();
      expect(screen.getByLabelText('Select repo-2')).toBeChecked();
      expect(screen.getByText(/Scan Selected \(2\)/)).toBeInTheDocument();
    });

    it('should deselect all repositories when deselect all is clicked', async () => {
      const mockRepos: Repository[] = [
        {
          id: '1',
          name: 'repo-1',
          fullName: 'user/repo-1',
          visibility: 'public',
          lastUpdated: new Date('2024-01-01'),
          defaultBranch: 'main'
        }
      ];

      (repositoryService.fetchRepositories as jest.Mock).mockResolvedValue(mockRepos);

      render(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('repo-1')).toBeInTheDocument();
      });

      // Select all first
      const selectAllButton = screen.getByLabelText('Select all');
      fireEvent.click(selectAllButton);

      expect(screen.getByLabelText('Select repo-1')).toBeChecked();

      // Deselect all
      const deselectAllButton = screen.getByLabelText('Deselect all');
      fireEvent.click(deselectAllButton);

      expect(screen.getByLabelText('Select repo-1')).not.toBeChecked();
      expect(screen.getByText(/Scan Selected \(0\)/)).toBeInTheDocument();
    });

    it('should initiate scan when scan button is clicked', async () => {
      const mockRepos: Repository[] = [
        {
          id: '1',
          name: 'test-repo',
          fullName: 'user/test-repo',
          visibility: 'public',
          lastUpdated: new Date('2024-01-01'),
          defaultBranch: 'main'
        }
      ];

      (repositoryService.fetchRepositories as jest.Mock).mockResolvedValue(mockRepos);
      (repositoryService.scanMultipleRepositories as jest.Mock).mockResolvedValue([
        { success: true, message: 'Scan initiated', reportId: 'report-1' }
      ]);

      render(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
      });

      // Select repository
      const checkbox = screen.getByLabelText('Select test-repo');
      fireEvent.click(checkbox);

      // Click scan button
      const scanButton = screen.getByLabelText('Initiate scan');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(repositoryService.scanMultipleRepositories).toHaveBeenCalledWith(['1']);
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/Scan complete/);
      });
    });

    it('should show error when scan button is clicked without selection', async () => {
      const mockRepos: Repository[] = [
        {
          id: '1',
          name: 'test-repo',
          fullName: 'user/test-repo',
          visibility: 'public',
          lastUpdated: new Date('2024-01-01'),
          defaultBranch: 'main'
        }
      ];

      (repositoryService.fetchRepositories as jest.Mock).mockResolvedValue(mockRepos);

      render(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
      });

      // Click scan button without selecting any repository
      const scanButton = screen.getByLabelText('Initiate scan');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Please select at least one repository to scan'
        );
      });
    });

    it('should disable scan button while scanning', async () => {
      const mockRepos: Repository[] = [
        {
          id: '1',
          name: 'test-repo',
          fullName: 'user/test-repo',
          visibility: 'public',
          lastUpdated: new Date('2024-01-01'),
          defaultBranch: 'main'
        }
      ];

      (repositoryService.fetchRepositories as jest.Mock).mockResolvedValue(mockRepos);

      let resolveScan: (value: any) => void;
      const scanPromise = new Promise(resolve => {
        resolveScan = resolve;
      });

      (repositoryService.scanMultipleRepositories as jest.Mock).mockReturnValue(scanPromise);

      render(<RepositoryList />);

      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
      });

      // Select repository
      const checkbox = screen.getByLabelText('Select test-repo');
      fireEvent.click(checkbox);

      // Click scan button
      const scanButton = screen.getByLabelText('Initiate scan');
      fireEvent.click(scanButton);

      // Check that button shows "Scanning..." and is disabled
      await waitFor(() => {
        const button = screen.getByText('Scanning...');
        expect(button).toBeDisabled();
      });

      // Resolve the scan promise
      resolveScan!([{ success: true, message: 'Scan initiated', reportId: 'report-1' }]);

      // Wait for scan to complete
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/Scan complete/);
      });
    });

    it('should call onScanComplete callback when scan succeeds', async () => {
      const onScanComplete = jest.fn();
      const mockRepos: Repository[] = [
        {
          id: '1',
          name: 'test-repo',
          fullName: 'user/test-repo',
          visibility: 'public',
          lastUpdated: new Date('2024-01-01'),
          defaultBranch: 'main'
        }
      ];

      (repositoryService.fetchRepositories as jest.Mock).mockResolvedValue(mockRepos);
      (repositoryService.scanMultipleRepositories as jest.Mock).mockResolvedValue([
        { success: true, message: 'Scan initiated', reportId: 'report-1' }
      ]);

      render(<RepositoryList onScanComplete={onScanComplete} />);

      await waitFor(() => {
        expect(screen.getByText('test-repo')).toBeInTheDocument();
      });

      // Select repository
      const checkbox = screen.getByLabelText('Select test-repo');
      fireEvent.click(checkbox);

      // Click scan button
      const scanButton = screen.getByLabelText('Initiate scan');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(onScanComplete).toHaveBeenCalledWith(['report-1']);
      });
    });
  });

  describe('Property-Based Tests', () => {
    // Feature: devsecops-platform, Property 5: Repository List Completeness
    // **Validates: Requirements 2.1, 2.2**
    it('should display all repositories with required fields (name, visibility, lastUpdated)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              fullName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              visibility: fc.constantFrom('public' as const, 'private' as const),
              lastUpdated: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
              defaultBranch: fc.constantFrom('main', 'master', 'develop')
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (repositories: Repository[]) => {
            // Mock the service to return generated repositories
            (repositoryService.fetchRepositories as jest.Mock).mockResolvedValue(repositories);

            const { container } = render(<RepositoryList />);

            // Wait for loading to complete
            await waitFor(() => {
              expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
            }, { timeout: 3000 });

            // Verify all repositories are displayed
            for (const repo of repositories) {
              // Check that repository name is displayed
              expect(screen.getByText(repo.name)).toBeInTheDocument();

              // Check that full name is displayed
              expect(screen.getByText(repo.fullName)).toBeInTheDocument();

              // Check that visibility is displayed
              const visibilityElements = screen.getAllByText(repo.visibility);
              expect(visibilityElements.length).toBeGreaterThan(0);

              // Check that lastUpdated is displayed (formatted)
              // We just verify the date is rendered somewhere in the document
              const formattedDate = new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }).format(repo.lastUpdated);

              // The date should be in the document
              expect(container.textContent).toContain(formattedDate.split(',')[0]); // At least the date part
            }

            // Verify the correct number of repository rows
            const rows = screen.getAllByRole('row');
            // +1 for header row
            expect(rows.length).toBe(repositories.length + 1);

            // Verify each repository has a checkbox
            for (const repo of repositories) {
              const checkbox = screen.getByLabelText(`Select ${repo.name}`);
              expect(checkbox).toBeInTheDocument();
              expect(checkbox).toHaveAttribute('type', 'checkbox');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
