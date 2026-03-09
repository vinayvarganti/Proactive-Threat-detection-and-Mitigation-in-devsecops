export interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  filePath: string;
  lineNumber: number;
  status: string;
  scannerName: string;
  description?: string;
}

export interface ScannerVulnerabilities {
  scannerName: 'gitleaks' | 'semgrep' | 'trivy';
  totalCount: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  vulnerabilities: Vulnerability[];
}

export interface ProjectVulnerabilities {
  repositoryId: string;
  repositoryName: string;
  totalVulnerabilities: number;
  scanners: ScannerVulnerabilities[];
}

export type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

/**
 * Filters vulnerabilities based on severity and search term
 * Removes projects with no matching vulnerabilities
 * Removes scanner sections with no matching vulnerabilities
 * 
 * @param projects - Array of projects with vulnerabilities
 * @param severity - Severity filter ('all' or specific severity)
 * @param searchTerm - File path search term (case-insensitive)
 * @returns Filtered array of projects
 */
export function filterVulnerabilities(
  projects: ProjectVulnerabilities[],
  severity: SeverityFilter,
  searchTerm: string
): ProjectVulnerabilities[] {
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();

  return projects
    .map((project) => {
      // Filter scanners within the project
      const filteredScanners = project.scanners
        .map((scanner) => {
          // Filter vulnerabilities within the scanner
          const filteredVulns = scanner.vulnerabilities.filter((vuln) => {
            // Apply severity filter
            const matchesSeverity =
              severity === 'all' || vuln.severity === severity;

            // Apply search filter
            const matchesSearch =
              normalizedSearchTerm === '' ||
              vuln.filePath.toLowerCase().includes(normalizedSearchTerm);

            // Both filters must match (AND logic)
            return matchesSeverity && matchesSearch;
          });

          // Recalculate counts and severity breakdown for filtered vulnerabilities
          if (filteredVulns.length === 0) {
            return null; // Remove scanner if no vulnerabilities match
          }

          const severityBreakdown = {
            critical: filteredVulns.filter((v) => v.severity === 'critical').length,
            high: filteredVulns.filter((v) => v.severity === 'high').length,
            medium: filteredVulns.filter((v) => v.severity === 'medium').length,
            low: filteredVulns.filter((v) => v.severity === 'low').length,
          };

          return {
            ...scanner,
            vulnerabilities: filteredVulns,
            totalCount: filteredVulns.length,
            severityBreakdown,
          };
        })
        .filter((scanner): scanner is ScannerVulnerabilities => scanner !== null);

      // Remove project if no scanners have matching vulnerabilities
      if (filteredScanners.length === 0) {
        return null;
      }

      // Recalculate total vulnerabilities for the project
      const totalVulnerabilities = filteredScanners.reduce(
        (sum, scanner) => sum + scanner.totalCount,
        0
      );

      return {
        ...project,
        scanners: filteredScanners,
        totalVulnerabilities,
      };
    })
    .filter((project): project is ProjectVulnerabilities => project !== null);
}
