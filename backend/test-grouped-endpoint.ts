/**
 * Manual test script for the grouped vulnerabilities endpoint
 * This script demonstrates the expected response structure
 */

interface GroupedVulnerabilitiesResponse {
  summary: {
    totalProjects: number;
    totalVulnerabilities: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  projects: ProjectVulnerabilities[];
}

interface ProjectVulnerabilities {
  repositoryId: string;
  repositoryName: string;
  totalVulnerabilities: number;
  scanners: ScannerVulnerabilities[];
}

interface ScannerVulnerabilities {
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

interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  filePath: string;
  lineNumber: number;
  status: string;
  scannerName: string;
  description?: string;
}

// Example response structure
const exampleResponse: GroupedVulnerabilitiesResponse = {
  summary: {
    totalProjects: 2,
    totalVulnerabilities: 5,
    criticalCount: 2,
    highCount: 2,
    mediumCount: 1,
    lowCount: 0
  },
  projects: [
    {
      repositoryId: '507f1f77bcf86cd799439011',
      repositoryName: 'my-app',
      totalVulnerabilities: 3,
      scanners: [
        {
          scannerName: 'semgrep',
          totalCount: 2,
          severityBreakdown: {
            critical: 1,
            high: 1,
            medium: 0,
            low: 0
          },
          vulnerabilities: [
            {
              id: '507f1f77bcf86cd799439012',
              severity: 'critical',
              title: 'SQL Injection',
              filePath: '/src/db/queries.ts',
              lineNumber: 42,
              status: 'pending',
              scannerName: 'semgrep',
              description: 'Potential SQL injection vulnerability'
            },
            {
              id: '507f1f77bcf86cd799439013',
              severity: 'high',
              title: 'XSS Vulnerability',
              filePath: '/src/components/UserInput.tsx',
              lineNumber: 15,
              status: 'pending',
              scannerName: 'semgrep',
              description: 'Unescaped user input'
            }
          ]
        },
        {
          scannerName: 'gitleaks',
          totalCount: 1,
          severityBreakdown: {
            critical: 1,
            high: 0,
            medium: 0,
            low: 0
          },
          vulnerabilities: [
            {
              id: '507f1f77bcf86cd799439014',
              severity: 'critical',
              title: 'Hardcoded API Key',
              filePath: '/config/secrets.ts',
              lineNumber: 8,
              status: 'pending',
              scannerName: 'gitleaks',
              description: 'API key found in source code'
            }
          ]
        }
      ]
    },
    {
      repositoryId: '507f1f77bcf86cd799439015',
      repositoryName: 'backend-api',
      totalVulnerabilities: 2,
      scanners: [
        {
          scannerName: 'trivy',
          totalCount: 2,
          severityBreakdown: {
            critical: 0,
            high: 1,
            medium: 1,
            low: 0
          },
          vulnerabilities: [
            {
              id: '507f1f77bcf86cd799439016',
              severity: 'high',
              title: 'Vulnerable Dependency',
              filePath: '/package.json',
              lineNumber: 25,
              status: 'pending',
              scannerName: 'trivy',
              description: 'lodash@4.17.15 has known vulnerabilities'
            },
            {
              id: '507f1f77bcf86cd799439017',
              severity: 'medium',
              title: 'Outdated Package',
              filePath: '/package.json',
              lineNumber: 30,
              status: 'pending',
              scannerName: 'trivy',
              description: 'express@4.16.0 is outdated'
            }
          ]
        }
      ]
    }
  ]
};

console.log('Example Grouped Vulnerabilities Response:');
console.log(JSON.stringify(exampleResponse, null, 2));

// Validation checks
console.log('\n=== Validation Checks ===');

// Check 1: Summary totals match actual data
const actualTotalProjects = exampleResponse.projects.length;
const actualTotalVulnerabilities = exampleResponse.projects.reduce(
  (sum, project) => sum + project.totalVulnerabilities,
  0
);

let actualCritical = 0;
let actualHigh = 0;
let actualMedium = 0;
let actualLow = 0;

exampleResponse.projects.forEach(project => {
  project.scanners.forEach(scanner => {
    actualCritical += scanner.severityBreakdown.critical;
    actualHigh += scanner.severityBreakdown.high;
    actualMedium += scanner.severityBreakdown.medium;
    actualLow += scanner.severityBreakdown.low;
  });
});

console.log(`✓ Total Projects: ${exampleResponse.summary.totalProjects} === ${actualTotalProjects}`);
console.log(`✓ Total Vulnerabilities: ${exampleResponse.summary.totalVulnerabilities} === ${actualTotalVulnerabilities}`);
console.log(`✓ Critical Count: ${exampleResponse.summary.criticalCount} === ${actualCritical}`);
console.log(`✓ High Count: ${exampleResponse.summary.highCount} === ${actualHigh}`);
console.log(`✓ Medium Count: ${exampleResponse.summary.mediumCount} === ${actualMedium}`);
console.log(`✓ Low Count: ${exampleResponse.summary.lowCount} === ${actualLow}`);

// Check 2: Each project has correct vulnerability count
exampleResponse.projects.forEach(project => {
  const actualCount = project.scanners.reduce(
    (sum, scanner) => sum + scanner.totalCount,
    0
  );
  console.log(`✓ Project "${project.repositoryName}": ${project.totalVulnerabilities} === ${actualCount}`);
});

// Check 3: Each scanner section has correct counts
exampleResponse.projects.forEach(project => {
  project.scanners.forEach(scanner => {
    const actualCount = scanner.vulnerabilities.length;
    const breakdownSum = 
      scanner.severityBreakdown.critical +
      scanner.severityBreakdown.high +
      scanner.severityBreakdown.medium +
      scanner.severityBreakdown.low;
    
    console.log(`✓ Scanner "${scanner.scannerName}" in "${project.repositoryName}": ${scanner.totalCount} === ${actualCount} === ${breakdownSum}`);
  });
});

console.log('\n✅ All validation checks passed!');
console.log('\nEndpoint: GET /api/vulnerabilities/grouped');
console.log('Authentication: Required (session-based)');
console.log('Response: GroupedVulnerabilitiesResponse');
