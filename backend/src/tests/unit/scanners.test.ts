import { SemgrepScanner } from '../../services/scanners/SemgrepScanner';
import { TrivyScanner } from '../../services/scanners/TrivyScanner';
import { GitleaksScanner } from '../../services/scanners/GitleaksScanner';
import { exec } from 'child_process';

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

const mockedExec = exec as unknown as jest.Mock;

describe('Scanner Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SemgrepScanner', () => {
    let scanner: SemgrepScanner;

    beforeEach(() => {
      scanner = new SemgrepScanner();
    });

    it('should detect code-level security vulnerabilities', async () => {
      const mockSemgrepOutput = {
        results: [
          {
            check_id: 'javascript.lang.security.audit.xss.direct-response-write',
            path: '/test/vulnerable.js',
            start: { line: 10 },
            extra: {
              message: 'Potential XSS vulnerability',
              severity: 'ERROR',
              lines: 'res.write(userInput);',
              metadata: {
                category: 'security',
                confidence: 'HIGH',
                cwe: ['CWE-79'],
                owasp: ['A03:2021']
              }
            }
          }
        ]
      };

      mockedExec.mockImplementation((_cmd, _options, callback) => {
        callback(null, { stdout: JSON.stringify(mockSemgrepOutput), stderr: '' });
      });

      const result = await scanner.scan('/test/repo');

      expect(result.success).toBe(true);
      expect(result.scanner).toBe('semgrep');
      expect(result.vulnerabilities).toHaveLength(1);
      expect(result.vulnerabilities[0].title).toContain('xss');
      expect(result.vulnerabilities[0].severity).toBe('critical');
      expect(result.vulnerabilities[0].filePath).toBe('/test/vulnerable.js');
      expect(result.vulnerabilities[0].lineNumber).toBe(10);
    });

    it('should handle scanner timeout', async () => {
      mockedExec.mockImplementation((_cmd, _options, callback) => {
        const error: any = new Error('Command timed out');
        error.killed = true;
        callback(error);
      });

      const result = await scanner.scan('/test/repo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(result.vulnerabilities).toHaveLength(0);
    });

    it('should handle scanner not installed', async () => {
      mockedExec.mockImplementation((_cmd, _options, callback) => {
        const error: any = new Error('semgrep: not found');
        error.code = 'ENOENT';
        callback(error);
      });

      const result = await scanner.scan('/test/repo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not installed');
      expect(result.vulnerabilities).toHaveLength(0);
    });
  });

  describe('TrivyScanner', () => {
    let scanner: TrivyScanner;

    beforeEach(() => {
      scanner = new TrivyScanner();
    });

    it('should detect dependency vulnerabilities', async () => {
      const mockTrivyOutput = {
        Results: [
          {
            Target: 'package-lock.json',
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2021-23337',
                PkgName: 'lodash',
                InstalledVersion: '4.17.19',
                FixedVersion: '4.17.21',
                Severity: 'HIGH',
                Title: 'Command Injection in lodash',
                Description: 'lodash versions prior to 4.17.21 are vulnerable to Command Injection',
                References: ['https://nvd.nist.gov/vuln/detail/CVE-2021-23337'],
                CVSS: { 'nvd': { 'V3Score': 7.2 } },
                CweIDs: ['CWE-78']
              }
            ]
          }
        ]
      };

      mockedExec.mockImplementation((_cmd, _options, callback) => {
        callback(null, { stdout: JSON.stringify(mockTrivyOutput), stderr: '' });
      });

      const result = await scanner.scan('/test/repo');

      expect(result.success).toBe(true);
      expect(result.scanner).toBe('trivy');
      expect(result.vulnerabilities).toHaveLength(1);
      expect(result.vulnerabilities[0].title).toBe('CVE-2021-23337');
      expect(result.vulnerabilities[0].severity).toBe('high');
      expect(result.vulnerabilities[0].codeSnippet).toContain('lodash@4.17.19');
      expect(result.vulnerabilities[0].metadata.fixedVersion).toBe('4.17.21');
    });

    it('should handle scanner timeout', async () => {
      mockedExec.mockImplementation((_cmd, _options, callback) => {
        const error: any = new Error('Command timed out');
        error.killed = true;
        callback(error);
      });

      const result = await scanner.scan('/test/repo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(result.vulnerabilities).toHaveLength(0);
    });

    it('should handle scanner not installed', async () => {
      mockedExec.mockImplementation((_cmd, _options, callback) => {
        const error: any = new Error('trivy: not found');
        error.code = 'ENOENT';
        callback(error);
      });

      const result = await scanner.scan('/test/repo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not installed');
      expect(result.vulnerabilities).toHaveLength(0);
    });
  });

  describe('GitleaksScanner', () => {
    let scanner: GitleaksScanner;

    beforeEach(() => {
      scanner = new GitleaksScanner();
    });

    it('should detect exposed secrets', async () => {
      const mockGitleaksOutput = [
        {
          RuleID: 'aws-access-token',
          Description: 'AWS Access Token',
          File: '/test/config.js',
          StartLine: 5,
          Secret: 'AKIAXXXXXXXXXXXXXXXX',
          Match: 'AKIAXXXXXXXXXXXXXXXX',
          Tags: ['key', 'AWS'],
          Fingerprint: 'abc123'
        }
      ];

      mockedExec.mockImplementation((_cmd, _options, callback) => {
        const error: any = new Error('Command failed');
        error.code = 1;
        error.stdout = JSON.stringify(mockGitleaksOutput);
        callback(error);
      });

      const result = await scanner.scan('/test/repo');

      expect(result.success).toBe(true);
      expect(result.scanner).toBe('gitleaks');
      expect(result.vulnerabilities).toHaveLength(1);
      expect(result.vulnerabilities[0].title).toBe('aws-access-token');
      expect(result.vulnerabilities[0].severity).toBe('critical');
      expect(result.vulnerabilities[0].filePath).toBe('/test/config.js');
      expect(result.vulnerabilities[0].lineNumber).toBe(5);
      expect(result.vulnerabilities[0].codeSnippet).not.toBe('AKIAXXXXXXXXXXXXXXXX');
      expect(result.vulnerabilities[0].codeSnippet).toContain('*');
    });

    it('should sanitize secrets in output', async () => {
      const mockGitleaksOutput = [
        {
          RuleID: 'generic-api-key',
          Description: 'Generic API Key',
          File: '/test/api.js',
          StartLine: 10,
          Secret: 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          Match: 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          Tags: ['key', 'API'],
          Fingerprint: 'def456'
        }
      ];

      mockedExec.mockImplementation((_cmd, _options, callback) => {
        const error: any = new Error('Command failed');
        error.code = 1;
        error.stdout = JSON.stringify(mockGitleaksOutput);
        callback(error);
      });

      const result = await scanner.scan('/test/repo');

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toHaveLength(1);
      
      const sanitized = result.vulnerabilities[0].codeSnippet;
      expect(sanitized).toMatch(/^sk\*+xx$/);
      expect(sanitized).not.toContain('test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    });

    it('should handle scanner timeout', async () => {
      mockedExec.mockImplementation((_cmd, _options, callback) => {
        const error: any = new Error('Command timed out');
        error.killed = true;
        callback(error);
      });

      const result = await scanner.scan('/test/repo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(result.vulnerabilities).toHaveLength(0);
    });

    it('should handle scanner not installed', async () => {
      mockedExec.mockImplementation((_cmd, _options, callback) => {
        const error: any = new Error('gitleaks: not found');
        error.code = 'ENOENT';
        callback(error);
      });

      const result = await scanner.scan('/test/repo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not installed');
      expect(result.vulnerabilities).toHaveLength(0);
    });
  });
});

