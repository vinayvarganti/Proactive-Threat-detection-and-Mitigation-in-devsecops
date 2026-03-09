import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import ScannerSection, { ScannerVulnerabilities } from './ScannerSection';
import { SeverityLevel } from './VulnerabilityTable';

// Feature: vulnerability-dashboard-redesign, Property 5: Vulnerability Count Accuracy
// **Validates: Requirements 3.1**
// For any scanner section, the displayed total count should equal the actual number 
// of vulnerabilities in that section's table.

describe('ScannerSection - Property-Based Tests', () => {
  describe('Property 5: Vulnerability Count Accuracy', () => {
    it('should display total count matching actual vulnerability count', () => {
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
      
      const vulnerabilitiesArb = fc.array(vulnerabilityArb, { minLength: 0, maxLength: 50 });
      
      const scannerArb = fc.record({
        scannerName: scannerNameArb,
        vulnerabilities: vulnerabilitiesArb
      }).map(({ scannerName, vulnerabilities }) => {
        // Calculate severity breakdown from vulnerabilities
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
      
      fc.assert(
        fc.property(scannerArb, fc.string({ minLength: 1, maxLength: 50 }), (scanner, repoId) => {
          const { container, getByText, unmount } = render(
            <ScannerSection
              scanner={scanner}
              repositoryId={repoId}
              isCollapsed={false}
              onToggle={() => {}}
            />
          );
          
          try {
            // Check that displayed total count matches actual vulnerability count
            const totalCountText = getByText(`Total: ${scanner.totalCount}`);
            expect(totalCountText).toBeInTheDocument();
            
            // Verify the count matches the actual number of vulnerabilities
            expect(scanner.totalCount).toBe(scanner.vulnerabilities.length);
            
            // When expanded, verify all vulnerabilities are rendered in the table
            if (scanner.vulnerabilities.length > 0) {
              const tableRows = container.querySelectorAll('.vulnerability-table tbody tr');
              // Subtract 1 if there's a "no vulnerabilities" row, otherwise count should match
              const actualRowCount = tableRows.length;
              if (scanner.vulnerabilities.length === 0) {
                expect(actualRowCount).toBe(1); // "No vulnerabilities found" row
              } else {
                expect(actualRowCount).toBe(scanner.vulnerabilities.length);
              }
            }
          } finally {
            unmount();
          }
        }),
        { numRuns: 10 }
      );
    });
  });

  // Feature: vulnerability-dashboard-redesign, Property 6: Severity Breakdown Accuracy
  // **Validates: Requirements 3.2**
  // For any scanner section, the sum of severity breakdown counts (Critical + High + Medium + Low) 
  // should equal the total vulnerability count, and each severity count should match the actual 
  // number of vulnerabilities with that severity.
  
  describe('Property 6: Severity Breakdown Accuracy', () => {
    it('should display accurate severity breakdown that sums to total count', () => {
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
      
      const vulnerabilitiesArb = fc.array(vulnerabilityArb, { minLength: 0, maxLength: 50 });
      
      const scannerArb = fc.record({
        scannerName: scannerNameArb,
        vulnerabilities: vulnerabilitiesArb
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
      
      fc.assert(
        fc.property(scannerArb, fc.string({ minLength: 1, maxLength: 50 }), (scanner, repoId) => {
          const { getByText, queryByText, unmount } = render(
            <ScannerSection
              scanner={scanner}
              repositoryId={repoId}
              isCollapsed={false}
              onToggle={() => {}}
            />
          );
          
          try {
            // Verify sum of severity breakdown equals total count
            const sum = scanner.severityBreakdown.critical + 
                       scanner.severityBreakdown.high + 
                       scanner.severityBreakdown.medium + 
                       scanner.severityBreakdown.low;
            expect(sum).toBe(scanner.totalCount);
            
            // Verify each severity count matches actual vulnerabilities
            const actualCritical = scanner.vulnerabilities.filter(v => v.severity === 'critical').length;
            const actualHigh = scanner.vulnerabilities.filter(v => v.severity === 'high').length;
            const actualMedium = scanner.vulnerabilities.filter(v => v.severity === 'medium').length;
            const actualLow = scanner.vulnerabilities.filter(v => v.severity === 'low').length;
            
            expect(scanner.severityBreakdown.critical).toBe(actualCritical);
            expect(scanner.severityBreakdown.high).toBe(actualHigh);
            expect(scanner.severityBreakdown.medium).toBe(actualMedium);
            expect(scanner.severityBreakdown.low).toBe(actualLow);
            
            // Verify displayed counts match (only non-zero counts are displayed)
            if (scanner.severityBreakdown.critical > 0) {
              expect(getByText(`Critical: ${scanner.severityBreakdown.critical}`)).toBeInTheDocument();
            } else {
              expect(queryByText(/Critical:/)).not.toBeInTheDocument();
            }
            
            if (scanner.severityBreakdown.high > 0) {
              expect(getByText(`High: ${scanner.severityBreakdown.high}`)).toBeInTheDocument();
            } else {
              expect(queryByText(/High:/)).not.toBeInTheDocument();
            }
            
            if (scanner.severityBreakdown.medium > 0) {
              expect(getByText(`Medium: ${scanner.severityBreakdown.medium}`)).toBeInTheDocument();
            } else {
              expect(queryByText(/Medium:/)).not.toBeInTheDocument();
            }
            
            if (scanner.severityBreakdown.low > 0) {
              expect(getByText(`Low: ${scanner.severityBreakdown.low}`)).toBeInTheDocument();
            } else {
              expect(queryByText(/Low:/)).not.toBeInTheDocument();
            }
          } finally {
            unmount();
          }
        }),
        { numRuns: 10 }
      );
    });
  });

  // Feature: vulnerability-dashboard-redesign, Property 8: Collapse State Consistency
  // **Validates: Requirements 3.4, 3.5**
  // For any scanner section, toggling the collapse state should change the visibility of 
  // the vulnerability table while maintaining the visibility of the section header and counts.
  
  describe('Property 8: Collapse State Consistency', () => {
    it('should maintain header visibility and toggle table visibility based on collapse state', () => {
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
      
      // Use at least 1 vulnerability to test table visibility
      const vulnerabilitiesArb = fc.array(vulnerabilityArb, { minLength: 1, maxLength: 20 });
      
      const scannerArb = fc.record({
        scannerName: scannerNameArb,
        vulnerabilities: vulnerabilitiesArb
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
      
      const isCollapsedArb = fc.boolean();
      
      fc.assert(
        fc.property(
          scannerArb, 
          fc.string({ minLength: 1, maxLength: 50 }), 
          isCollapsedArb,
          (scanner, repoId, isCollapsed) => {
            const { container, getByText, queryByText, unmount } = render(
              <ScannerSection
                scanner={scanner}
                repositoryId={repoId}
                isCollapsed={isCollapsed}
                onToggle={() => {}}
              />
            );
            
            try {
              // Header elements should ALWAYS be visible regardless of collapse state
              const scannerDisplayName = scanner.scannerName.charAt(0).toUpperCase() + 
                                        scanner.scannerName.slice(1);
              expect(getByText(scannerDisplayName)).toBeInTheDocument();
              expect(getByText(`Total: ${scanner.totalCount}`)).toBeInTheDocument();
              
              // At least one severity count should be visible (since we have vulnerabilities)
              const hasSeverityCounts = scanner.severityBreakdown.critical > 0 ||
                                       scanner.severityBreakdown.high > 0 ||
                                       scanner.severityBreakdown.medium > 0 ||
                                       scanner.severityBreakdown.low > 0;
              expect(hasSeverityCounts).toBe(true);
              
              // Table visibility should depend on collapse state
              const contentDiv = container.querySelector('.scanner-section-content');
              
              if (isCollapsed) {
                // When collapsed, content div should not exist
                expect(contentDiv).not.toBeInTheDocument();
                
                // Vulnerability titles should not be visible
                scanner.vulnerabilities.forEach(vuln => {
                  expect(queryByText(vuln.title)).not.toBeInTheDocument();
                });
              } else {
                // When expanded, content div should exist
                expect(contentDiv).toBeInTheDocument();
                
                // Table should be present
                const table = container.querySelector('.vulnerability-table');
                expect(table).toBeInTheDocument();
              }
              
              // Verify aria-expanded attribute matches collapse state
              const headerButton = container.querySelector('button.scanner-section-header');
              expect(headerButton).toHaveAttribute('aria-expanded', (!isCollapsed).toString());
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
