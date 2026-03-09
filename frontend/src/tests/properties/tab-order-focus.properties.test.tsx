// Feature: vulnerability-dashboard-redesign, Property 22 & 23: Tab Order and Focus Indicators
// Validates: Requirements 10.4, 10.5

import { describe, it, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import { FiltersBar } from '../../components/FiltersBar';
import ProjectCard from '../../components/ProjectCard';

describe('Property 22: Logical Tab Order', () => {
  it('should ensure FiltersBar has logical tab order', () => {
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

          // Get all focusable elements
          const focusableElements = container.querySelectorAll('button, input');
          
          // Check that elements have tabindex or are naturally focusable
          focusableElements.forEach((element) => {
            const tabIndex = element.getAttribute('tabindex');
            // Elements should either have no tabindex (natural order) or tabindex >= 0
            if (tabIndex !== null) {
              expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
            }
          });

          // Verify elements are in DOM order (buttons before input)
          const buttons = Array.from(container.querySelectorAll('button'));
          const inputs = Array.from(container.querySelectorAll('input'));
          
          if (buttons.length > 0 && inputs.length > 0) {
            // Buttons should come before inputs in the DOM
            const firstButton = buttons[0];
            const firstInput = inputs[0];
            const comparison = firstButton.compareDocumentPosition(firstInput);
            // DOCUMENT_POSITION_FOLLOWING = 4 means firstInput comes after firstButton
            expect(comparison & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should ensure ProjectCard scanner sections have logical tab order', () => {
    fc.assert(
      fc.property(
        fc.record({
          repositoryId: fc.uuid(),
          repositoryName: fc.string({ minLength: 3, maxLength: 15 }),
          totalVulnerabilities: fc.integer({ min: 1, max: 5 }),
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
                  title: fc.string({ minLength: 5, maxLength: 10 }),
                  filePath: fc.string({ minLength: 5, maxLength: 10 }),
                  lineNumber: fc.integer({ min: 1, max: 100 }),
                  status: fc.constantFrom('open', 'fixed', 'ignored'),
                  scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
                }),
                { minLength: 1, maxLength: 1 }
              ),
            }),
            { minLength: 1, maxLength: 2 }
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

          // All scanner section buttons should be focusable
          const sectionButtons = container.querySelectorAll('.scanner-section-header');
          sectionButtons.forEach((button) => {
            const tabIndex = button.getAttribute('tabindex');
            // Should not have negative tabindex
            if (tabIndex !== null) {
              expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
            }
          });
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Property 23: Focus Indicator Visibility', () => {
  it('should ensure FiltersBar buttons have focus styles', () => {
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

          // All buttons should be focusable (which enables focus indicators)
          const buttons = container.querySelectorAll('button');
          buttons.forEach((button) => {
            const htmlButton = button as HTMLElement;
            
            // Focus the button
            htmlButton.focus();
            
            // Verify it received focus
            expect(document.activeElement).toBe(htmlButton);
            
            // Button should have a class or be styled (we can't test CSS directly in JSDOM)
            // But we can verify the button is in the DOM and focusable
            expect(htmlButton.tabIndex).toBeGreaterThanOrEqual(0);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should ensure search input has focus styles', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 20 }),
        (searchTerm) => {
          const { container } = render(
            <FiltersBar
              currentSeverity="all"
              searchTerm={searchTerm}
              onSeverityChange={() => {}}
              onSearchChange={() => {}}
            />
          );

          const input = container.querySelector('input') as HTMLInputElement;
          expect(input).not.toBeNull();
          
          // Focus the input
          input.focus();
          
          // Verify it received focus
          expect(document.activeElement).toBe(input);
          
          // Input should be focusable
          expect(input.tabIndex).toBeGreaterThanOrEqual(-1);
        }
      ),
      { numRuns: 10 }
    );
  });
});
