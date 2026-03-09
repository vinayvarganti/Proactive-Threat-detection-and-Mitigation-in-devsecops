import { GroupedVulnerabilitiesResponse, ProjectVulnerabilities } from '../services/vulnerabilityService';

/**
 * Exports vulnerability data to JSON format
 * @param data - The complete grouped vulnerabilities response
 * @param filteredProjects - The currently filtered/visible projects
 */
export function exportToJSON(
  data: GroupedVulnerabilitiesResponse,
  filteredProjects: ProjectVulnerabilities[]
): void {
  // Create export data structure with filtered projects
  const exportData = {
    exportDate: new Date().toISOString(),
    summary: {
      totalProjects: filteredProjects.length,
      totalVulnerabilities: filteredProjects.reduce(
        (sum, project) => sum + project.totalVulnerabilities,
        0
      ),
      criticalCount: countSeverity(filteredProjects, 'critical'),
      highCount: countSeverity(filteredProjects, 'high'),
      mediumCount: countSeverity(filteredProjects, 'medium'),
      lowCount: countSeverity(filteredProjects, 'low'),
    },
    projects: filteredProjects,
  };

  // Convert to JSON string
  const jsonString = JSON.stringify(exportData, null, 2);

  // Create blob and download
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vulnerability-report-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper function to count vulnerabilities by severity
 */
function countSeverity(
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
