// Feature: vulnerability-dashboard-redesign, Property 19: ARIA Label Completeness
// Validates: Requirements 10.1
// For any interactive element in the dashboard, the element should have an appropriate ARIA label

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import DashboardContainer from '../../components/DashboardContainer';
import { FiltersBar } from '../../components/FiltersBar';
import ScannerSection from '../../components/ScannerSection';
import ProjectCard from '../../components/ProjectCard';
import SummaryCards from '../../components/SummaryCards';
import { vulnerabilityService } from '../../services/vulnerabilityService';

// Mock the vulnerability service
jest.mock('../../services/vulnerabilityService');

describe('Property 19: ARIA Label Completeness', () => {
  it('should ensure all interactive elements have ARIA labels', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          totalProjects: fc.integer({ min: 1, max: 2 }),
          totalVulnerabilities: fc.integer({ min: 1, max: 5 }),
          criticalCount: fc.integer({ min: 0, max: 3 }),
          highCount: fc.integer({ min: 0, max: 3 }),
        }),
        fc.array(
          fc.record({
            repositoryId: fc.uuid(),
            repositoryName: fc.string({ minLength: 3, maxLength: 10 }),
            totalVulnerabilities: fc.integer({ min: 1, max: 3 }),
            scanners: fc.array(
              fc.record({
                scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
                totalCount: fc.integer({ min: 1, max: 2 }),
                severityBreakdown: fc.record({
                  critical: fc.integer({ min: 0, max: 1 }),
                  high: fc.integer({ min: 0, max: 1 }),
                  medium: fc.integer({ min: 0, max: 1 }),
                  low: fc.integer({ min: 0, max: 1 }),
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
              { minLength: 1, maxLength: 2 }
            ),
          }),
          { minLength: 1, maxLength: 2 }
        ),
        async (summary, projects) => {
          // Mock the API response
          const mockData = { summary, projects };
          (vulnerabilityService.fetchGroupedVulnerabilities as jest.Mock).mockResolvedValue(mockData);

          const { container } = render(<DashboardContainer />);

          // Wait for data to load
          await screen.findByText(/Vulnerability Dashboard/i);

          // Check all buttons have aria-label or aria-labelledby
          const buttons = container.querySelectorAll('button');
          buttons.forEach((button) => {
            const hasAriaLabel = button.hasAttribute('aria-label') || 
                                 button.hasAttribute('aria-labelledby') ||
                                 button.textContent?.trim().length > 0;
            expect(hasAriaLabel).toBe(true);
          });

          // Check all inputs have aria-label or associated label
          const inputs = container.querySelectorAll('input');
          inputs.forEach((input) => {
            const hasAriaLabel = input.hasAttribute('aria-label') || 
                                 input.hasAttribute('aria-labelledby') ||
                                 input.id && container.querySelector(`label[for="${input.id}"]`);
            expect(hasAriaLabel).toBe(true);
          });

          // Check collapsible sections have aria-expanded
          const collapsibleButtons = container.querySelectorAll('[aria-expanded]');
          expect(collapsibleButtons.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  it('should ensure FiltersBar buttons have proper ARIA labels', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('all', 'critical', 'high', 'medium', 'low'),
        fc.string({ maxLength: 50 }),
        (severity, searchTerm) => {
          const { container } = render(
            <FiltersBar
              currentSeverity={severity}
              searchTerm={searchTerm}
              onSeverityChange={() => {}}
              onSearchChange={() => {}}
            />
          );

          // All filter buttons should have aria-label
          const filterButtons = container.querySelectorAll('.filter-button');
          filterButtons.forEach((button) => {
            expect(button.hasAttribute('aria-label')).toBe(true);
            expect(button.hasAttribute('aria-pressed')).toBe(true);
          });

          // Search input should have aria-label
          const searchInput = container.querySelector('input[type="text"]');
          expect(searchInput).not.toBeNull();
          expect(searchInput?.hasAttribute('aria-label') || searchInput?.id).toBeTruthy();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should ensure ScannerSection has proper ARIA attributes', () => {
    fc.assert(
      fc.property(
        fc.record({
          scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
          totalCount: fc.integer({ min: 1, max: 20 }),
          severityBreakdown: fc.record({
            critical: fc.integer({ min: 0, max: 5 }),
            high: fc.integer({ min: 0, max: 5 }),
            medium: fc.integer({ min: 0, max: 5 }),
            low: fc.integer({ min: 0, max: 5 }),
          }),
          vulnerabilities: fc.array(
            fc.record({
              id: fc.uuid(),
              severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
              title: fc.string({ minLength: 5, maxLength: 30 }),
              filePath: fc.string({ minLength: 5, maxLength: 30 }),
              lineNumber: fc.integer({ min: 1, max: 1000 }),
              status: fc.constantFrom('open', 'fixed', 'ignored'),
              scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
            }),
            { minLength: 1, maxLength: 5 }
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

          // Header button should have aria-expanded and aria-label
          const headerButton = container.querySelector('.scanner-section-header');
          expect(headerButton?.hasAttribute('aria-expanded')).toBe(true);
          expect(headerButton?.hasAttribute('aria-label')).toBe(true);
          expect(headerButton?.hasAttribute('aria-controls')).toBe(true);

          // Content region should have proper role and aria-label when expanded
          if (!isCollapsed) {
            const contentRegion = container.querySelector('[role="region"]');
            expect(contentRegion).not.toBeNull();
            expect(contentRegion?.hasAttribute('aria-label')).toBe(true);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should ensure ProjectCard has proper ARIA attributes', () => {
    fc.assert(
      fc.property(
        fc.record({
          repositoryId: fc.uuid(),
          repositoryName: fc.string({ minLength: 3, maxLength: 20 }),
          totalVulnerabilities: fc.integer({ min: 1, max: 20 }),
          scanners: fc.array(
            fc.record({
              scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
              totalCount: fc.integer({ min: 1, max: 5 }),
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
                  title: fc.string({ minLength: 5, maxLength: 30 }),
                  filePath: fc.string({ minLength: 5, maxLength: 30 }),
                  lineNumber: fc.integer({ min: 1, max: 1000 }),
                  status: fc.constantFrom('open', 'fixed', 'ignored'),
                  scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
                }),
                { minLength: 1, maxLength: 3 }
              ),
            }),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        (project) => {
          const { container } = render(
            <ProjectCard
              project={project}
              collapsedSections={new Set()}
              onToggleSection={() => {}}
            />
          );

          // Project card should have role="article" and aria-label
          const projectCard = container.querySelector('.project-card');
          expect(projectCard?.hasAttribute('role')).toBe(true);
          expect(projectCard?.getAttribute('role')).toBe('article');
          expect(projectCard?.hasAttribute('aria-label')).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should ensure SummaryCards has proper ARIA attributes', () => {
    fc.assert(
      fc.property(
        fc.record({
          totalProjects: fc.integer({ min: 0, max: 100 }),
          totalVulnerabilities: fc.integer({ min: 0, max: 1000 }),
          criticalCount: fc.integer({ min: 0, max: 100 }),
          highCount: fc.integer({ min: 0, max: 100 }),
        }),
        (summary) => {
          const { container } = render(<SummaryCards summary={summary} />);

          // Summary cards container should have role="region" and aria-label
          const summaryContainer = container.querySelector('.summary-cards');
          expect(summaryContainer?.hasAttribute('role')).toBe(true);
          expect(summaryContainer?.getAttribute('role')).toBe('region');
          expect(summaryContainer?.hasAttribute('aria-label')).toBe(true);

          // Each card value should have aria-label
          const cardValues = container.querySelectorAll('.summary-card-value');
          cardValues.forEach((value) => {
            expect(value.hasAttribute('aria-label')).toBe(true);
          });
        }
      ),
      { numRuns: 10 }
    );
  });
});
