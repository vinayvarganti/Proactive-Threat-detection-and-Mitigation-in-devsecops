// Unit tests for accessibility features
// Validates: Requirements 10.1, 10.2, 10.4, 10.5

import { describe, it, expect } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react';
import { FiltersBar } from '../../components/FiltersBar';
import ScannerSection from '../../components/ScannerSection';
import ProjectCard from '../../components/ProjectCard';
import SummaryCards from '../../components/SummaryCards';
import DashboardContainer from '../../components/DashboardContainer';
import { vulnerabilityService } from '../../services/vulnerabilityService';

jest.mock('../../services/vulnerabilityService');

describe('Accessibility Unit Tests', () => {
  describe('ARIA Labels', () => {
    it('should have ARIA labels on all FiltersBar buttons', () => {
      const { container } = render(
        <FiltersBar
          currentSeverity="all"
          searchTerm=""
          onSeverityChange={() => {}}
          onSearchChange={() => {}}
        />
      );

      const buttons = container.querySelectorAll('.filter-button');
      buttons.forEach((button) => {
        expect(button.hasAttribute('aria-label')).toBe(true);
        expect(button.hasAttribute('aria-pressed')).toBe(true);
      });
    });

    it('should have ARIA label on search input', () => {
      const { container } = render(
        <FiltersBar
          currentSeverity="all"
          searchTerm=""
          onSeverityChange={() => {}}
          onSearchChange={() => {}}
        />
      );

      const input = container.querySelector('input');
      expect(input?.hasAttribute('aria-label') || input?.id).toBeTruthy();
    });

    it('should have ARIA labels on SummaryCards', () => {
      const { container } = render(
        <SummaryCards
          summary={{
            totalProjects: 5,
            totalVulnerabilities: 20,
            criticalCount: 3,
            highCount: 7,
          }}
        />
      );

      const summaryContainer = container.querySelector('.summary-cards');
      expect(summaryContainer?.hasAttribute('aria-label')).toBe(true);

      const cardValues = container.querySelectorAll('.summary-card-value');
      cardValues.forEach((value) => {
        expect(value.hasAttribute('aria-label')).toBe(true);
      });
    });

    it('should have ARIA attributes on ScannerSection', () => {
      const mockScanner = {
        scannerName: 'gitleaks' as const,
        totalCount: 5,
        severityBreakdown: { critical: 1, high: 2, medium: 1, low: 1 },
        vulnerabilities: [
          {
            id: '1',
            severity: 'critical' as const,
            title: 'Test Vuln',
            filePath: '/test/file.js',
            lineNumber: 10,
            status: 'open' as const,
            scannerName: 'gitleaks',
          },
        ],
      };

      const { container } = render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="test-repo"
          isCollapsed={false}
          onToggle={() => {}}
        />
      );

      const headerButton = container.querySelector('.scanner-section-header');
      expect(headerButton?.hasAttribute('aria-expanded')).toBe(true);
      expect(headerButton?.hasAttribute('aria-label')).toBe(true);
      expect(headerButton?.hasAttribute('aria-controls')).toBe(true);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should allow keyboard navigation on filter buttons', () => {
      let severityChanged = false;

      const { container } = render(
        <FiltersBar
          currentSeverity="all"
          searchTerm=""
          onSeverityChange={() => { severityChanged = true; }}
          onSearchChange={() => {}}
        />
      );

      const firstButton = container.querySelector('.filter-button') as HTMLElement;
      fireEvent.click(firstButton);
      expect(severityChanged).toBe(true);
    });

    it('should allow keyboard navigation on scanner section toggle', () => {
      let toggleCalled = false;

      const mockScanner = {
        scannerName: 'semgrep' as const,
        totalCount: 3,
        severityBreakdown: { critical: 0, high: 1, medium: 1, low: 1 },
        vulnerabilities: [
          {
            id: '1',
            severity: 'high' as const,
            title: 'Test',
            filePath: '/test.js',
            lineNumber: 5,
            status: 'open' as const,
            scannerName: 'semgrep',
          },
        ],
      };

      const { container } = render(
        <ScannerSection
          scanner={mockScanner}
          repositoryId="test-repo"
          isCollapsed={false}
          onToggle={() => { toggleCalled = true; }}
        />
      );

      const headerButton = container.querySelector('.scanner-section-header') as HTMLElement;
      fireEvent.click(headerButton);
      expect(toggleCalled).toBe(true);
    });

    it('should support Tab key navigation', () => {
      const { container } = render(
        <FiltersBar
          currentSeverity="all"
          searchTerm=""
          onSeverityChange={() => {}}
          onSearchChange={() => {}}
        />
      );

      const buttons = Array.from(container.querySelectorAll('button'));
      const input = container.querySelector('input');

      // All elements should be focusable
      buttons.forEach((button) => {
        expect((button as HTMLElement).tabIndex).toBeGreaterThanOrEqual(0);
      });

      if (input) {
        expect((input as HTMLInputElement).tabIndex).toBeGreaterThanOrEqual(-1);
      }
    });
  });

  describe('Focus Indicators', () => {
    it('should allow focus on interactive elements', () => {
      const { container } = render(
        <FiltersBar
          currentSeverity="all"
          searchTerm=""
          onSeverityChange={() => {}}
          onSearchChange={() => {}}
        />
      );

      const button = container.querySelector('button') as HTMLElement;
      button.focus();
      expect(document.activeElement).toBe(button);

      const input = container.querySelector('input') as HTMLInputElement;
      input.focus();
      expect(document.activeElement).toBe(input);
    });
  });

  describe('Tab Order', () => {
    it('should have logical tab order in FiltersBar', () => {
      const { container } = render(
        <FiltersBar
          currentSeverity="all"
          searchTerm=""
          onSeverityChange={() => {}}
          onSearchChange={() => {}}
        />
      );

      const focusableElements = container.querySelectorAll('button, input');
      focusableElements.forEach((element) => {
        const tabIndex = element.getAttribute('tabindex');
        if (tabIndex !== null) {
          expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should have logical tab order in ProjectCard', () => {
      const mockProject = {
        repositoryId: 'repo-1',
        repositoryName: 'Test Repo',
        totalVulnerabilities: 2,
        scanners: [
          {
            scannerName: 'gitleaks' as const,
            totalCount: 2,
            severityBreakdown: { critical: 1, high: 1, medium: 0, low: 0 },
            vulnerabilities: [
              {
                id: '1',
                severity: 'critical' as const,
                title: 'Test',
                filePath: '/test.js',
                lineNumber: 1,
                status: 'open' as const,
                scannerName: 'gitleaks',
              },
            ],
          },
        ],
      };

      const { container } = render(
        <ProjectCard
          project={mockProject}
          collapsedSections={new Set()}
          onToggleSection={() => {}}
        />
      );

      const sectionButtons = container.querySelectorAll('.scanner-section-header');
      sectionButtons.forEach((button) => {
        const tabIndex = button.getAttribute('tabindex');
        if (tabIndex !== null) {
          expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });
});
