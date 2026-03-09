import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DashboardContainer } from '../../components/DashboardContainer';
import { vulnerabilityService, GroupedVulnerabilitiesResponse } from '../../services/vulnerabilityService';

jest.mock('../../services/vulnerabilityService');

describe('Dashboard End-to-End Integration Tests', () => {
  const mockData: GroupedVulnerabilitiesResponse = {
    summary: {
      totalProjects: 3,
      totalVulnerabilities: 10,
      criticalCount: 3,
      highCount: 4,
      mediumCount: 2,
      lowCount: 1,
    },
    projects: [
      {
        repositoryId: 'repo-1',
        repositoryName: 'frontend-app',
        totalVulnerabilities: 5,
        scanners: [
          {
            scannerName: 'gitleaks',
            totalCount: 3,
            severityBreakdown: {
              critical: 2,
              high: 1,
              medium: 0,
              low: 0,
            },
            vulnerabilities: [
              {
                id: 'vuln-1',
                severity: 'critical',
                title: 'AWS Secret Key Exposed',
                filePath: 'src/config/aws.ts',
                lineNumber: 15,
                status: 'open',
                scannerName: 'gitleaks',
              },
              {
                id: 'vuln-2',
                severity: 'critical',
                title: 'Database Password in Code',
                filePath: 'src/config/database.ts',
                lineNumber: 22,
                status: 'open',
                scannerName: 'gitleaks',
              },
              {
                id: 'vuln-3',
                severity: 'high',
                title: 'API Key Hardcoded',
                filePath: 'src/services/api.ts',
                lineNumber: 8,
                status: 'open',
                scannerName: 'gitleaks',
              },
            ],
          },
          {
            scannerName: 'semgrep',
            totalCount: 2,
            severityBreakdown: {
              critical: 0,
              high: 1,
              medium: 1,
              low: 0,
            },
            vulnerabilities: [
              {
                id: 'vuln-4',
                severity: 'high',
                title: 'SQL Injection Vulnerability',
                filePath: 'src/database/queries.ts',
                lineNumber: 45,
                status: 'open',
                scannerName: 'semgrep',
              },
              {
                id: 'vuln-5',
                severity: 'medium',
                title: 'XSS Risk in Template',
                filePath: 'src/components/UserProfile.tsx',
                lineNumber: 67,
                status: 'open',
                scannerName: 'semgrep',
              },
            ],
          },
        ],
      },
      {
        repositoryId: 'repo-2',
        repositoryName: 'backend-api',
        totalVulnerabilities: 3,
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
                id: 'vuln-6',
                severity: 'critical',
                title: 'Critical Vulnerability in lodash',
                filePath: 'package.json',
                lineNumber: 12,
                status: 'open',
                scannerName: 'trivy',
              },
              {
                id: 'vuln-7',
                severity: 'high',
                title: 'High Severity in express',
                filePath: 'package.json',
                lineNumber: 15,
                status: 'open',
                scannerName: 'trivy',
              },
            ],
          },
          {
            scannerName: 'semgrep',
            totalCount: 1,
            severityBreakdown: {
              critical: 0,
              high: 1,
              medium: 0,
              low: 0,
            },
            vulnerabilities: [
              {
                id: 'vuln-8',
                severity: 'high',
                title: 'Command Injection Risk',
                filePath: 'src/utils/exec.ts',
                lineNumber: 33,
                status: 'open',
                scannerName: 'semgrep',
              },
            ],
          },
        ],
      },
      {
        repositoryId: 'repo-3',
        repositoryName: 'mobile-app',
        totalVulnerabilities: 2,
        scanners: [
          {
            scannerName: 'gitleaks',
            totalCount: 1,
            severityBreakdown: {
              critical: 0,
              high: 0,
              medium: 1,
              low: 0,
            },
            vulnerabilities: [
              {
                id: 'vuln-9',
                severity: 'medium',
                title: 'Private Key in Repository',
                filePath: 'config/keys.json',
                lineNumber: 5,
                status: 'open',
                scannerName: 'gitleaks',
              },
            ],
          },
          {
            scannerName: 'trivy',
            totalCount: 1,
            severityBreakdown: {
              critical: 0,
              high: 0,
              medium: 0,
              low: 1,
            },
            vulnerabilities: [
              {
                id: 'vuln-10',
                severity: 'low',
                title: 'Outdated React Native Version',
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
    // Mock window.URL.createObjectURL for export tests
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete User Flow: Load Dashboard, Apply Filters, Export Data', () => {
    it('should complete full user workflow successfully', async () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      const { container } = render(<DashboardContainer />);

      // Step 1: Verify loading state
      expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument();

      // Step 2: Wait for data to load and verify dashboard renders
      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Step 3: Verify summary cards display correct data
      expect(screen.getByText('Total Projects')).toBeInTheDocument();
      expect(screen.getByLabelText('3 projects scanned')).toBeInTheDocument();
      expect(screen.getByLabelText('10 total vulnerabilities')).toBeInTheDocument();
      expect(screen.getByLabelText('3 critical vulnerabilities')).toBeInTheDocument();
      expect(screen.getByLabelText('4 high severity vulnerabilities')).toBeInTheDocument();

      // Step 4: Verify all projects are displayed
      expect(screen.getByText('frontend-app')).toBeInTheDocument();
      expect(screen.getByText('backend-api')).toBeInTheDocument();
      expect(screen.getByText('mobile-app')).toBeInTheDocument();

      // Step 5: Apply severity filter (Critical only)
      const criticalButton = screen.getByLabelText('Filter by critical severity');
      fireEvent.click(criticalButton);

      await waitFor(() => {
        // Should show only projects with critical vulnerabilities
        expect(screen.getByText('frontend-app')).toBeInTheDocument();
        expect(screen.getByText('backend-api')).toBeInTheDocument();
        // mobile-app should not be visible (no critical vulnerabilities)
        expect(screen.queryByText('mobile-app')).not.toBeInTheDocument();
      });

      // Step 6: Apply search filter
      const searchInput = screen.getByPlaceholderText('Enter file path...');
      fireEvent.change(searchInput, { target: { value: 'config' } });

      await waitFor(() => {
        // Should show only vulnerabilities with 'config' in file path
        expect(screen.getByText('src/config/aws.ts')).toBeInTheDocument();
        expect(screen.getByText('src/config/database.ts')).toBeInTheDocument();
        // Other files should not be visible
        expect(screen.queryByText('package.json')).not.toBeInTheDocument();
      });

      // Step 7: Clear filters
      fireEvent.click(screen.getByLabelText('Filter by all severity'));
      fireEvent.change(searchInput, { target: { value: '' } });

      await waitFor(() => {
        // All projects should be visible again
        expect(screen.getByText('frontend-app')).toBeInTheDocument();
        expect(screen.getByText('backend-api')).toBeInTheDocument();
        expect(screen.getByText('mobile-app')).toBeInTheDocument();
      });

      // Step 8: Test export functionality
      const exportButton = screen.getByLabelText('Export vulnerability report as JSON');
      
      // Mock document.createElement and appendChild for download
      const mockLink = {
        click: jest.fn(),
        setAttribute: jest.fn(),
        style: {},
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

      fireEvent.click(exportButton);

      // Verify export was triggered
      await waitFor(() => {
        expect(mockLink.click).toHaveBeenCalled();
      });
    });

    it('should handle filter combinations correctly', async () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Apply high severity filter
      const highButton = screen.getByLabelText('Filter by high severity');
      fireEvent.click(highButton);

      await waitFor(() => {
        // Should show projects with high severity vulnerabilities
        expect(screen.getByText('frontend-app')).toBeInTheDocument();
        expect(screen.getByText('backend-api')).toBeInTheDocument();
      });

      // Add search filter for 'package.json'
      const searchInput = screen.getByPlaceholderText('Enter file path...');
      fireEvent.change(searchInput, { target: { value: 'package.json' } });

      await waitFor(() => {
        // Should show only backend-api (has high severity in package.json)
        expect(screen.getByText('backend-api')).toBeInTheDocument();
        // frontend-app should not be visible (no high severity in package.json)
        expect(screen.queryByText('frontend-app')).not.toBeInTheDocument();
      });
    });

    it('should handle no results gracefully', async () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Search for non-existent file
      const searchInput = screen.getByPlaceholderText('Enter file path...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent-file.xyz' } });

      await waitFor(() => {
        expect(screen.getByText('No vulnerabilities match the current filters.')).toBeInTheDocument();
        // No projects should be visible
        expect(screen.queryByText('frontend-app')).not.toBeInTheDocument();
        expect(screen.queryByText('backend-api')).not.toBeInTheDocument();
        expect(screen.queryByText('mobile-app')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Throughout Flow', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network request failed');
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockRejectedValue(networkError);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Network request failed')).toBeInTheDocument();
      });

      // Verify error state has retry button
      const retryButton = screen.getByLabelText('Retry loading dashboard');
      expect(retryButton).toBeInTheDocument();
    });

    it('should handle API timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockRejectedValue(timeoutError);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Request timeout')).toBeInTheDocument();
      });
    });

    it('should handle malformed data gracefully', async () => {
      const malformedData = {
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
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(malformedData);

      render(<DashboardContainer />);

      await waitFor(() => {
        // Should show empty state or handle gracefully
        expect(screen.getByText('No Vulnerabilities Found')).toBeInTheDocument();
      });
    });

    it('should recover from error state on retry', async () => {
      const error = new Error('Temporary error');
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockData);

      render(<DashboardContainer />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Error Loading Dashboard')).toBeInTheDocument();
      });

      // Mock window.location.reload
      delete (window as any).location;
      window.location = { reload: jest.fn() } as any;

      // Click retry
      const retryButton = screen.getByLabelText('Retry loading dashboard');
      fireEvent.click(retryButton);

      // Verify reload was called
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  describe('Responsive Behavior at Different Screen Sizes', () => {
    const setViewportWidth = (width: number) => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
      });
      window.dispatchEvent(new Event('resize'));
    };

    it('should render correctly on mobile viewport (< 768px)', async () => {
      setViewportWidth(375); // iPhone size
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      const { container } = render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Verify dashboard renders
      expect(screen.getByText('Vulnerability Dashboard')).toBeInTheDocument();
      
      // Verify projects are stacked (all visible)
      expect(screen.getByText('frontend-app')).toBeInTheDocument();
      expect(screen.getByText('backend-api')).toBeInTheDocument();
      expect(screen.getByText('mobile-app')).toBeInTheDocument();

      // Verify summary cards are present
      expect(screen.getByText('Total Projects')).toBeInTheDocument();
    });

    it('should render correctly on tablet viewport (768px - 1024px)', async () => {
      setViewportWidth(768);
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Verify all components render
      expect(screen.getByText('Vulnerability Dashboard')).toBeInTheDocument();
      expect(screen.getByText('frontend-app')).toBeInTheDocument();
    });

    it('should render correctly on desktop viewport (> 1024px)', async () => {
      setViewportWidth(1920);
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Verify all components render
      expect(screen.getByText('Vulnerability Dashboard')).toBeInTheDocument();
      expect(screen.getByText('frontend-app')).toBeInTheDocument();
    });

    it('should maintain functionality across viewport changes', async () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Start on desktop
      setViewportWidth(1920);
      
      // Apply filter
      const criticalButton = screen.getByLabelText('Filter by critical severity');
      fireEvent.click(criticalButton);

      await waitFor(() => {
        expect(screen.getByText('frontend-app')).toBeInTheDocument();
      });

      // Switch to mobile
      setViewportWidth(375);

      // Filter should still be active
      await waitFor(() => {
        expect(screen.getByText('frontend-app')).toBeInTheDocument();
        expect(screen.queryByText('mobile-app')).not.toBeInTheDocument();
      });
    });
  });

  describe('Collapsible Sections Interaction', () => {
    it('should toggle scanner sections', async () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      const { container } = render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Find a scanner section toggle button
      const scannerSections = container.querySelectorAll('.scanner-section');
      expect(scannerSections.length).toBeGreaterThan(0);

      // Find toggle button within first scanner section
      const firstSection = scannerSections[0];
      const toggleButton = within(firstSection as HTMLElement).getByRole('button');
      
      // Verify table is initially visible
      let table = within(firstSection as HTMLElement).queryByRole('table');
      expect(table).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(toggleButton);

      // Verify section is collapsed (content div should not exist)
      await waitFor(() => {
        const contentDiv = firstSection.querySelector('.scanner-section-content');
        expect(contentDiv).not.toBeInTheDocument();
      });

      // Click to expand
      fireEvent.click(toggleButton);

      // Verify section is expanded (content div should exist)
      await waitFor(() => {
        const contentDiv = firstSection.querySelector('.scanner-section-content');
        expect(contentDiv).toBeInTheDocument();
        const table = within(firstSection as HTMLElement).queryByRole('table');
        expect(table).toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality Integration', () => {
    it('should export filtered data correctly', async () => {
      (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

      render(<DashboardContainer />);

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
      });

      // Apply filter
      const criticalButton = screen.getByLabelText('Filter by critical severity');
      fireEvent.click(criticalButton);

      await waitFor(() => {
        expect(screen.getByText('frontend-app')).toBeInTheDocument();
      });

      // Mock download
      const mockLink = {
        click: jest.fn(),
        setAttribute: jest.fn(),
        style: {},
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

      // Export
      const exportButton = screen.getByLabelText('Export vulnerability report as JSON');
      fireEvent.click(exportButton);

      // Verify export was triggered
      await waitFor(() => {
        expect(mockLink.click).toHaveBeenCalled();
      });
    });
  });
});
