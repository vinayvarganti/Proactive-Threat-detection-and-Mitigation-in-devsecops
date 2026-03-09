// Feature: vulnerability-dashboard-redesign, Property 21: Screen Reader Information
// Validates: Requirements 10.3
// For any severity indicator, vulnerability count, or section state, the information should be accessible to screen readers

import { describe, it, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import ScannerSection from '../../components/ScannerSection';
import SummaryCards from '../../components/SummaryCards';

describe('Property 21: Screen Reader Information', () => {
  it('should ensure severity indicators have screen reader information', () => {
    fc.assert(
      fc.property(
        fc.record({
          scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
          totalCount: fc.integer({ min: 1, max: 10 }),
          severityBreakdown: fc.record({
            critical: fc.integer({ min: 0, max: 3 }),
            high: fc.integer({ min: 0, max: 3 }),
            medium: fc.integer({ min: 0, max: 3 }),
            low: fc.integer({ min: 0, max: 3 }),
          }),
          vulnerabilities: fc.array(
            fc.record({
              id: fc.uuid(),
              severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
              title: fc.string({ minLength: 5, maxLength: 20 }),
              filePath: fc.string({ minLength: 5, maxLength: 20 }),
              lineNumber: fc.integer({ min: 1, max: 100 }),
              status: fc.constantFrom('open', 'fixed', 'ignored'),
              scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
            }),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        (scanner) => {
          const { container } = render(
            <ScannerSection
              scanner={scanner}
              repositoryId="test-repo"
              isCollapsed={false}
              onToggle={() => {}}
            />
          );

          // Check that severity counts have aria-label
          const severityCounts = container.querySelectorAll('.severity-count');
          severityCounts.forEach((count) => {
            expect(count.hasAttribute('aria-label')).toBe(true);
          });

          // Check that total count has aria-label
          const totalCount = container.querySelector('.scanner-total-count');
          expect(totalCount?.hasAttribute('aria-label')).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should ensure vulnerability counts are accessible', () => {
    fc.assert(
      fc.property(
        fc.record({
          totalProjects: fc.integer({ min: 0, max: 50 }),
          totalVulnerabilities: fc.integer({ min: 0, max: 500 }),
          criticalCount: fc.integer({ min: 0, max: 50 }),
          highCount: fc.integer({ min: 0, max: 50 }),
        }),
        (summary) => {
          const { container } = render(<SummaryCards summary={summary} />);

          // All summary card values should have aria-label
          const cardValues = container.querySelectorAll('.summary-card-value');
          cardValues.forEach((value) => {
            const ariaLabel = value.getAttribute('aria-label');
            expect(ariaLabel).toBeTruthy();
            expect(ariaLabel?.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should ensure section states are announced', () => {
    fc.assert(
      fc.property(
        fc.record({
          scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
          totalCount: fc.integer({ min: 1, max: 10 }),
          severityBreakdown: fc.record({
            critical: fc.integer({ min: 0, max: 2 }),
            high: fc.integer({ min: 0, max: 2 }),
            medium: fc.integer({ min: 0, max: 2 }),
            low: fc.integer({ min: 0, max: 2 }),
          }),
          vulnerabilities: fc.array(
            fc.record({
              id: fc.uuid(),
              severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
              title: fc.string({ minLength: 5, maxLength: 15 }),
              filePath: fc.string({ minLength: 5, maxLength: 15 }),
              lineNumber: fc.integer({ min: 1, max: 100 }),
              status: fc.constantFrom('open', 'fixed', 'ignored'),
              scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
            }),
            { minLength: 1, maxLength: 2 }
          ),
        }),
        fc.boolean(),
        (scanner, isCollapsed) => {
          const { container } = render(
            <ScannerSection
              scanner={scanner}
              repositoryId="test-repo"
              isCollapsed={isCollapsed}
              onToggle={() => {}}
            />
          );

          // Header button should have aria-label that includes state
          const headerButton = container.querySelector('.scanner-section-header');
          const ariaLabel = headerButton?.getAttribute('aria-label');
          expect(ariaLabel).toBeTruthy();
          
          // Aria-label should mention expand/collapse state
          if (isCollapsed) {
            expect(ariaLabel?.toLowerCase()).toContain('expand');
          } else {
            expect(ariaLabel?.toLowerCase()).toContain('collapse');
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
