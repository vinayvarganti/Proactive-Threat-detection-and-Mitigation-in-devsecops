import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import ProjectCard, { ProjectVulnerabilities } from './ProjectCard';
import { ScannerVulnerabilities } from './ScannerSection';
import { SeverityLevel } from './VulnerabilityTable';

// Feature: vulnerability-dashboard-redesign, Property 3: Scanner Section Presence
// **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
// For any project and scanner combination, a scanner section should be displayed 
// if and only if that scanner detected at least one vulnerability for that project.

describe('ProjectCard - Property-Based Tests', () => {
  describe('Property 3: Scanner Section Presence', () => {
    it('should display scanner sections only for scanners with vulnerabilities', () => {
      const severityArb = fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low');
      const statusArb = fc.constantFrom<'open' | 'fixed' | 'ignored'>('open', 'fixed', 'ignored');
      const scannerNameArb = fc.constantFrom<'gitleaks' | 'semgrep' | 'trivy'>('gitleaks', 'semgrep', 'trivy');
      
      const vulnerabilityArb = fc.record({
        id: fc.uuid(),
        severity: severityArb,
        title: fc.string({ minLength: 1, maxLength: 100 }),
        filePath: fc.string({ minLength: 1, maxLength: 200 }).map(s => `/${s.replace(/\s/g, '_')}`),
        lineNumber: fc.integer({ min: 1, max: 10000 }),
        status: statusArb,
        scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy')
      });
      
      // Create scanner with random number of vulnerabilities (0 to 20)
      const scannerArb = fc.record({
        scannerName: scannerNameArb,
        vulnerabilities: fc.array(vulnerabilityArb, { minLength: 0, maxLength: 20 })
      }).map(({ scannerName, vulnerabilities }) => {
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
      });
      
      // Create project with multiple scanners (some may have 0 vulnerabilities)
      // Ensure unique scanner names by using a subset of available scanners
      const projectArb = fc.record({
        repositoryId: fc.uuid(),
        repositoryName: fc.string({ minLength: 1, maxLength: 50 }),
        scannersToInclude: fc.subarray(['gitleaks', 'semgrep', 'trivy'] as const, { minLength: 1, maxLength: 3 })
      }).chain(({ repositoryId, repositoryName, scannersToInclude }) => {
        // Generate one scanner for each unique scanner name
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
      
      fc.assert(
        fc.property(projectArb, (project) => {
          const { container, unmount } = render(
            <ProjectCard
              project={project}
              collapsedSections={new Set()}
              onToggleSection={() => {}}
            />
          );
          
          try {
            // For each scanner in the project
            project.scanners.forEach(scanner => {
              const sectionId = `${project.repositoryId}-${scanner.scannerName}`;
              const sectionElement = container.querySelector(`[data-testid="scanner-section-${sectionId}"]`);
              
              // Scanner section should be present if and only if it has vulnerabilities
              if (scanner.vulnerabilities.length > 0) {
                expect(sectionElement).toBeInTheDocument();
              } else {
                expect(sectionElement).not.toBeInTheDocument();
              }
            });
            
            // Count visible scanner sections
            const visibleSections = container.querySelectorAll('.scanner-section');
            const scannersWithVulnerabilities = project.scanners.filter(s => s.vulnerabilities.length > 0);
            expect(visibleSections.length).toBe(scannersWithVulnerabilities.length);
          } finally {
            unmount();
          }
        }),
        { numRuns: 10 }
      );
    });
  });

  // Feature: vulnerability-dashboard-redesign, Property 4: Scanner Section Structure
  // **Validates: Requirements 2.1**
  // For any project with vulnerabilities, the project card should contain separate 
  // sections for each scanner that detected vulnerabilities.
  
  describe('Property 4: Scanner Section Structure', () => {
    it('should contain separate sections for each scanner with vulnerabilities', () => {
      const severityArb = fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low');
      const statusArb = fc.constantFrom<'open' | 'fixed' | 'ignored'>('open', 'fixed', 'ignored');
      const scannerNameArb = fc.constantFrom<'gitleaks' | 'semgrep' | 'trivy'>('gitleaks', 'semgrep', 'trivy');
      
      const vulnerabilityArb = fc.record({
        id: fc.uuid(),
        severity: severityArb,
        title: fc.string({ minLength: 1, maxLength: 100 }),
        filePath: fc.string({ minLength: 1, maxLength: 200 }).map(s => `/${s.replace(/\s/g, '_')}`),
        lineNumber: fc.integer({ min: 1, max: 10000 }),
        status: statusArb,
        scannerName: fc.constantFrom('gitleaks', 'semgrep', 'trivy')
      });
      
      // Ensure at least 1 vulnerability per scanner
      const scannerArb = fc.record({
        scannerName: scannerNameArb,
        vulnerabilities: fc.array(vulnerabilityArb, { minLength: 1, maxLength: 15 })
      }).map(({ scannerName, vulnerabilities }) => {
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
      });
      
      // Create project with at least 1 scanner with vulnerabilities
      // Ensure unique scanner names by using a subset of available scanners
      const projectArb = fc.record({
        repositoryId: fc.uuid(),
        repositoryName: fc.string({ minLength: 1, maxLength: 50 }),
        scannersToInclude: fc.subarray(['gitleaks', 'semgrep', 'trivy'] as const, { minLength: 1, maxLength: 3 })
      }).chain(({ repositoryId, repositoryName, scannersToInclude }) => {
        // Generate one scanner for each unique scanner name, all with at least 1 vulnerability
        const scannerArbs = scannersToInclude.map(scannerName =>
          fc.record({
            vulnerabilities: fc.array(vulnerabilityArb, { minLength: 1, maxLength: 15 })
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
      
      fc.assert(
        fc.property(projectArb, (project) => {
          const { container, unmount } = render(
            <ProjectCard
              project={project}
              collapsedSections={new Set()}
              onToggleSection={() => {}}
            />
          );
          
          try {
            // Get all scanner sections
            const scannerSections = container.querySelectorAll('.scanner-section');
            
            // Should have one section per scanner with vulnerabilities
            const scannersWithVulnerabilities = project.scanners.filter(s => s.vulnerabilities.length > 0);
            expect(scannerSections.length).toBe(scannersWithVulnerabilities.length);
            
            // Each scanner with vulnerabilities should have its own distinct section
            scannersWithVulnerabilities.forEach(scanner => {
              const sectionId = `${project.repositoryId}-${scanner.scannerName}`;
              const sectionElement = container.querySelector(`[data-testid="scanner-section-${sectionId}"]`);
              
              expect(sectionElement).toBeInTheDocument();
              
              // Verify section contains scanner name
              const scannerDisplayName = scanner.scannerName.charAt(0).toUpperCase() + 
                                        scanner.scannerName.slice(1);
              expect(sectionElement?.textContent).toContain(scannerDisplayName);
            });
            
            // Verify sections are separate (each has unique data-testid)
            const sectionIds = Array.from(scannerSections).map(section => 
              section.getAttribute('data-testid')
            );
            const uniqueIds = new Set(sectionIds);
            expect(uniqueIds.size).toBe(scannerSections.length);
          } finally {
            unmount();
          }
        }),
        { numRuns: 10 }
      );
    });
  });
});
