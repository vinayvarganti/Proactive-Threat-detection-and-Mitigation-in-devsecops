import { exec } from 'child_process';
import { promisify } from 'util';
import { ScanResult, RawVulnerability } from '../../types/scanner.types';

const execAsync = promisify(exec);

export class GitleaksScanner {
  private readonly timeout: number;

  constructor(timeout: number = 300000) { // 5 minutes default
    this.timeout = timeout;
  }

  /**
   * Scan a repository for exposed secrets and credentials using Gitleaks
   */
  async scan(repositoryPath: string): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      // Run Gitleaks with JSON output
      // Using --no-git flag to scan files without requiring a git repository
      // Use absolute path to gitleaks executable
      // Output to a temp file instead of stdout to avoid encoding issues
      const gitleaksPath = process.env.GITLEAKS_PATH || 'gitleaks';
      const gitleaksReportPath = `${repositoryPath}/gitleaks-report.json`.replace(/\\/g, '/');
      const command = `"${gitleaksPath}" detect --source "${repositoryPath}" --report-format json --report-path "${gitleaksReportPath}" --no-git --exit-code 0`;
      
      await execAsync(command, {
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      // Read the report from the file
      const fs = require('fs');
      let findings: any[] = [];
      
      try {
        if (fs.existsSync(gitleaksReportPath)) {
          const reportContent = fs.readFileSync(gitleaksReportPath, 'utf8');
          findings = JSON.parse(reportContent);
          // Clean up the report file
          fs.unlinkSync(gitleaksReportPath);
        }
      } catch (readError) {
        console.error('Error reading Gitleaks report:', readError);
      }

      const vulnerabilities: RawVulnerability[] = [];

      if (Array.isArray(findings)) {
        for (const finding of findings) {
          vulnerabilities.push({
            title: finding.RuleID || 'Secret detected',
            description: finding.Description || `${finding.RuleID} detected in code`,
            severity: 'critical', // All secrets are critical
            filePath: finding.File || '',
            lineNumber: finding.StartLine || 0,
            codeSnippet: this.sanitizeSecret(finding.Secret || finding.Match || ''),
            metadata: {
              ruleId: finding.RuleID,
              commit: finding.Commit,
              author: finding.Author,
              email: finding.Email,
              date: finding.Date,
              tags: finding.Tags,
              fingerprint: finding.Fingerprint
            }
          });
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        scanner: 'gitleaks',
        vulnerabilities,
        executionTime,
        success: true
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Gitleaks exits with code 1 when it finds secrets, which causes exec to throw
      // We need to check if it's actually an error or just findings
      if (error instanceof Error) {
        // Try to read from the report file
        const fs = require('fs');
        const gitleaksReportPath = `${repositoryPath}/gitleaks-report.json`.replace(/\\/g, '/');
        
        try {
          if (fs.existsSync(gitleaksReportPath)) {
            const reportContent = fs.readFileSync(gitleaksReportPath, 'utf8');
            const findings = JSON.parse(reportContent);
            const vulnerabilities: RawVulnerability[] = [];

            if (Array.isArray(findings)) {
              for (const finding of findings) {
                vulnerabilities.push({
                  title: finding.RuleID || 'Secret detected',
                  description: finding.Description || `${finding.RuleID} detected in code`,
                  severity: 'critical',
                  filePath: finding.File || '',
                  lineNumber: finding.StartLine || 0,
                  codeSnippet: this.sanitizeSecret(finding.Secret || finding.Match || ''),
                  metadata: {
                    ruleId: finding.RuleID,
                    commit: finding.Commit,
                    author: finding.Author,
                    email: finding.Email,
                    date: finding.Date,
                    tags: finding.Tags,
                    fingerprint: finding.Fingerprint
                  }
                });
              }
            }

            // Clean up the report file
            fs.unlinkSync(gitleaksReportPath);

            return {
              scanner: 'gitleaks',
              vulnerabilities,
              executionTime,
              success: true
            };
          }
        } catch (readError) {
          // Continue to error handling below
        }
      }
      
      // Check if it's a timeout error
      if (error instanceof Error && error.message.includes('timeout')) {
        return {
          scanner: 'gitleaks',
          vulnerabilities: [],
          executionTime,
          success: false,
          error: 'Gitleaks scan timed out'
        };
      }

      // Check if Gitleaks is not installed
      if (error instanceof Error && (error.message.includes('not found') || error.message.includes('ENOENT'))) {
        return {
          scanner: 'gitleaks',
          vulnerabilities: [],
          executionTime,
          success: false,
          error: 'Gitleaks is not installed or not in PATH'
        };
      }

      return {
        scanner: 'gitleaks',
        vulnerabilities: [],
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sanitize secrets by redacting the actual value
   */
  private sanitizeSecret(secret: string): string {
    if (!secret || secret.length === 0) {
      return '[REDACTED]';
    }
    
    // Show first and last 2 characters, redact the middle
    if (secret.length <= 4) {
      return '[REDACTED]';
    }
    
    const start = secret.substring(0, 2);
    const end = secret.substring(secret.length - 2);
    const middle = '*'.repeat(Math.min(secret.length - 4, 20));
    
    return `${start}${middle}${end}`;
  }
}
