import * as fc from 'fast-check';
import { exportToJSON } from './exportData';
import { GroupedVulnerabilitiesResponse, ProjectVulnerabilities, Vulnerability } from '../services/vulnerabilityService';

// Feature: vulnerability-dashboard-redesign, Property 14: Export Data Completeness
// For any dashboard state with active filters, the exported JSON should contain exactly the vulnerabilities that are currently visible in the UI.
// Validates: Requirements 7.2, 7.3

describe('Export Data Properties', () => {
  let createElementSpy: jest.SpyInstance;
  let appendChildSpy: jest.SpyInstance;
  let removeChildSpy: jest.SpyInstance;
  let clickSpy: jest.Mock;
  let blobSpy: jest.SpyInstance;
  let capturedBlobData: string | null = null;

  beforeEach(() => {
    // Mock Blob to capture data
    capturedBlobData = null;
    blobSpy = jest.spyOn(global, 'Blob').mockImplementation((content: any[], options?: any) => {
      capturedBlobData = content[0];
      return {
        size: content[0].length,
        type: options?.type || '',
      } as Blob;
    });

    // Mock DOM methods
    clickSpy = jest.fn();
    createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue({
      click: clickSpy,
      href: '',
      download: '',
    } as any);
    appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
    
    // Mock URL methods
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Property 14: exported data contains exactly the filtered vulnerabilities', () => {
    fc.assert(
      fc.property(
        // Generate random vulnerability data with consistent counts
        fc.array(
          fc
            .record({
              repositoryId: fc.string({ minLength: 1, maxLength: 20 }),
              repositoryName: fc.string({ minLength: 1, maxLength: 50 }),
              scanners: fc.array(
                fc
                  .record({
                    scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
                    vulnerabilities: fc.array(
                      fc.record({
                        id: fc.uuid(),
                        severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
                        title: fc.string({ minLength: 5, maxLength: 100 }),
                        filePath: fc.string({ minLength: 5, maxLength: 100 }),
                        lineNumber: fc.nat({ max: 10000 }),
                        status: fc.constantFrom('open', 'fixed', 'ignored'),
                        scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy'),
                      }) as fc.Arbitrary<Vulnerability>,
                      { minLength: 0, maxLength: 20 }
                    ),
                  })
                  .map((scanner) => ({
                    scannerName: scanner.scannerName,
                    totalCount: scanner.vulnerabilities.length,
                    severityBreakdown: {
                      critical: scanner.vulnerabilities.filter((v) => v.severity === 'critical').length,
                      high: scanner.vulnerabilities.filter((v) => v.severity === 'high').length,
                      medium: scanner.vulnerabilities.filter((v) => v.severity === 'medium').length,
                      low: scanner.vulnerabilities.filter((v) => v.severity === 'low').length,
                    },
                    vulnerabilities: scanner.vulnerabilities,
                  })),
                { minLength: 1, maxLength: 3 }
              ),
            })
            .map((project) => ({
              repositoryId: project.repositoryId,
              repositoryName: project.repositoryName,
              totalVulnerabilities: project.scanners.reduce((sum, s) => sum + s.totalCount, 0),
              scanners: project.scanners,
            })) as fc.Arbitrary<ProjectVulnerabilities>,
          { minLength: 1, maxLength: 10 }
        ),
        (filteredProjects) => {
          // Reset captured data
          capturedBlobData = null;

          // Calculate expected summary from filtered projects
          const expectedTotalProjects = filteredProjects.length;
          const expectedTotalVulns = filteredProjects.reduce(
            (sum, p) => sum + p.scanners.reduce((s, sc) => s + sc.vulnerabilities.length, 0),
            0
          );
          const expectedCritical = countSeverityInProjects(filteredProjects, 'critical');
          const expectedHigh = countSeverityInProjects(filteredProjects, 'high');
          const expectedMedium = countSeverityInProjects(filteredProjects, 'medium');
          const expectedLow = countSeverityInProjects(filteredProjects, 'low');

          // Create mock full data (not used in export, but required by function signature)
          const fullData: GroupedVulnerabilitiesResponse = {
            summary: {
              totalProjects: expectedTotalProjects,
              totalVulnerabilities: expectedTotalVulns,
              criticalCount: expectedCritical,
              highCount: expectedHigh,
              mediumCount: expectedMedium,
              lowCount: expectedLow,
            },
            projects: filteredProjects,
          };

          // Call export function
          exportToJSON(fullData, filteredProjects);

          // Verify Blob was created with correct data
          if (capturedBlobData) {
            const blobData = JSON.parse(capturedBlobData);
            
            // Property: exported data contains exactly the filtered projects
            expect(blobData.projects).toEqual(filteredProjects);
            expect(blobData.projects.length).toBe(expectedTotalProjects);
            
            // Property: exported summary matches filtered data
            expect(blobData.summary.totalProjects).toBe(expectedTotalProjects);
            expect(blobData.summary.totalVulnerabilities).toBe(expectedTotalVulns);
            expect(blobData.summary.criticalCount).toBe(expectedCritical);
            expect(blobData.summary.highCount).toBe(expectedHigh);
            expect(blobData.summary.mediumCount).toBe(expectedMedium);
            expect(blobData.summary.lowCount).toBe(expectedLow);
            
            // Property: all vulnerabilities in export are from filtered projects
            const exportedVulnCount = blobData.projects.reduce(
              (sum: number, p: ProjectVulnerabilities) =>
                sum + p.scanners.reduce((s: number, sc: any) => s + sc.vulnerabilities.length, 0),
              0
            );
            expect(exportedVulnCount).toBe(expectedTotalVulns);
          }

          // Verify download was triggered
          expect(createElementSpy).toHaveBeenCalledWith('a');
          expect(clickSpy).toHaveBeenCalled();
        }
      ),
      { numRuns: 10 }
    );
  });
});

// Helper function to count vulnerabilities by severity
function countSeverityInProjects(
  projects: ProjectVulnerabilities[],
  severity: 'critical' | 'high' | 'medium' | 'low'
): number {
  return projects.reduce((total, project) => {
    return (
      total +
      project.scanners.reduce((scannerTotal, scanner) => {
        return (
          scannerTotal +
          scanner.vulnerabilities.filter((v) => v.severity === severity).length
        );
      }, 0)
    );
  }, 0);
}
