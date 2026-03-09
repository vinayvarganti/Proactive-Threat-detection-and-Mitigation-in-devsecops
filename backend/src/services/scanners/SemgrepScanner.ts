import { exec } from 'child_process';
import { promisify } from 'util';
import { ScanResult, RawVulnerability } from '../../types/scanner.types';

const execAsync = promisify(exec);

export class SemgrepScanner {
  private readonly timeout: number;

  constructor(timeout: number = 300000) { // 5 minutes default
    this.timeout = timeout;
  }

  /**
   * Scan a repository for code-level security vulnerabilities using Semgrep
   */
  async scan(repositoryPath: string): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      // Run Semgrep with auto config (uses community rules)
      const semgrepPath = process.env.SEMGREP_PATH || 'semgrep';
      const command = `"${semgrepPath}" --config=auto --json "${repositoryPath}"`;
      
      const { stdout } = await execAsync(command, {
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: { 
          ...process.env, 
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1' // Force UTF-8 mode in Python
        }
      });

      // Parse Semgrep JSON output
      const output = JSON.parse(stdout);
      const vulnerabilities: RawVulnerability[] = [];

      if (output.results && Array.isArray(output.results)) {
        for (const result of output.results) {
          vulnerabilities.push({
            title: result.check_id || 'Unknown vulnerability',
            description: result.extra?.message || result.extra?.metadata?.message || 'No description available',
            severity: this.mapSemgrepSeverity(result.extra?.severity),
            filePath: result.path || '',
            lineNumber: result.start?.line || 0,
            codeSnippet: result.extra?.lines || '',
            metadata: {
              checkId: result.check_id,
              category: result.extra?.metadata?.category,
              confidence: result.extra?.metadata?.confidence,
              cwe: result.extra?.metadata?.cwe,
              owasp: result.extra?.metadata?.owasp
            }
          });
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        scanner: 'semgrep',
        vulnerabilities,
        executionTime,
        success: true
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Check if it's a timeout error
      if (error instanceof Error && error.message.includes('timeout')) {
        return {
          scanner: 'semgrep',
          vulnerabilities: [],
          executionTime,
          success: false,
          error: 'Semgrep scan timed out'
        };
      }

      // Check if Semgrep is not installed
      if (error instanceof Error && (error.message.includes('not found') || error.message.includes('ENOENT'))) {
        return {
          scanner: 'semgrep',
          vulnerabilities: [],
          executionTime,
          success: false,
          error: 'Semgrep is not installed or not in PATH'
        };
      }

      return {
        scanner: 'semgrep',
        vulnerabilities: [],
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Map Semgrep severity levels to our standard severity levels
   */
  private mapSemgrepSeverity(severity: string | undefined): string {
    if (!severity) return 'medium';
    
    const normalized = severity.toLowerCase();
    
    switch (normalized) {
      case 'error':
      case 'critical':
        return 'critical';
      case 'warning':
        return 'high';
      case 'info':
      case 'note':
        return 'low';
      default:
        return 'medium';
    }
  }
}
