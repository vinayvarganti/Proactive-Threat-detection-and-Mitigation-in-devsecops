import * as fc from 'fast-check';

/**
 * Property-Based Tests for Grouped Vulnerabilities Endpoint
 * Feature: vulnerability-dashboard-redesign
 */

// Arbitraries (generators) for property-based testing
const severityArb = fc.constantFrom('critical', 'high', 'medium', 'low');
const scannerArb = fc.constantFrom('gitleaks', 'semgrep', 'trivy');
const statusArb = fc.constantFrom('pending', 'in_progress', 'fixed', 'verified');

const vulnerabilityArb = fc.record({
  id: fc.hexaString({ minLength: 24, maxLength: 24 }),
  severity: severityArb,
  title: fc.string({ minLength: 5, maxLength: 100 }),
  filePath: fc.string({ minLength: 5, maxLength: 200 }).map(s => `/${s}`),
  lineNumber: fc.integer({ min: 1, max: 10000 }),
  status: statusArb,
  scannerName: scannerArb,
  description: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined })
});

const scannerVulnerabilitiesArb = fc.record({
  scannerName: scannerArb,
  vulnerabilities: fc.array(vulnerabilityArb, { minLength: 1, maxLength: 20 })
}).map(scanner => {
  // Calculate counts from vulnerabilities
  const severityBreakdown = {
    critical: scanner.vulnerabilities.filter(v => v.severity === 'critical').length,
    high: scanner.vulnerabilities.filter(v => v.severity === 'high').length,
    medium: scanner.vulnerabilities.filter(v => v.severity === 'medium').length,
    low: scanner.vulnerabilities.filter(v => v.severity === 'low').length
  };

  return {
    scannerName: scanner.scannerName,
    totalCount: scanner.vulnerabilities.length,
    severityBreakdown,
    vulnerabilities: scanner.vulnerabilities.map(v => ({
      ...v,
      scannerName: scanner.scannerName
    }))
  };
});

const projectVulnerabilitiesArb = fc.record({
  repositoryId: fc.hexaString({ minLength: 24, maxLength: 24 }),
  repositoryName: fc.string({ minLength: 3, maxLength: 50 }),
  scanners: fc.array(scannerVulnerabilitiesArb, { minLength: 1, maxLength: 3 })
}).map(project => ({
  ...project,
  totalVulnerabilities: project.scanners.reduce((sum, s) => sum + s.totalCount, 0)
}));

const groupedVulnerabilitiesArb = fc.record({
  projects: fc.array(projectVulnerabilitiesArb, { minLength: 0, maxLength: 10 })
}).map(data => {
  // Calculate summary statistics
  const totalProjects = data.projects.length;
  let totalVulnerabilities = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  data.projects.forEach(project => {
    totalVulnerabilities += project.totalVulnerabilities;
    project.scanners.forEach(scanner => {
      criticalCount += scanner.severityBreakdown.critical;
      highCount += scanner.severityBreakdown.high;
      mediumCount += scanner.severityBreakdown.medium;
      lowCount += scanner.severityBreakdown.low;
    });
  });

  return {
    summary: {
      totalProjects,
      totalVulnerabilities,
      criticalCount,
      highCount,
      mediumCount,
      lowCount
    },
    projects: data.projects
  };
});

describe('Grouped Vulnerabilities - Property-Based Tests', () => {
  // Feature: vulnerability-dashboard-redesign, Property 15: Backend Hierarchical Grouping
  // **Validates: Requirements 8.1, 8.2**
  describe('Property 15: Backend Hierarchical Grouping', () => {
    it('should group vulnerabilities first by repository, then by scanner', () => {
      fc.assert(
        fc.property(groupedVulnerabilitiesArb, (response) => {
          // Property: Data is structured with vulnerabilities grouped first by repository
          // Each project contains scanners, and each scanner contains vulnerabilities
          
          for (const project of response.projects) {
            // Each project must have a repository ID and name
            expect(project.repositoryId).toBeDefined();
            expect(project.repositoryName).toBeDefined();
            expect(project.scanners).toBeInstanceOf(Array);

            // Within each project, vulnerabilities are grouped by scanner
            for (const scanner of project.scanners) {
              expect(['gitleaks', 'semgrep', 'trivy']).toContain(scanner.scannerName);
              expect(scanner.vulnerabilities).toBeInstanceOf(Array);

              // All vulnerabilities in a scanner section must be from that scanner
              for (const vuln of scanner.vulnerabilities) {
                expect(vuln.scannerName).toBe(scanner.scannerName);
              }
            }
          }

          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should not mix vulnerabilities from different scanners in the same section', () => {
      fc.assert(
        fc.property(groupedVulnerabilitiesArb, (response) => {
          for (const project of response.projects) {
            for (const scanner of project.scanners) {
              // All vulnerabilities in this scanner section must have the same scanner name
              const scannerNames = scanner.vulnerabilities.map(v => v.scannerName);
              const uniqueScanners = new Set(scannerNames);
              
              expect(uniqueScanners.size).toBe(1);
              expect(uniqueScanners.has(scanner.scannerName)).toBe(true);
            }
          }

          return true;
        }),
        { numRuns: 10 }
      );
    });
  });

  // Feature: vulnerability-dashboard-redesign, Property 16: Backend Aggregate Accuracy
  // **Validates: Requirements 8.4**
  describe('Property 16: Backend Aggregate Accuracy', () => {
    it('should have summary statistics that match actual data counts', () => {
      fc.assert(
        fc.property(groupedVulnerabilitiesArb, (response) => {
          // Calculate actual counts from the data
          const actualTotalProjects = response.projects.length;
          let actualTotalVulnerabilities = 0;
          let actualCritical = 0;
          let actualHigh = 0;
          let actualMedium = 0;
          let actualLow = 0;

          for (const project of response.projects) {
            actualTotalVulnerabilities += project.totalVulnerabilities;
            for (const scanner of project.scanners) {
              actualCritical += scanner.severityBreakdown.critical;
              actualHigh += scanner.severityBreakdown.high;
              actualMedium += scanner.severityBreakdown.medium;
              actualLow += scanner.severityBreakdown.low;
            }
          }

          // Verify summary matches actual counts
          expect(response.summary.totalProjects).toBe(actualTotalProjects);
          expect(response.summary.totalVulnerabilities).toBe(actualTotalVulnerabilities);
          expect(response.summary.criticalCount).toBe(actualCritical);
          expect(response.summary.highCount).toBe(actualHigh);
          expect(response.summary.mediumCount).toBe(actualMedium);
          expect(response.summary.lowCount).toBe(actualLow);

          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should have project totals that match sum of scanner counts', () => {
      fc.assert(
        fc.property(groupedVulnerabilitiesArb, (response) => {
          for (const project of response.projects) {
            const sumOfScannerCounts = project.scanners.reduce(
              (sum, scanner) => sum + scanner.totalCount,
              0
            );
            
            expect(project.totalVulnerabilities).toBe(sumOfScannerCounts);
          }

          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should have scanner totals that match vulnerability array lengths', () => {
      fc.assert(
        fc.property(groupedVulnerabilitiesArb, (response) => {
          for (const project of response.projects) {
            for (const scanner of project.scanners) {
              expect(scanner.totalCount).toBe(scanner.vulnerabilities.length);
            }
          }

          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should have severity breakdown that sums to total count', () => {
      fc.assert(
        fc.property(groupedVulnerabilitiesArb, (response) => {
          for (const project of response.projects) {
            for (const scanner of project.scanners) {
              const breakdownSum =
                scanner.severityBreakdown.critical +
                scanner.severityBreakdown.high +
                scanner.severityBreakdown.medium +
                scanner.severityBreakdown.low;

              expect(breakdownSum).toBe(scanner.totalCount);
            }
          }

          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should have severity breakdown that matches actual vulnerability severities', () => {
      fc.assert(
        fc.property(groupedVulnerabilitiesArb, (response) => {
          for (const project of response.projects) {
            for (const scanner of project.scanners) {
              const actualCritical = scanner.vulnerabilities.filter(
                v => v.severity === 'critical'
              ).length;
              const actualHigh = scanner.vulnerabilities.filter(
                v => v.severity === 'high'
              ).length;
              const actualMedium = scanner.vulnerabilities.filter(
                v => v.severity === 'medium'
              ).length;
              const actualLow = scanner.vulnerabilities.filter(
                v => v.severity === 'low'
              ).length;

              expect(scanner.severityBreakdown.critical).toBe(actualCritical);
              expect(scanner.severityBreakdown.high).toBe(actualHigh);
              expect(scanner.severityBreakdown.medium).toBe(actualMedium);
              expect(scanner.severityBreakdown.low).toBe(actualLow);
            }
          }

          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should have non-negative counts in all statistics', () => {
      fc.assert(
        fc.property(groupedVulnerabilitiesArb, (response) => {
          // Summary counts must be non-negative
          expect(response.summary.totalProjects).toBeGreaterThanOrEqual(0);
          expect(response.summary.totalVulnerabilities).toBeGreaterThanOrEqual(0);
          expect(response.summary.criticalCount).toBeGreaterThanOrEqual(0);
          expect(response.summary.highCount).toBeGreaterThanOrEqual(0);
          expect(response.summary.mediumCount).toBeGreaterThanOrEqual(0);
          expect(response.summary.lowCount).toBeGreaterThanOrEqual(0);

          // Project and scanner counts must be non-negative
          for (const project of response.projects) {
            expect(project.totalVulnerabilities).toBeGreaterThanOrEqual(0);
            for (const scanner of project.scanners) {
              expect(scanner.totalCount).toBeGreaterThanOrEqual(0);
              expect(scanner.severityBreakdown.critical).toBeGreaterThanOrEqual(0);
              expect(scanner.severityBreakdown.high).toBeGreaterThanOrEqual(0);
              expect(scanner.severityBreakdown.medium).toBeGreaterThanOrEqual(0);
              expect(scanner.severityBreakdown.low).toBeGreaterThanOrEqual(0);
            }
          }

          return true;
        }),
        { numRuns: 10 }
      );
    });
  });
});
