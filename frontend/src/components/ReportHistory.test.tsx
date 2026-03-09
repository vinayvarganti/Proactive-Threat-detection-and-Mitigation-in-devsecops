import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportHistory from './ReportHistory';
import { reportService } from '../services/reportService';

// Mock the report service
jest.mock('../services/reportService');

// Mock the VulnerabilityDashboard component
jest.mock('./VulnerabilityDashboard', () => {
  return function MockVulnerabilityDashboard({ reportId }: { reportId?: string }) {
    return <div data-testid="vulnerability-dashboard">Dashboard for report: {reportId}</div>;
  };
});

describe('ReportHistory Component', () => {
  const mockReports = [
    {
      id: 'report1',
      repositoryId: 'repo1',
      repositoryName: 'test-repo',
      repositoryFullName: 'user/test-repo',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      summary: {
        total: 10,
        bySeverity: { critical: 2, high: 3, medium: 3, low: 2 },
        byStatus: { pending: 5, in_progress: 2, fixed: 3, verified: 0 }
      },
      scanDuration: 5000,
      scannerResults: {
        semgrep: { success: true, count: 5 },
        trivy: { success: true, count: 3 },
        gitleaks: { success: true, count: 2 }
      }
    },
    {
      id: 'report2',
      repositoryId: 'repo1',
      repositoryName: 'test-repo',
      repositoryFullName: 'user/test-repo',
      timestamp: new Date('2024-01-14T10:00:00Z'),
      summary: {
        total: 5,
        bySeverity: { critical: 1, high: 1, medium: 2, low: 1 },
        byStatus: { pending: 3, in_progress: 0, fixed: 2, verified: 0 }
      },
      scanDuration: 3000,
      scannerResults: {
        semgrep: { success: true, count: 3 },
        trivy: { success: true, count: 2 },
        gitleaks: { success: false, count: 0, error: 'Scanner failed' }
      }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (reportService.fetchReports as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<ReportHistory />);
    expect(screen.getByText(/loading report history/i)).toBeInTheDocument();
  });

  it('displays list of reports after loading', async () => {
    (reportService.fetchReports as jest.Mock).mockResolvedValue(mockReports);

    render(<ReportHistory />);

    await waitFor(() => {
      expect(screen.getByText('Scan Report History')).toBeInTheDocument();
    });

    expect(screen.getByText('2 reports')).toBeInTheDocument();
    expect(screen.getAllByText('test-repo').length).toBe(2);
  });

  it('displays report summary information', async () => {
    (reportService.fetchReports as jest.Mock).mockResolvedValue(mockReports);

    render(<ReportHistory />);

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument(); // Total vulnerabilities
    });

    expect(screen.getByText(/Critical: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/High: 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Medium: 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Low: 2/i)).toBeInTheDocument();
  });

  it('displays scan duration and scanner status', async () => {
    (reportService.fetchReports as jest.Mock).mockResolvedValue(mockReports);

    render(<ReportHistory />);

    await waitFor(() => {
      expect(screen.getByText('5.00s')).toBeInTheDocument();
    });

    expect(screen.getByText('3/3 scanners successful')).toBeInTheDocument();
    expect(screen.getByText('2/3 scanners successful')).toBeInTheDocument();
  });

  it('navigates to report detail view when report is clicked', async () => {
    (reportService.fetchReports as jest.Mock).mockResolvedValue(mockReports);

    render(<ReportHistory />);

    await waitFor(() => {
      expect(screen.getByText('Scan Report History')).toBeInTheDocument();
    });

    const reportCards = screen.getAllByRole('button');
    fireEvent.click(reportCards[0]);

    await waitFor(() => {
      expect(screen.getByTestId('vulnerability-dashboard')).toBeInTheDocument();
      expect(screen.getByText(/Dashboard for report: report1/i)).toBeInTheDocument();
    });
  });

  it('returns to list view when back button is clicked', async () => {
    (reportService.fetchReports as jest.Mock).mockResolvedValue(mockReports);

    render(<ReportHistory />);

    await waitFor(() => {
      expect(screen.getByText('Scan Report History')).toBeInTheDocument();
    });

    // Click on a report
    const reportCards = screen.getAllByRole('button');
    fireEvent.click(reportCards[0]);

    await waitFor(() => {
      expect(screen.getByTestId('vulnerability-dashboard')).toBeInTheDocument();
    });

    // Click back button
    const backButton = screen.getByText(/back to report history/i);
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText('Scan Report History')).toBeInTheDocument();
    });
  });

  it('displays error message when fetch fails', async () => {
    (reportService.fetchReports as jest.Mock).mockRejectedValue(
      new Error('Failed to fetch reports')
    );

    render(<ReportHistory />);

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch reports/i)).toBeInTheDocument();
    });
  });

  it('displays empty state when no reports exist', async () => {
    (reportService.fetchReports as jest.Mock).mockResolvedValue([]);

    render(<ReportHistory />);

    await waitFor(() => {
      expect(screen.getByText(/no scan reports found/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/run a repository scan to generate your first report/i)).toBeInTheDocument();
  });

  it('filters reports by repository ID when provided', async () => {
    (reportService.fetchReports as jest.Mock).mockResolvedValue(mockReports);

    render(<ReportHistory repositoryId="repo1" />);

    await waitFor(() => {
      expect(reportService.fetchReports).toHaveBeenCalledWith('repo1');
    });
  });

  it('displays status summary correctly', async () => {
    (reportService.fetchReports as jest.Mock).mockResolvedValue(mockReports);

    render(<ReportHistory />);

    await waitFor(() => {
      expect(screen.getByText(/3 fixed, 2 in progress, 5 pending/i)).toBeInTheDocument();
    });
  });

  it('handles keyboard navigation for report selection', async () => {
    (reportService.fetchReports as jest.Mock).mockResolvedValue(mockReports);

    render(<ReportHistory />);

    await waitFor(() => {
      expect(screen.getByText('Scan Report History')).toBeInTheDocument();
    });

    const reportCards = screen.getAllByRole('button');
    fireEvent.keyDown(reportCards[0], { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByTestId('vulnerability-dashboard')).toBeInTheDocument();
    });
  });
});
