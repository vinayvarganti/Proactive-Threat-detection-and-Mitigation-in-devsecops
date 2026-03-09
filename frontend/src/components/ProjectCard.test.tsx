import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectCard, { ProjectVulnerabilities } from './ProjectCard';
import { Vulnerability } from './VulnerabilityTable';

describe('ProjectCard', () => {
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
      title: 'Secret Exposed',
      filePath: '/src/config/keys.ts',
      lineNumber: 10,
      status: 'open',
      scannerName: 'gitleaks'
    }
  ];

  const mockProject: ProjectVulnerabilities = {
    repositoryId: 'repo-123',
    repositoryName: 'my-awesome-project',
    totalVulnerabilities: 2,
    scanners: [
      {
        scannerName: 'semgrep',
        totalCount: 1,
        severityBreakdown: {
          critical: 1,
          high: 0,
          medium: 0,
          low: 0
        },
        vulnerabilities: [mockVulnerabilities[0]]
      },
      {
        scannerName: 'gitleaks',
        totalCount: 1,
        severityBreakdown: {
          critical: 0,
          high: 1,
          medium: 0,
          low: 0
        },
        vulnerabilities: [mockVulnerabilities[1]]
      }
    ]
  };

  const mockOnToggleSection = jest.fn();

  beforeEach(() => {
    mockOnToggleSection.mockClear();
  });

  describe('Card renders project name', () => {
    it('should display the project/repository name', () => {
      render(
        <ProjectCard
          project={mockProject}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      expect(screen.getByText('my-awesome-project')).toBeInTheDocument();
    });

    it('should display project name in header', () => {
      render(
        <ProjectCard
          project={mockProject}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      const header = screen.getByText('my-awesome-project');
      expect(header.tagName).toBe('H2');
      expect(header).toHaveClass('project-name');
    });
  });

  describe('Only scanners with vulnerabilities are shown', () => {
    it('should display scanner sections for scanners with vulnerabilities', () => {
      render(
        <ProjectCard
          project={mockProject}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      expect(screen.getByText('Semgrep')).toBeInTheDocument();
      expect(screen.getByText('Gitleaks')).toBeInTheDocument();
    });

    it('should not display scanner sections for scanners without vulnerabilities', () => {
      const projectWithEmptyScanner: ProjectVulnerabilities = {
        ...mockProject,
        scanners: [
          ...mockProject.scanners,
          {
            scannerName: 'trivy',
            totalCount: 0,
            severityBreakdown: {
              critical: 0,
              high: 0,
              medium: 0,
              low: 0
            },
            vulnerabilities: []
          }
        ]
      };

      render(
        <ProjectCard
          project={projectWithEmptyScanner}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      expect(screen.getByText('Semgrep')).toBeInTheDocument();
      expect(screen.getByText('Gitleaks')).toBeInTheDocument();
      expect(screen.queryByText('Trivy')).not.toBeInTheDocument();
    });
  });

  describe('Empty scanners are not displayed', () => {
    it('should filter out scanners with zero vulnerabilities', () => {
      const projectWithMixedScanners: ProjectVulnerabilities = {
        repositoryId: 'repo-456',
        repositoryName: 'test-project',
        totalVulnerabilities: 1,
        scanners: [
          {
            scannerName: 'semgrep',
            totalCount: 1,
            severityBreakdown: {
              critical: 1,
              high: 0,
              medium: 0,
              low: 0
            },
            vulnerabilities: [mockVulnerabilities[0]]
          },
          {
            scannerName: 'gitleaks',
            totalCount: 0,
            severityBreakdown: {
              critical: 0,
              high: 0,
              medium: 0,
              low: 0
            },
            vulnerabilities: []
          },
          {
            scannerName: 'trivy',
            totalCount: 0,
            severityBreakdown: {
              critical: 0,
              high: 0,
              medium: 0,
              low: 0
            },
            vulnerabilities: []
          }
        ]
      };

      const { container } = render(
        <ProjectCard
          project={projectWithMixedScanners}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      const scannerSections = container.querySelectorAll('.scanner-section');
      expect(scannerSections.length).toBe(1);
      expect(screen.getByText('Semgrep')).toBeInTheDocument();
    });

    it('should handle project with all scanners having zero vulnerabilities', () => {
      const projectWithNoVulnerabilities: ProjectVulnerabilities = {
        repositoryId: 'repo-789',
        repositoryName: 'clean-project',
        totalVulnerabilities: 0,
        scanners: [
          {
            scannerName: 'semgrep',
            totalCount: 0,
            severityBreakdown: {
              critical: 0,
              high: 0,
              medium: 0,
              low: 0
            },
            vulnerabilities: []
          },
          {
            scannerName: 'gitleaks',
            totalCount: 0,
            severityBreakdown: {
              critical: 0,
              high: 0,
              medium: 0,
              low: 0
            },
            vulnerabilities: []
          }
        ]
      };

      const { container } = render(
        <ProjectCard
          project={projectWithNoVulnerabilities}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      const scannerSections = container.querySelectorAll('.scanner-section');
      expect(scannerSections.length).toBe(0);
    });
  });

  describe('Multiple scanner sections render correctly', () => {
    it('should render all scanner sections with vulnerabilities', () => {
      const projectWithThreeScanners: ProjectVulnerabilities = {
        repositoryId: 'repo-multi',
        repositoryName: 'multi-scanner-project',
        totalVulnerabilities: 3,
        scanners: [
          {
            scannerName: 'semgrep',
            totalCount: 1,
            severityBreakdown: {
              critical: 1,
              high: 0,
              medium: 0,
              low: 0
            },
            vulnerabilities: [mockVulnerabilities[0]]
          },
          {
            scannerName: 'gitleaks',
            totalCount: 1,
            severityBreakdown: {
              critical: 0,
              high: 1,
              medium: 0,
              low: 0
            },
            vulnerabilities: [mockVulnerabilities[1]]
          },
          {
            scannerName: 'trivy',
            totalCount: 1,
            severityBreakdown: {
              critical: 0,
              high: 0,
              medium: 1,
              low: 0
            },
            vulnerabilities: [{
              id: '3',
              severity: 'medium',
              title: 'Outdated Package',
              filePath: '/package.json',
              lineNumber: 5,
              status: 'open',
              scannerName: 'trivy'
            }]
          }
        ]
      };

      render(
        <ProjectCard
          project={projectWithThreeScanners}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      expect(screen.getByText('Semgrep')).toBeInTheDocument();
      expect(screen.getByText('Gitleaks')).toBeInTheDocument();
      expect(screen.getByText('Trivy')).toBeInTheDocument();
    });

    it('should render scanner sections in order', () => {
      const { container } = render(
        <ProjectCard
          project={mockProject}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      const scannerSections = container.querySelectorAll('.scanner-section');
      expect(scannerSections.length).toBe(2);
    });
  });

  describe('Total vulnerability count', () => {
    it('should display total vulnerability count', () => {
      render(
        <ProjectCard
          project={mockProject}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      expect(screen.getByText('2 vulnerabilities')).toBeInTheDocument();
    });

    it('should use singular form for single vulnerability', () => {
      const projectWithOneVuln: ProjectVulnerabilities = {
        ...mockProject,
        totalVulnerabilities: 1,
        scanners: [mockProject.scanners[0]]
      };

      render(
        <ProjectCard
          project={projectWithOneVuln}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      expect(screen.getByText('1 vulnerability')).toBeInTheDocument();
    });
  });

  describe('Collapse state management', () => {
    it('should pass collapsed state to scanner sections', () => {
      const collapsedSections = new Set(['repo-123-semgrep']);

      render(
        <ProjectCard
          project={mockProject}
          collapsedSections={collapsedSections}
          onToggleSection={mockOnToggleSection}
        />
      );

      // Semgrep section should be collapsed (no vulnerability details visible)
      expect(screen.queryByText('SQL Injection')).not.toBeInTheDocument();
      
      // Gitleaks section should be expanded (vulnerability details visible)
      expect(screen.getByText('Secret Exposed')).toBeInTheDocument();
    });

    it('should call onToggleSection with correct section ID', () => {
      render(
        <ProjectCard
          project={mockProject}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      const semgrepHeader = screen.getByLabelText(/Semgrep scanner section/);
      fireEvent.click(semgrepHeader);

      expect(mockOnToggleSection).toHaveBeenCalledWith('repo-123-semgrep');
    });
  });

  describe('Accessibility', () => {
    it('should have article role on card', () => {
      const { container } = render(
        <ProjectCard
          project={mockProject}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      const card = container.querySelector('.project-card');
      expect(card).toHaveAttribute('role', 'article');
    });

    it('should have aria-label on card', () => {
      const { container } = render(
        <ProjectCard
          project={mockProject}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      const card = container.querySelector('.project-card');
      expect(card).toHaveAttribute('aria-label', 'Project my-awesome-project with 2 vulnerabilities');
    });

    it('should have aria-label on total count', () => {
      render(
        <ProjectCard
          project={mockProject}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      const totalCount = screen.getByLabelText('Total vulnerabilities: 2');
      expect(totalCount).toBeInTheDocument();
    });
  });

  describe('Data attributes', () => {
    it('should have data-testid with repository ID', () => {
      const { container } = render(
        <ProjectCard
          project={mockProject}
          collapsedSections={new Set()}
          onToggleSection={mockOnToggleSection}
        />
      );

      const card = container.querySelector('[data-testid="project-card-repo-123"]');
      expect(card).toBeInTheDocument();
    });
  });
});
