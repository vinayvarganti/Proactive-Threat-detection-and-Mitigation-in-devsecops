import * as fc from 'fast-check';
import {
  filterVulnerabilities,
  ProjectVulnerabilities,
  ScannerVulnerabilities,
  Vulnerability,
  SeverityFilter,
} from './filterVulnerabilities';

// Feature: vulnerability-dashboard-redesign, Property 10: Severity Filter Correctness
// **Validates: Requirements 5.2**
// For any severity filter selection (Critical, High, Medium, Low) and any dataset,
// only vulnerabilities matching that severity should be visible across all projects and scanners.

// Feature: vulnerability-dashboard-redesign, Property 11: Search Filter Correctness
// **Validates: Requirements 5.4**
// For any search term and any dataset, only vulnerabilities whose file path contains
// that search term (case-insensitive) should be visible.

// Feature: vulnerability-dashboard-redesign, Property 12: Combined Filter Logic
// **Validates: Requirements 5.5**
// For any combination of active filters (severity and search term), the displayed
// vulnerabilities should be the intersection of all filter criteria (AND logic).

describe('filterVulnerabilities - Property-Based Tests', () => {
  // Arbitraries for generating test data
  const severityArb = fc.constantFrom<'critical' | 'high' | 'medium' | 'low'>(
    'critical',
    'high',
    'medium',
    'low'
  );

  const vulnerabilityArb = fc.record({
    id: fc.uuid(),
    severity: severityArb,
    title: fc.string({ minLength: 1, maxLength: 100 }),
    filePath: fc.string({ minLength: 1, maxLength: 50 }).map((s) => `src/${s.replace(/\s/g, '_')}.ts`),
    lineNumber: fc.integer({ min: 1, max: 1000 }),
    status: fc.constantFrom('open', 'fixed', 'ignored'),
    scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
  });

  const scannerVulnerabilitiesArb = fc
    .record({
      scannerName: fc.constantFrom<'gitleaks' | 'semgrep' | 'trivy'>('gitleaks', 'semgrep', 'trivy'),
      vulnerabilities: fc.array(vulnerabilityArb, { minLength: 1, maxLength: 20 }),
    })
    .map((data) => {
      const severityBreakdown = {
        critical: data.vulnerabilities.filter((v) => v.severity === 'critical').length,
        high: data.vulnerabilities.filter((v) => v.severity === 'high').length,
        medium: data.vulnerabilities.filter((v) => v.severity === 'medium').length,
        low: data.vulnerabilities.filter((v) => v.severity === 'low').length,
      };

      return {
        scannerName: data.scannerName,
        totalCount: data.vulnerabilities.length,
        severityBreakdown,
        vulnerabilities: data.vulnerabilities,
      } as ScannerVulnerabilities;
    });

  const projectVulnerabilitiesArb = fc
    .record({
      repositoryId: fc.uuid(),
      repositoryName: fc.string({ minLength: 1, maxLength: 50 }),
      scanners: fc.array(scannerVulnerabilitiesArb, { minLength: 1, maxLength: 3 }),
    })
    .map((data) => {
      const totalVulnerabilities = data.scanners.reduce(
        (sum, scanner) => sum + scanner.totalCount,
        0
      );

      return {
        repositoryId: data.repositoryId,
        repositoryName: data.repositoryName,
        totalVulnerabilities,
        scanners: data.scanners,
      } as ProjectVulnerabilities;
    });

  const projectsArb = fc.array(projectVulnerabilitiesArb, { minLength: 0, maxLength: 10 });

  describe('Property 10: Severity Filter Correctness', () => {
    it('should only show vulnerabilities matching the selected severity', () => {
      fc.assert(
        fc.property(
          projectsArb,
          fc.constantFrom<SeverityFilter>('critical', 'high', 'medium', 'low'),
          (projects, severity) => {
            const filtered = filterVulnerabilities(projects, severity, '');

            // Collect all vulnerabilities from filtered result
            const allFilteredVulns: Vulnerability[] = [];
            for (const project of filtered) {
              for (const scanner of project.scanners) {
                allFilteredVulns.push(...scanner.vulnerabilities);
              }
            }

            // Every vulnerability in the result must match the severity filter
            for (const vuln of allFilteredVulns) {
              expect(vuln.severity).toBe(severity);
            }

            // Verify no vulnerabilities of other severities are present
            const otherSeverities = ['critical', 'high', 'medium', 'low'].filter(
              (s) => s !== severity
            );
            for (const vuln of allFilteredVulns) {
              expect(otherSeverities).not.toContain(vuln.severity);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should show all vulnerabilities when severity is "all"', () => {
      fc.assert(
        fc.property(projectsArb, (projects) => {
          const filtered = filterVulnerabilities(projects, 'all', '');

          // Count total vulnerabilities in original
          let originalCount = 0;
          for (const project of projects) {
            for (const scanner of project.scanners) {
              originalCount += scanner.vulnerabilities.length;
            }
          }

          // Count total vulnerabilities in filtered
          let filteredCount = 0;
          for (const project of filtered) {
            for (const scanner of project.scanners) {
              filteredCount += scanner.vulnerabilities.length;
            }
          }

          // When filter is 'all', all vulnerabilities should be present
          expect(filteredCount).toBe(originalCount);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 11: Search Filter Correctness', () => {
    it('should only show vulnerabilities whose file path contains the search term', () => {
      fc.assert(
        fc.property(
          projectsArb,
          fc.string({ minLength: 1, maxLength: 10 }),
          (projects, searchTerm) => {
            const filtered = filterVulnerabilities(projects, 'all', searchTerm);

            // Collect all vulnerabilities from filtered result
            const allFilteredVulns: Vulnerability[] = [];
            for (const project of filtered) {
              for (const scanner of project.scanners) {
                allFilteredVulns.push(...scanner.vulnerabilities);
              }
            }

            // Every vulnerability must have the search term in its file path (case-insensitive)
            const normalizedSearch = searchTerm.toLowerCase().trim();
            for (const vuln of allFilteredVulns) {
              expect(vuln.filePath.toLowerCase()).toContain(normalizedSearch);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should show all vulnerabilities when search term is empty', () => {
      fc.assert(
        fc.property(projectsArb, (projects) => {
          const filtered = filterVulnerabilities(projects, 'all', '');

          // Count total vulnerabilities in original
          let originalCount = 0;
          for (const project of projects) {
            for (const scanner of project.scanners) {
              originalCount += scanner.vulnerabilities.length;
            }
          }

          // Count total vulnerabilities in filtered
          let filteredCount = 0;
          for (const project of filtered) {
            for (const scanner of project.scanners) {
              filteredCount += scanner.vulnerabilities.length;
            }
          }

          // When search is empty, all vulnerabilities should be present
          expect(filteredCount).toBe(originalCount);
        }),
        { numRuns: 10 }
      );
    });

    it('should be case-insensitive', () => {
      fc.assert(
        fc.property(
          projectsArb,
          fc.string({ minLength: 1, maxLength: 10 }),
          (projects, searchTerm) => {
            const lowerFiltered = filterVulnerabilities(projects, 'all', searchTerm.toLowerCase());
            const upperFiltered = filterVulnerabilities(projects, 'all', searchTerm.toUpperCase());

            // Count vulnerabilities in both results
            let lowerCount = 0;
            for (const project of lowerFiltered) {
              for (const scanner of project.scanners) {
                lowerCount += scanner.vulnerabilities.length;
              }
            }

            let upperCount = 0;
            for (const project of upperFiltered) {
              for (const scanner of project.scanners) {
                upperCount += scanner.vulnerabilities.length;
              }
            }

            // Case should not affect results
            expect(lowerCount).toBe(upperCount);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 12: Combined Filter Logic', () => {
    it('should apply both severity and search filters using AND logic', () => {
      fc.assert(
        fc.property(
          projectsArb,
          fc.constantFrom<SeverityFilter>('critical', 'high', 'medium', 'low'),
          fc.string({ minLength: 1, maxLength: 10 }),
          (projects, severity, searchTerm) => {
            const filtered = filterVulnerabilities(projects, severity, searchTerm);

            // Collect all vulnerabilities from filtered result
            const allFilteredVulns: Vulnerability[] = [];
            for (const project of filtered) {
              for (const scanner of project.scanners) {
                allFilteredVulns.push(...scanner.vulnerabilities);
              }
            }

            const normalizedSearch = searchTerm.toLowerCase().trim();

            // Every vulnerability must match BOTH filters
            for (const vuln of allFilteredVulns) {
              // Must match severity
              expect(vuln.severity).toBe(severity);
              // Must match search term
              expect(vuln.filePath.toLowerCase()).toContain(normalizedSearch);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should remove projects with no matching vulnerabilities', () => {
      fc.assert(
        fc.property(projectsArb, (projects) => {
          // Use a search term that won't match anything
          const filtered = filterVulnerabilities(projects, 'all', 'NONEXISTENT_FILE_PATH_XYZ123');

          // Every project in the result must have at least one vulnerability
          for (const project of filtered) {
            expect(project.scanners.length).toBeGreaterThan(0);
            let totalVulns = 0;
            for (const scanner of project.scanners) {
              totalVulns += scanner.vulnerabilities.length;
            }
            expect(totalVulns).toBeGreaterThan(0);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should remove scanner sections with no matching vulnerabilities', () => {
      fc.assert(
        fc.property(projectsArb, (projects) => {
          // Use a search term that won't match anything
          const filtered = filterVulnerabilities(projects, 'all', 'NONEXISTENT_FILE_PATH_XYZ123');

          // Every scanner section in the result must have at least one vulnerability
          for (const project of filtered) {
            for (const scanner of project.scanners) {
              expect(scanner.vulnerabilities.length).toBeGreaterThan(0);
              expect(scanner.totalCount).toBeGreaterThan(0);
            }
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should recalculate counts correctly after filtering', () => {
      fc.assert(
        fc.property(
          projectsArb,
          fc.constantFrom<SeverityFilter>('all', 'critical', 'high', 'medium', 'low'),
          fc.string({ minLength: 0, maxLength: 10 }),
          (projects, severity, searchTerm) => {
            const filtered = filterVulnerabilities(projects, severity, searchTerm);

            // Verify counts match actual vulnerability arrays
            for (const project of filtered) {
              let projectTotal = 0;
              for (const scanner of project.scanners) {
                // Scanner total count should match vulnerability array length
                expect(scanner.totalCount).toBe(scanner.vulnerabilities.length);

                // Severity breakdown should sum to total count
                const breakdownSum =
                  scanner.severityBreakdown.critical +
                  scanner.severityBreakdown.high +
                  scanner.severityBreakdown.medium +
                  scanner.severityBreakdown.low;
                expect(breakdownSum).toBe(scanner.totalCount);

                // Each severity count should match actual vulnerabilities
                expect(scanner.severityBreakdown.critical).toBe(
                  scanner.vulnerabilities.filter((v) => v.severity === 'critical').length
                );
                expect(scanner.severityBreakdown.high).toBe(
                  scanner.vulnerabilities.filter((v) => v.severity === 'high').length
                );
                expect(scanner.severityBreakdown.medium).toBe(
                  scanner.vulnerabilities.filter((v) => v.severity === 'medium').length
                );
                expect(scanner.severityBreakdown.low).toBe(
                  scanner.vulnerabilities.filter((v) => v.severity === 'low').length
                );

                projectTotal += scanner.totalCount;
              }

              // Project total should match sum of scanner totals
              expect(project.totalVulnerabilities).toBe(projectTotal);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
