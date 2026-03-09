import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DashboardContainer } from './DashboardContainer';
import { vulnerabilityService, GroupedVulnerabilitiesResponse } from '../services/vulnerabilityService';

jest.mock('../services/vulnerabilityService');

describe('DashboardContainer', () => {
  const mockData: GroupedVulnerabilitiesResponse = {
    summary: {
      totalProjects: 2,
      totalVulnerabilities: 5,
      criticalCount: 2,
      highCount: 2,
      mediumCount: 1,
      lowCount: 0,
    },
    projects: [
      {
        repositoryId: 'repo-1',
        repositoryName: 'test-repo-1',
        totalVulnerabilities: 3,
        scanners: [
          {
            scannerName: 'gitleaks',
            totalCount: 2,
            severityBreakdown: {
              critical: 1,
              high: 1,
              medium: 0,
              low: 0,
            },
            vulnerabilities: [
              {
                id: 'vuln-1',
                severity: 'critical',
                title: 'Secret exposed',
                filePath: 'src/config.ts',
                lineNumber: 10,
                status: 'open',
                scannerName: 'gitleaks',
              },
              {
                id: 'vuln-2',
                severity: 'high',
                title: 'API key in code',
                filePath: 'src/api.ts',
                lineNumber: 20,
                status: 'open',
                scannerName: 'gitleaks',
              },
            ],
          },
          {
            scannerName: 'semgrep',
            totalCount: 1,
            severityBreakdown: {
              critical: 0,
              high: 0,
              medium: 1,
              low: 0,
            },
            vulnerabilities: [
              {
                id: 'vuln-3',
                severity: 'medium',
                title: 'SQL injection risk',
                filePath: 'src/database.ts',
                lineNumber: 30,
                status: 'open',
                scannerName: 'semgrep',
              },
            ],
          },
        ],
      },
      {
        repositoryId: 'repo-2',
        repositoryName: 'test-repo-2',
        totalVulnerabilities: 2,
        scanners: [
          {
            scannerName: 'trivy',
            totalCount: 2,
            severityBreakdown: {
              critical: 1,
              high: 1,
              medium: 0,
              low: 0,
            },
            vulnerabilities: [
              {
                id: 'vuln-4',
                severity: 'critical',
                title: 'Vulnerable dependency',
                filePath: 'package.json',
                lineNumber: 5,
                status: 'open',
                scannerName: 'trivy',
              },
              {
                id: 'vuln-5',
                severity: 'high',
                title: 'Outdated library',
                filePath: 'package.json',
                lineNumber: 8,
                status: 'open',
                scannerName: 'trivy',
              },
            ],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Data fetching and rendering', () => {
    it('should display loading state initially', () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<DashboardContainer />);

      expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should fetch and display data successfully', async () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Check summary cards
      expect(screen.getByText('Total Projects')).toBeInTheDocument();
      expect(screen.getByLabelText('2 projects scanned')).toBeInTheDocument();

      // Check project cards
      expect(screen.getByText('test-repo-1')).toBeInTheDocument();
      expect(screen.getByText('test-repo-2')).toBeInTheDocument();
    });

    it('should display error state when fetch fails', async () => {
      const errorMessage = 'Network error';
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Dashboard')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should display empty state when no projects', async () => {
      const emptyData: GroupedVulnerabilitiesResponse = {
        summary: {
          totalProjects: 0,
          totalVulnerabilities: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
        },
        projects: [],
      };

      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(emptyData);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.getByText('No Vulnerabilities Found')).toBeInTheDocument();
        expect(screen.getByText('No projects with vulnerabilities to display.')).toBeInTheDocument();
      });
    });
  });

  describe('Filter interactions', () => {
    it('should filter by severity', async () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Initially, both projects should be visible
      expect(screen.getByText('test-repo-1')).toBeInTheDocument();
      expect(screen.getByText('test-repo-2')).toBeInTheDocument();

      // Click critical filter
      const criticalButton = screen.getByLabelText('Filter by critical severity');
      fireEvent.click(criticalButton);

      // Both projects should still be visible (they both have critical vulnerabilities)
      await waitFor(() => {
        expect(screen.getByText('test-repo-1')).toBeInTheDocument();
        expect(screen.getByText('test-repo-2')).toBeInTheDocument();
      });
    });

    it('should filter by search term', async () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Type in search input
      const searchInput = screen.getByPlaceholderText('Enter file path...');
      fireEvent.change(searchInput, { target: { value: 'config' } });

      // Should show only vulnerabilities with 'config' in file path
      await waitFor(() => {
        // The vulnerability in src/config.ts should be visible
        expect(screen.getByText('src/config.ts')).toBeInTheDocument();
      });
    });

    it('should show no results message when filters match nothing', async () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Search for non-existent file
      const searchInput = screen.getByPlaceholderText('Enter file path...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent.ts' } });

      await waitFor(() => {
        expect(screen.getByText('No vulnerabilities match the current filters.')).toBeInTheDocument();
      });
    });
  });

  describe('Collapse/expand interactions', () => {
    it('should render scanner sections', async () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      const { container } = render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Scanner sections should be rendered
      const scannerSections = container.querySelectorAll('.scanner-section');
      expect(scannerSections.length).toBeGreaterThan(0);
    });
  });
});
