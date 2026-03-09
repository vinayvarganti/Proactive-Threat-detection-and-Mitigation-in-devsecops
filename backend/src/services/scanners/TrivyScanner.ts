import { exec } from 'child_process';
import { promisify } from 'util';
import { ScanResult, RawVulnerability } from '../../types/scanner.types';

const execAsync = promisify(exec);

export class TrivyScanner {
  private readonly timeout: number;

  constructor(timeout: number = 300000) { // 5 minutes default
    this.timeout = timeout;
  }

  /**
   * Scan a repository for dependency vulnerabilities using Trivy
   */
  async scan(repositoryPath: string): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      // Run Trivy filesystem scan with JSON output
      const trivyPath = process.env.TRIVY_PATH || 'trivy';
      const command = `"${trivyPath}" fs --format json --scanners vuln "${repositoryPath}"`;
      
      const { stdout } = await execAsync(command, {
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      // Parse Trivy JSON output
      const output = JSON.parse(stdout);
      const vulnerabilities: RawVulnerability[] = [];

      if (output.Results && Array.isArray(output.Results)) {
        for (const result of output.Results) {
          const target = result.Target || '';
          
          if (result.Vulnerabilities && Array.isArray(result.Vulnerabilities)) {
            for (const vuln of result.Vulnerabilities) {
              vulnerabilities.push({
                title: vuln.VulnerabilityID || 'Unknown vulnerability',
                description: vuln.Description || vuln.Title || 'No description available',
                severity: this.mapTrivySeverity(vuln.Severity),
                filePath: target,
                lineNumber: 0, // Trivy doesn't provide line numbers for dependencies
                codeSnippet: `${vuln.PkgName}@${vuln.InstalledVersion}`,
                metadata: {
                  vulnerabilityId: vuln.VulnerabilityID,
                  packageName: vuln.PkgName,
                  installedVersion: vuln.InstalledVersion,
                  fixedVersion: vuln.FixedVersion,
                  references: vuln.References,
                  cvss: vuln.CVSS,
                  cwe: vuln.CweIDs
                }
              });
            }
          }
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        scanner: 'trivy',
        vulnerabilities,
        executionTime,
        success: true
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Check if it's a timeout error
      if (error instanceof Error && error.message.includes('timeout')) {
        return {
          scanner: 'trivy',
          vulnerabilities: [],
          executionTime,
          success: false,
          error: 'Trivy scan timed out'
        };
      }

      // Check if Trivy is not installed
      if (error instanceof Error && (error.message.includes('not found') || error.message.includes('ENOENT'))) {
        return {
          scanner: 'trivy',
          vulnerabilities: [],
          executionTime,
          success: false,
          error: 'Trivy is not installed or not in PATH'
        };
      }

      return {
        scanner: 'trivy',
        vulnerabilities: [],
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Map Trivy severity levels to our standard severity levels
   */
  private mapTrivySeverity(severity: string | undefined): string {
    if (!severity) return 'medium';
    
    const normalized = severity.toUpperCase();
    
    switch (normalized) {
      case 'CRITICAL':
        return 'critical';
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
      case 'UNKNOWN':
        return 'low';
      default:
        return 'medium';
    }
  }
}
