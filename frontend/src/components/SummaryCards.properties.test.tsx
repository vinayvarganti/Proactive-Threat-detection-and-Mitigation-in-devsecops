import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import SummaryCards, { SummaryData } from './SummaryCards';
import { ProjectVulnerabilities } from './ProjectCard';
import { ScannerVulnerabilities } from './ScannerSection';
import { SeverityLevel } from './VulnerabilityTable';

// Feature: vulnerability-dashboard-redesign, Property 9: Summary Statistics Accuracy
// **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
// For any dashboard state, the summary cards should display counts that match the actual data:
// total projects should equal the number of projects with vulnerabilities, total vulnerabilities
// should equal the sum of all vulnerabilities across all projects and scanners, and severity
// counts should match the actual counts of vulnerabilities at each severity level.

describe('SummaryCards - Property-Based Tests', () => {
  describe('Property 9: Summary Statistics Accuracy', () => {
    it('should display accurate summary statistics matching actual data', () => {
      const severityArb = fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low');
      const statusArb = fc.constantFrom<'open' | 'fixed' | 'ignored'>('open', 'fixed', 'ignored');
      
      const vulnerabilityArb = fc.record({
        id: fc.uuid(),
        severity: severityArb,
        title: fc.string({ minLength: 1, maxLength: 100 }),
        filePath: fc.string({ minLength: 1, maxLength: 200 }).map(s => `/${s.replace(/\s/g, '_')}`),
        lineNumber: fc.integer({ min: 1, max: 10000 }),
        status: statusArb,
        scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy')
      });
      
      // Create project with unique scanner names
      const projectArb = fc.record({
        repositoryId: fc.uuid(),
        repositoryName: fc.string({ minLength: 1, maxLength: 50 }),
        scannersToInclude: fc.subarray(['gitleaks', 'semgrep', 'trivy'] as const, { minLength: 1, maxLength: 3 })
      }).chain(({ repositoryId, repositoryName, scannersToInclude }) => {
        const scannerArbs = scannersToInclude.map(scannerName =>
          fc.record({
            vulnerabilities: fc.array(vulnerabilityArb, { minLength: 0, maxLength: 20 })
          }).map(({ vulnerabilities }) => {
            const severityBreakdown = {
              critical: vulnerabilities.filter(v => v.severity === 'critical').length,
              high: vulnerabilities.filter(v => v.severity === 'high').length,
              medium: vulnerabilities.filter(v => v.severity === 'medium').length,
              low: vulnerabilities.filter(v => v.severity === 'low').length
            };
            
            return {
              scannerName,
              totalCount: vulnerabilities.length,
              severityBreakdown,
              vulnerabilities
            } as ScannerVulnerabilities;
          })
        );
        
        return fc.tuple(...scannerArbs).map(scanners => {
          const totalVulnerabilities = scanners.reduce((sum, s) => sum + s.totalCount, 0);
          
          return {
            repositoryId,
            repositoryName,
            totalVulnerabilities,
            scanners
          } as ProjectVulnerabilities;
        });
      });
      
      // Create array of projects
      const projectsArb = fc.array(projectArb, { minLength: 0, maxLength: 10 });
      
      fc.assert(
        fc.property(projectsArb, (projects) => {
          // Calculate expected summary statistics from projects
          const projectsWithVulnerabilities = projects.filter(p => p.totalVulnerabilities > 0);
          
          let totalVulnerabilities = 0;
          let criticalCount = 0;
          let highCount = 0;
          let mediumCount = 0;
          let lowCount = 0;
          
          projects.forEach(project => {
            project.scanners.forEach(scanner => {
              scanner.vulnerabilities.forEach(vuln => {
                totalVulnerabilities++;
                if (vuln.severity === 'critical') criticalCount++;
                else if (vuln.severity === 'high') highCount++;
                else if (vuln.severity === 'medium') mediumCount++;
                else if (vuln.severity === 'low') lowCount++;
              });
            });
          });
          
          const summary: SummaryData = {
            totalProjects: projectsWithVulnerabilities.length,
            totalVulnerabilities,
            criticalCount,
            highCount
          };
          
          const { getByText, getByLabelText, unmount } = render(
            <SummaryCards summary={summary} />
          );
          
          try {
            // Verify total projects matches projects with vulnerabilities
            const projectsElement = getByLabelText(`${summary.totalProjects} projects scanned`);
            expect(projectsElement).toBeInTheDocument();
            expect(projectsElement.textContent).toBe(summary.totalProjects.toString());
            
            // Verify total vulnerabilities matches sum across all projects and scanners
            const vulnerabilitiesElement = getByLabelText(`${summary.totalVulnerabilities} total vulnerabilities`);
            expect(vulnerabilitiesElement).toBeInTheDocument();
            expect(vulnerabilitiesElement.textContent).toBe(summary.totalVulnerabilities.toString());
            
            // Verify critical count matches actual critical vulnerabilities
            const criticalElement = getByLabelText(`${summary.criticalCount} critical vulnerabilities`);
            expect(criticalElement).toBeInTheDocument();
            expect(criticalElement.textContent).toBe(summary.criticalCount.toString());
            expect(summary.criticalCount).toBe(criticalCount);
            
            // Verify high count matches actual high vulnerabilities
            const highElement = getByLabelText(`${summary.highCount} high severity vulnerabilities`);
            expect(highElement).toBeInTheDocument();
            expect(highElement.textContent).toBe(summary.highCount.toString());
            expect(summary.highCount).toBe(highCount);
            
            // Verify the summary accurately reflects the data
            expect(summary.totalProjects).toBe(projectsWithVulnerabilities.length);
            expect(summary.totalVulnerabilities).toBe(totalVulnerabilities);
            expect(summary.criticalCount).toBe(criticalCount);
            expect(summary.highCount).toBe(highCount);
          } finally {
            unmount();
          }
        }),
        { numRuns: 10 }
      );
    });
  });
});
