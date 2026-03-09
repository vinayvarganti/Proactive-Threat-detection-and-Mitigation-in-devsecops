import { randomUUID } from 'crypto';
import { SemgrepScanner } from './scanners/SemgrepScanner';
import { TrivyScanner } from './scanners/TrivyScanner';
import { GitleaksScanner } from './scanners/GitleaksScanner';
import {
  ScanResult,
  ScanReport,
  Vulnerability,
  VulnerabilityType,
  SeverityLevel,
  VulnerabilitySummary
} from '../types/scanner.types';

export class ScanOrchestrator {
  private readonly semgrepScanner: SemgrepScanner;
  private readonly trivyScanner: TrivyScanner;
  private readonly gitleaksScanner: GitleaksScanner;
  private readonly useMockMode: boolean;

  constructor() {
    this.semgrepScanner = new SemgrepScanner();
    this.trivyScanner = new TrivyScanner();
    this.gitleaksScanner = new GitleaksScanner();
    // Enable mock mode if MOCK_SCANNERS environment variable is set
    this.useMockMode = process.env.MOCK_SCANNERS === 'true';
  }

  /**
   * Scan a repository using all three security scanners in parallel
   * Returns aggregated scan report with results from all scanners
   */
  async scanRepository(repositoryPath: string): Promise<ScanReport> {
    const startTime = Date.now();

    // If mock mode is enabled, return mock results
    if (this.useMockMode) {
      return this.getMockScanReport(repositoryPath, startTime);
    }

    // Execute all scanners in parallel using Promise.allSettled
    // This ensures all scanners run even if one fails
    const scanPromises = [
      this.semgrepScanner.scan(repositoryPath),
      this.trivyScanner.scan(repositoryPath),
      this.gitleaksScanner.scan(repositoryPath)
    ];

    const results = await Promise.allSettled(scanPromises);

    // Extract scan results from settled promises
    const scanResults: ScanResult[] = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        scanResults.push(result.value);
      } else {
        // If a scanner promise was rejected (shouldn't happen as scanners handle errors internally)
        // Create a failed scan result
        console.error('Scanner promise rejected:', result.reason);
      }
    }

    // Aggregate results into a unified scan report
    const scanReport = this.aggregateResults(scanResults, repositoryPath);
    
    scanReport.scanDuration = Date.now() - startTime;

    return scanReport;
  }

  /**
   * Generate mock scan report for demonstration purposes
   */
  private getMockScanReport(repositoryPath: string, startTime: number): ScanReport {
    const mockResults: ScanResult[] = [
      {
        scanner: 'semgrep',
        success: true,
        executionTime: 150,
        vulnerabilities: []
      },
      {
        scanner: 'trivy',
        success: true,
        executionTime: 200,
        vulnerabilities: []
      },
      {
        scanner: 'gitleaks',
        success: true,
        executionTime: 100,
        vulnerabilities: []
      }
    ];

    const scanReport = this.aggregateResults(mockResults, repositoryPath);
    scanReport.scanDuration = Date.now() - startTime;
    
    return scanReport;
  }

  /**
   * Aggregate results from multiple scanners into a unified scan report
   */
  private aggregateResults(results: ScanResult[], repositoryPath: string): ScanReport {
    const vulnerabilities: Vulnerability[] = [];
    const scannerResults = {
      semgrep: { success: false, count: 0, error: undefined as string | undefined },
      trivy: { success: false, count: 0, error: undefined as string | undefined },
      gitleaks: { success: false, count: 0, error: undefined as string | undefined }
    };

    // Process each scanner result
    for (const result of results) {
      // Update scanner status
      scannerResults[result.scanner] = {
        success: result.success,
        count: result.vulnerabilities.length,
        error: result.error
      };

      // Normalize and add vulnerabilities
      if (result.success && result.vulnerabilities.length > 0) {
        for (const rawVuln of result.vulnerabilities) {
          const vulnerability: Vulnerability = {
            id: randomUUID(),
            type: this.getVulnerabilityType(result.scanner),
            severity: this.normalizeSeverity(rawVuln.severity),
            title: rawVuln.title,
            description: rawVuln.description,
            filePath: rawVuln.filePath,
            lineNumber: rawVuln.lineNumber,
            scanner: result.scanner,
            codeSnippet: rawVuln.codeSnippet,
            metadata: rawVuln.metadata
          };

          vulnerabilities.push(vulnerability);
        }
      }
    }

    // Generate summary
    const summary = this.generateSummary(vulnerabilities);

    return {
      id: randomUUID(),
      repositoryPath,
      timestamp: new Date(),
      vulnerabilities,
      summary,
      scanDuration: 0, // Will be set by caller
      scannerResults
    };
  }

  /**
   * Normalize severity levels from scanner-specific values to standard levels
   */
  private normalizeSeverity(scannerSeverity: string): SeverityLevel {
    const normalized = scannerSeverity.toLowerCase();

    // Map to standard severity levels
    switch (normalized) {
      case 'critical':
        return 'critical';
      case 'high':
      case 'error':
      case 'warning':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
      case 'info':
      case 'note':
      case 'unknown':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Determine vulnerability type based on scanner
   */
  private getVulnerabilityType(scanner: string): VulnerabilityType {
    switch (scanner) {
      case 'semgrep':
        return 'code';
      case 'trivy':
        return 'dependency';
      case 'gitleaks':
        return 'secret';
      default:
        return 'code';
    }
  }

  /**
   * Generate summary statistics for vulnerabilities
   */
  private generateSummary(vulnerabilities: Vulnerability[]): VulnerabilitySummary {
    const summary: VulnerabilitySummary = {
      total: vulnerabilities.length,
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      byScanner: {
        semgrep: 0,
        trivy: 0,
        gitleaks: 0
      }
    };

    for (const vuln of vulnerabilities) {
      summary.bySeverity[vuln.severity]++;
      summary.byScanner[vuln.scanner]++;
    }

    return summary;
  }
}
