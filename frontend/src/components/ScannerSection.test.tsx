import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScannerSection, { ScannerVulnerabilities } from './ScannerSection';
import { Vulnerability } from './VulnerabilityTable';

describe('ScannerSection', () => {
  const mockVulnerabilities: Vulnerability[] = [
    {
      id: '1',
      severity: 'critical',
      title: 'SQL Injection',
      filePath: '/src/db/query.ts',
      lineNumber: 42,
      status: 'open',
      scannerName: 'semgrep'
    },
    {
      id: '2',
      severity: 'high',
      title: 'XSS Vulnerability',
      filePath: '/src/ui/render.ts',
      lineNumber: 15,
      status: 'open',
      scannerName: 'semgrep'
    },
    {
      id: '3',
      severity: 'medium',
      title: 'Weak Crypto',
      filePath: '/src/crypto/hash.ts',
      lineNumber: 8,
      status: 'fixed',
      scannerName: 'semgrep'
    }
  ];

  const mockScanner: ScannerVulnerabilities = {
    scannerName: 'semgrep',
    totalCount: 3,
    severityBreakdown: {
      critical: 1,
      high: 1,
      medium: 1,
      low: 0
    },
    vulnerabilities: mockVulnerabilities
  };

  const mockOnToggle = jest.fn();

  beforeEach(() => {
    mockOnToggle.mockClear();
  });

  describe('Section renders with correct scanner name', () => {
    it('should display scanner name with proper capitalization', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Semgrep')).toBeInTheDocument();
    });

    it('should display Gitleaks scanner name', () => {
      const gitleaksScanner: ScannerVulnerabilities = {
        ...mockScanner,
        scannerName: 'gitleaks'
      };

      render(
        <ScannerSection
          scanner={gitleaksScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Gitleaks')).toBeInTheDocument();
    });

    it('should display Trivy scanner name', () => {
      const trivyScanner: ScannerVulnerabilities = {
        ...mockScanner,
        scannerName: 'trivy'
      };

      render(
        <ScannerSection
          scanner={trivyScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Trivy')).toBeInTheDocument();
    });
  });

  describe('Counts display correctly', () => {
    it('should display total count', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Total: 3')).toBeInTheDocument();
    });

    it('should display severity breakdown counts', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Critical: 1')).toBeInTheDocument();
      expect(screen.getByText('High: 1')).toBeInTheDocument();
      expect(screen.getByText('Medium: 1')).toBeInTheDocument();
    });

    it('should not display severity counts when they are zero', () => {
      const scannerWithNoLow: ScannerVulnerabilities = {
        ...mockScanner,
        severityBreakdown: {
          critical: 1,
          high: 1,
          medium: 1,
          low: 0
        }
      };

      render(
        <ScannerSection
          scanner={scannerWithNoLow}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.queryByText(/Low:/)).not.toBeInTheDocument();
    });

    it('should display all severity counts when all are non-zero', () => {
      const scannerWithAll: ScannerVulnerabilities = {
        ...mockScanner,
        totalCount: 4,
        severityBreakdown: {
          critical: 1,
          high: 1,
          medium: 1,
          low: 1
        }
      };

      render(
        <ScannerSection
          scanner={scannerWithAll}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Critical: 1')).toBeInTheDocument();
      expect(screen.getByText('High: 1')).toBeInTheDocument();
      expect(screen.getByText('Medium: 1')).toBeInTheDocument();
      expect(screen.getByText('Low: 1')).toBeInTheDocument();
    });
  });

  describe('Collapse/expand toggles table visibility', () => {
    it('should show table when not collapsed', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      // Table should be visible - check for vulnerability titles
      expect(screen.getByText('SQL Injection')).toBeInTheDocument();
      expect(screen.getByText('XSS Vulnerability')).toBeInTheDocument();
    });

    it('should hide table when collapsed', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      // Table should not be visible
      expect(screen.queryByText('SQL Injection')).not.toBeInTheDocument();
      expect(screen.queryByText('XSS Vulnerability')).not.toBeInTheDocument();
    });

    it('should call onToggle when header is clicked', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const header = screen.getByRole('button');
      fireEvent.click(header);

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });

    it('should update aria-expanded attribute based on collapsed state', () => {
      const { rerender } = render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const header = screen.getByRole('button');
      expect(header).toHaveAttribute('aria-expanded', 'true');

      rerender(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      expect(header).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Header remains visible when collapsed', () => {
    it('should show scanner name when collapsed', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Semgrep')).toBeInTheDocument();
    });

    it('should show total count when collapsed', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Total: 3')).toBeInTheDocument();
    });

    it('should show severity breakdown when collapsed', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Critical: 1')).toBeInTheDocument();
      expect(screen.getByText('High: 1')).toBeInTheDocument();
      expect(screen.getByText('Medium: 1')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on header button', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const header = screen.getByRole('button');
      expect(header).toHaveAttribute('aria-label');
      expect(header.getAttribute('aria-label')).toContain('Semgrep');
      expect(header.getAttribute('aria-label')).toContain('3 vulnerabilities');
    });

    it('should have aria-controls attribute', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const header = screen.getByRole('button');
      expect(header).toHaveAttribute('aria-controls', 'repo-1-semgrep-content');
    });

    it('should have region role on content area', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const content = screen.getByRole('region');
      expect(content).toBeInTheDocument();
      expect(content).toHaveAttribute('aria-label', 'Semgrep vulnerabilities table');
    });

    it('should have aria-labels on severity counts', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByLabelText('Critical: 1')).toBeInTheDocument();
      expect(screen.getByLabelText('High: 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Medium: 1')).toBeInTheDocument();
    });
  });

  describe('Toggle icon', () => {
    it('should show right arrow when collapsed', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={true}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('▶')).toBeInTheDocument();
    });

    it('should show down arrow when expanded', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('▼')).toBeInTheDocument();
    });
  });

  describe('Severity colors', () => {
    it('should apply correct colors to severity counts', () => {
      render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="repo-1"
          isCollapsed={false}
          onToggle={mockOnToggle}
        />
      );

      const criticalCount = screen.getByText('Critical: 1');
      const highCount = screen.getByText('High: 1');
      const mediumCount = screen.getByText('Medium: 1');

      expect(criticalCount).toHaveStyle({ color: '#dc2626' });
      expect(highCount).toHaveStyle({ color: '#ea580c' });
      expect(mediumCount).toHaveStyle({ color: '#ca8a04' });
    });
  });
});
