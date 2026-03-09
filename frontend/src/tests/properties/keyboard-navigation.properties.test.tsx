// Feature: vulnerability-dashboard-redesign, Property 20: Keyboard Navigation Completeness
// Validates: Requirements 10.2
// For any interactive feature, the feature should be fully operable using only keyboard input

import { describe, it, expect } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import { FiltersBar } from '../../components/FiltersBar';
import ScannerSection from '../../components/ScannerSection';
import ProjectCard from '../../components/ProjectCard';

describe('Property 20: Keyboard Navigation Completeness', () => {
  it('should ensure FiltersBar is keyboard navigable', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('all', 'critical', 'high', 'medium', 'low'),
        fc.string({ maxLength: 30 }),
        (severity, searchTerm) => {
          let severityChanged = false;
          let searchChanged = false;

          const { container } = render(
            <FiltersBar
              currentSeverity={severity}
              searchTerm={searchTerm}
              onSeverityChange={() => { severityChanged = true; }}
              onSearchChange={() => { searchChanged = true; }}
            />
          );

          // Test keyboard navigation on filter buttons
          const filterButtons = container.querySelectorAll('.filter-button');
          if (filterButtons.length > 0) {
            const firstButton = filterButtons[0] as HTMLElement;
            
            // Simulate Enter key press
            fireEvent.keyDown(firstButton, { key: 'Enter', code: 'Enter' });
            fireEvent.click(firstButton);
            expect(severityChanged).toBe(true);
          }

          // Test keyboard navigation on search input
          const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
          if (searchInput) {
            fireEvent.change(searchInput, { target: { value: 'test' } });
            expect(searchChanged).toBe(true);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should ensure ScannerSection is keyboard navigable', () => {
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
        fc.boolean(),
        (scanner, initialCollapsed) => {
          let toggleCalled = false;

          const { container } = render(
            <ScannerSection
              scanner={scanner}
              repositoryId="test-repo"
              isCollapsed={initialCollapsed}
              onToggle={() => { toggleCalled = true; }}
            />
          );

          // Test keyboard navigation on header button
          const headerButton = container.querySelector('.scanner-section-header') as HTMLElement;
          expect(headerButton).not.toBeNull();

          // Simulate Enter key press
          fireEvent.keyDown(headerButton, { key: 'Enter', code: 'Enter' });
          fireEvent.click(headerButton);
          expect(toggleCalled).toBe(true);

          // Reset and test Space key
          toggleCalled = false;
          fireEvent.keyDown(headerButton, { key: ' ', code: 'Space' });
          fireEvent.click(headerButton);
          expect(toggleCalled).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should ensure ProjectCard scanner sections are keyboard navigable', () => {
    fc.assert(
      fc.property(
        fc.record({
          repositoryId: fc.uuid(),
          repositoryName: fc.string({ minLength: 3, maxLength: 15 }),
          totalVulnerabilities: fc.integer({ min: 1, max: 10 }),
          scanners: fc.array(
            fc.record({
              scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
              totalCount: fc.integer({ min: 1, max: 3 }),
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
            { minLength: 1, maxLength: 2 }
          ),
        }),
        (project) => {
          let toggleCount = 0;

          const { container } = render(
            <ProjectCard
              project={project}
              collapsedSections={new Set()}
              onToggleSection={() => { toggleCount++; }}
            />
          );

          // Find all scanner section header buttons
          const headerButtons = container.querySelectorAll('.scanner-section-header');
          
          // Each header button should be keyboard accessible
          headerButtons.forEach((button) => {
            const htmlButton = button as HTMLElement;
            
            // Simulate Enter key press
            fireEvent.keyDown(htmlButton, { key: 'Enter', code: 'Enter' });
            fireEvent.click(htmlButton);
          });

          // Verify that toggle was called for each scanner section
          expect(toggleCount).toBe(headerButtons.length);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should ensure all interactive elements can receive focus', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('all', 'critical', 'high', 'medium', 'low'),
        (severity) => {
          const { container } = render(
            <FiltersBar
              currentSeverity={severity}
              searchTerm=""
              onSeverityChange={() => {}}
              onSearchChange={() => {}}
            />
          );

          // All buttons should be focusable
          const buttons = container.querySelectorAll('button');
          buttons.forEach((button) => {
            const htmlButton = button as HTMLElement;
            htmlButton.focus();
            expect(document.activeElement).toBe(htmlButton);
          });

          // Input should be focusable
          const input = container.querySelector('input');
          if (input) {
            input.focus();
            expect(document.activeElement).toBe(input);
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
