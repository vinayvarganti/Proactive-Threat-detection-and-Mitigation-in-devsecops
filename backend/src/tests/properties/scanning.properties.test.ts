import { ScanOrchestrator } from '../../services/ScanOrchestrator';
import { SemgrepScanner } from '../../services/scanners/SemgrepScanner';
import { TrivyScanner } from '../../services/scanners/TrivyScanner';
import { GitleaksScanner } from '../../services/scanners/GitleaksScanner';
import { ScanResult, ScannerType } from '../../types/scanner.types';
import * as fc from 'fast-check';

// Mock the scanner classes
jest.mock('../../services/scanners/SemgrepScanner');
jest.mock('../../services/scanners/TrivyScanner');
jest.mock('../../services/scanners/GitleaksScanner');

describe('Scanning Properties', () => {
  let orchestrator: ScanOrchestrator;
  let mockSemgrepScanner: jest.Mocked<SemgrepScanner>;
  let mockTrivyScanner: jest.Mocked<TrivyScanner>;
  let mockGitleaksScanner: jest.Mocked<GitleaksScanner>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockSemgrepScanner = new SemgrepScanner() as jest.Mocked<SemgrepScanner>;
    mockTrivyScanner = new TrivyScanner() as jest.Mocked<TrivyScanner>;
    mockGitleaksScanner = new GitleaksScanner() as jest.Mocked<GitleaksScanner>;
    
    // Mock the constructors to return our mocks
    (SemgrepScanner as jest.MockedClass<typeof SemgrepScanner>).mockImplementation(() => mockSemgrepScanner);
    (TrivyScanner as jest.MockedClass<typeof TrivyScanner>).mockImplementation(() => mockTrivyScanner);
    (GitleaksScanner as jest.MockedClass<typeof GitleaksScanner>).mockImplementation(() => mockGitleaksScanner);
    
    orchestrator = new ScanOrchestrator();
  });

  // Feature: devsecops-platform, Property 8: All Scanners Invoked
  // **Validates: Requirements 3.1**
  describe('Property 8: All Scanners Invoked', () => {
    it('property: all three scanners are initiated for every scan', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary repository paths
          fc.record({
            repositoryPath: fc.string({ minLength: 5, maxLength: 100 }),
            semgrepVulnCount: fc.integer({ min: 0, max: 50 }),
            trivyVulnCount: fc.integer({ min: 0, max: 50 }),
            gitleaksVulnCount: fc.integer({ min: 0, max: 50 })
          }),
          async (testData) => {
            // Mock scanner responses with varying vulnerability counts
            const mockSemgrepResult: ScanResult = {
              scanner: 'semgrep',
              vulnerabilities: Array(testData.semgrepVulnCount).fill(null).map((_, i) => ({
                title: `Semgrep Vuln ${i}`,
                description: 'Test vulnerability',
                severity: 'high',
                filePath: '/test/file.js',
                lineNumber: i + 1,
                codeSnippet: 'test code',
                metadata: {}
              })),
              executionTime: 1000,
              success: true
            };

            const mockTrivyResult: ScanResult = {
              scanner: 'trivy',
              vulnerabilities: Array(testData.trivyVulnCount).fill(null).map((_, i) => ({
                title: `Trivy Vuln ${i}`,
                description: 'Test dependency vulnerability',
                severity: 'medium',
                filePath: '/package.json',
                lineNumber: 0,
                codeSnippet: 'lodash@1.0.0',
                metadata: {}
              })),
              executionTime: 2000,
              success: true
            };

            const mockGitleaksResult: ScanResult = {
              scanner: 'gitleaks',
              vulnerabilities: Array(testData.gitleaksVulnCount).fill(null).map((_, i) => ({
                title: `Secret ${i}`,
                description: 'Test secret',
                severity: 'critical',
                filePath: '/config.js',
                lineNumber: i + 10,
                codeSnippet: '[REDACTED]',
                metadata: {}
              })),
              executionTime: 1500,
              success: true
            };

            mockSemgrepScanner.scan = jest.fn().mockResolvedValue(mockSemgrepResult);
            mockTrivyScanner.scan = jest.fn().mockResolvedValue(mockTrivyResult);
            mockGitleaksScanner.scan = jest.fn().mockResolvedValue(mockGitleaksResult);

            // Execute scan
            const report = await orchestrator.scanRepository(testData.repositoryPath);

            // Property: All three scanners must be invoked
            expect(mockSemgrepScanner.scan).toHaveBeenCalledTimes(1);
            expect(mockTrivyScanner.scan).toHaveBeenCalledTimes(1);
            expect(mockGitleaksScanner.scan).toHaveBeenCalledTimes(1);

            // Property: All scanners must be called with the same repository path
            expect(mockSemgrepScanner.scan).toHaveBeenCalledWith(testData.repositoryPath);
            expect(mockTrivyScanner.scan).toHaveBeenCalledWith(testData.repositoryPath);
            expect(mockGitleaksScanner.scan).toHaveBeenCalledWith(testData.repositoryPath);

            // Property: Scan report must include results from all scanners
            expect(report.scannerResults.semgrep).toBeDefined();
            expect(report.scannerResults.trivy).toBeDefined();
            expect(report.scannerResults.gitleaks).toBeDefined();

            // Property: All scanners invoked means:
            // 1. Semgrep scanner is called ✓
            // 2. Trivy scanner is called ✓
            // 3. Gitleaks scanner is called ✓
            // 4. All scanners receive the repository path ✓
            // 5. Report includes status for all scanners ✓
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: devsecops-platform, Property 9: Scanner Failure Resilience
  // **Validates: Requirements 3.6, 9.2**
  describe('Property 9: Scanner Failure Resilience', () => {
    it('property: remaining scanners continue when one fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            repositoryPath: fc.string({ minLength: 5, maxLength: 100 }),
            failedScanner: fc.constantFrom<ScannerType>('semgrep', 'trivy', 'gitleaks'),
            errorMessage: fc.string({ minLength: 10, maxLength: 100 }),
            successfulVulnCount: fc.integer({ min: 1, max: 20 })
          }),
          async (testData) => {
            // Create successful scan result
            const successfulResult: ScanResult = {
              scanner: 'semgrep', // Will be overridden
              vulnerabilities: Array(testData.successfulVulnCount).fill(null).map((_, i) => ({
                title: `Vuln ${i}`,
                description: 'Test vulnerability',
                severity: 'high',
                filePath: '/test/file.js',
                lineNumber: i + 1,
                codeSnippet: 'test code',
                metadata: {}
              })),
              executionTime: 1000,
              success: true
            };

            // Create failed scan result
            const failedResult: ScanResult = {
              scanner: testData.failedScanner as ScannerType,
              vulnerabilities: [],
              executionTime: 500,
              success: false,
              error: testData.errorMessage
            };

            // Configure mocks based on which scanner fails
            if (testData.failedScanner === 'semgrep') {
              mockSemgrepScanner.scan = jest.fn().mockResolvedValue(failedResult);
              mockTrivyScanner.scan = jest.fn().mockResolvedValue({ ...successfulResult, scanner: 'trivy' });
              mockGitleaksScanner.scan = jest.fn().mockResolvedValue({ ...successfulResult, scanner: 'gitleaks' });
            } else if (testData.failedScanner === 'trivy') {
              mockSemgrepScanner.scan = jest.fn().mockResolvedValue({ ...successfulResult, scanner: 'semgrep' });
              mockTrivyScanner.scan = jest.fn().mockResolvedValue(failedResult);
              mockGitleaksScanner.scan = jest.fn().mockResolvedValue({ ...successfulResult, scanner: 'gitleaks' });
            } else {
              mockSemgrepScanner.scan = jest.fn().mockResolvedValue({ ...successfulResult, scanner: 'semgrep' });
              mockTrivyScanner.scan = jest.fn().mockResolvedValue({ ...successfulResult, scanner: 'trivy' });
              mockGitleaksScanner.scan = jest.fn().mockResolvedValue(failedResult);
            }

            // Execute scan
            const report = await orchestrator.scanRepository(testData.repositoryPath);

            // Property: All scanners must still be invoked even when one fails
            expect(mockSemgrepScanner.scan).toHaveBeenCalledTimes(1);
            expect(mockTrivyScanner.scan).toHaveBeenCalledTimes(1);
            expect(mockGitleaksScanner.scan).toHaveBeenCalledTimes(1);

            // Property: Failed scanner must be marked as failed in report
            const failedScannerResult = report.scannerResults[testData.failedScanner as ScannerType];
            expect(failedScannerResult.success).toBe(false);
            expect(failedScannerResult.error).toBe(testData.errorMessage);
            expect(failedScannerResult.count).toBe(0);

            // Property: Successful scanners must have their results included
            const scannerNames: ScannerType[] = ['semgrep', 'trivy', 'gitleaks'];
            const successfulScanners = scannerNames.filter(s => s !== testData.failedScanner);
            
            for (const scanner of successfulScanners) {
              const scannerResult = report.scannerResults[scanner];
              expect(scannerResult.success).toBe(true);
              expect(scannerResult.count).toBe(testData.successfulVulnCount);
              expect(scannerResult.error).toBeUndefined();
            }

            // Property: Report must include vulnerabilities from successful scanners
            const expectedTotalVulns = testData.successfulVulnCount * 2; // Two successful scanners
            expect(report.vulnerabilities.length).toBe(expectedTotalVulns);

            // Property: Scanner failure resilience means:
            // 1. All scanners are invoked regardless of failures ✓
            // 2. Failed scanner is marked as failed in report ✓
            // 3. Successful scanners have results included ✓
            // 4. Vulnerabilities from successful scanners are in report ✓
            // 5. Scan completes successfully despite individual failures ✓
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: devsecops-platform, Property 10: Scan Report Completeness
  // **Validates: Requirements 3.7**
  describe('Property 10: Scan Report Completeness', () => {
    it('property: all required fields are present in scan reports', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            repositoryPath: fc.string({ minLength: 5, maxLength: 100 }),
            vulnerabilities: fc.array(
              fc.record({
                scanner: fc.constantFrom('semgrep', 'trivy', 'gitleaks'),
                title: fc.string({ minLength: 5, maxLength: 50 }),
                description: fc.string({ minLength: 10, maxLength: 200 }),
                severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
                filePath: fc.string({ minLength: 5, maxLength: 100 }),
                lineNumber: fc.integer({ min: 0, max: 1000 }),
                codeSnippet: fc.string({ minLength: 5, maxLength: 100 })
              }),
              { minLength: 1, maxLength: 20 }
            )
          }),
          async (testData) => {
            // Group vulnerabilities by scanner
            const semgrepVulns = testData.vulnerabilities.filter(v => v.scanner === 'semgrep');
            const trivyVulns = testData.vulnerabilities.filter(v => v.scanner === 'trivy');
            const gitleaksVulns = testData.vulnerabilities.filter(v => v.scanner === 'gitleaks');

            // Mock scanner results
            mockSemgrepScanner.scan = jest.fn().mockResolvedValue({
              scanner: 'semgrep',
              vulnerabilities: semgrepVulns.map(v => ({
                title: v.title,
                description: v.description,
                severity: v.severity,
                filePath: v.filePath,
                lineNumber: v.lineNumber,
                codeSnippet: v.codeSnippet,
                metadata: { test: 'data' }
              })),
              executionTime: 1000,
              success: true
            });

            mockTrivyScanner.scan = jest.fn().mockResolvedValue({
              scanner: 'trivy',
              vulnerabilities: trivyVulns.map(v => ({
                title: v.title,
                description: v.description,
                severity: v.severity,
                filePath: v.filePath,
                lineNumber: v.lineNumber,
                codeSnippet: v.codeSnippet,
                metadata: { test: 'data' }
              })),
              executionTime: 2000,
              success: true
            });

            mockGitleaksScanner.scan = jest.fn().mockResolvedValue({
              scanner: 'gitleaks',
              vulnerabilities: gitleaksVulns.map(v => ({
                title: v.title,
                description: v.description,
                severity: v.severity,
                filePath: v.filePath,
                lineNumber: v.lineNumber,
                codeSnippet: v.codeSnippet,
                metadata: { test: 'data' }
              })),
              executionTime: 1500,
              success: true
            });

            // Execute scan
            const report = await orchestrator.scanRepository(testData.repositoryPath);

            // Property: Report must have all required top-level fields
            expect(report.id).toBeDefined();
            expect(typeof report.id).toBe('string');
            expect(report.repositoryPath).toBe(testData.repositoryPath);
            expect(report.timestamp).toBeInstanceOf(Date);
            expect(report.vulnerabilities).toBeInstanceOf(Array);
            expect(report.summary).toBeDefined();
            expect(report.scanDuration).toBeGreaterThanOrEqual(0);
            expect(report.scannerResults).toBeDefined();

            // Property: Each vulnerability must have all required fields
            for (const vuln of report.vulnerabilities) {
              // Required fields
              expect(vuln.id).toBeDefined();
              expect(typeof vuln.id).toBe('string');
              expect(vuln.type).toMatch(/^(code|dependency|secret)$/);
              expect(vuln.severity).toMatch(/^(critical|high|medium|low)$/);
              expect(vuln.title).toBeDefined();
              expect(typeof vuln.title).toBe('string');
              expect(vuln.description).toBeDefined();
              expect(typeof vuln.description).toBe('string');
              expect(vuln.filePath).toBeDefined();
              expect(typeof vuln.filePath).toBe('string');
              expect(typeof vuln.lineNumber).toBe('number');
              expect(vuln.scanner).toMatch(/^(semgrep|trivy|gitleaks)$/);
              expect(vuln.codeSnippet).toBeDefined();
              expect(typeof vuln.codeSnippet).toBe('string');
              expect(vuln.metadata).toBeDefined();
              expect(typeof vuln.metadata).toBe('object');
            }

            // Property: Summary must have all required fields
            expect(typeof report.summary.total).toBe('number');
            expect(report.summary.total).toBe(report.vulnerabilities.length);
            expect(report.summary.bySeverity).toBeDefined();
            expect(typeof report.summary.bySeverity.critical).toBe('number');
            expect(typeof report.summary.bySeverity.high).toBe('number');
            expect(typeof report.summary.bySeverity.medium).toBe('number');
            expect(typeof report.summary.bySeverity.low).toBe('number');
            expect(report.summary.byScanner).toBeDefined();
            expect(typeof report.summary.byScanner.semgrep).toBe('number');
            expect(typeof report.summary.byScanner.trivy).toBe('number');
            expect(typeof report.summary.byScanner.gitleaks).toBe('number');

            // Property: Scanner results must have all required fields
            for (const scanner of ['semgrep', 'trivy', 'gitleaks'] as const) {
              const scannerResult = report.scannerResults[scanner];
              expect(typeof scannerResult.success).toBe('boolean');
              expect(typeof scannerResult.count).toBe('number');
            }

            // Property: Scan report completeness means:
            // 1. Report has all required top-level fields ✓
            // 2. Each vulnerability has type, severity, file location, line number ✓
            // 3. Summary includes counts by severity and scanner ✓
            // 4. Scanner results include success status and counts ✓
            // 5. All fields have correct data types ✓
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: devsecops-platform, Property 11: Result Aggregation Correctness
  // **Validates: Requirements 3.5**
  describe('Property 11: Result Aggregation Correctness', () => {
    it('property: aggregation preserves all vulnerabilities without duplication', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            repositoryPath: fc.string({ minLength: 5, maxLength: 100 }),
            semgrepCount: fc.integer({ min: 0, max: 30 }),
            trivyCount: fc.integer({ min: 0, max: 30 }),
            gitleaksCount: fc.integer({ min: 0, max: 30 })
          }),
          async (testData) => {
            // Create unique vulnerabilities for each scanner
            const createVulnerabilities = (scanner: string, count: number) => {
              return Array(count).fill(null).map((_, i) => ({
                title: `${scanner}-vuln-${i}`,
                description: `${scanner} vulnerability ${i}`,
                severity: ['critical', 'high', 'medium', 'low'][i % 4],
                filePath: `/test/${scanner}/file${i}.js`,
                lineNumber: i + 1,
                codeSnippet: `${scanner} code ${i}`,
                metadata: { scanner, index: i }
              }));
            };

            mockSemgrepScanner.scan = jest.fn().mockResolvedValue({
              scanner: 'semgrep',
              vulnerabilities: createVulnerabilities('semgrep', testData.semgrepCount),
              executionTime: 1000,
              success: true
            });

            mockTrivyScanner.scan = jest.fn().mockResolvedValue({
              scanner: 'trivy',
              vulnerabilities: createVulnerabilities('trivy', testData.trivyCount),
              executionTime: 2000,
              success: true
            });

            mockGitleaksScanner.scan = jest.fn().mockResolvedValue({
              scanner: 'gitleaks',
              vulnerabilities: createVulnerabilities('gitleaks', testData.gitleaksCount),
              executionTime: 1500,
              success: true
            });

            // Execute scan
            const report = await orchestrator.scanRepository(testData.repositoryPath);

            // Property: Total vulnerability count must equal sum of all scanner results
            const expectedTotal = testData.semgrepCount + testData.trivyCount + testData.gitleaksCount;
            expect(report.vulnerabilities.length).toBe(expectedTotal);
            expect(report.summary.total).toBe(expectedTotal);

            // Property: No vulnerabilities should be duplicated (each has unique ID)
            const ids = report.vulnerabilities.map(v => v.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            // Property: Scanner counts in summary must match actual counts
            expect(report.summary.byScanner.semgrep).toBe(testData.semgrepCount);
            expect(report.summary.byScanner.trivy).toBe(testData.trivyCount);
            expect(report.summary.byScanner.gitleaks).toBe(testData.gitleaksCount);

            // Property: Severity counts must sum to total
            const severitySum = 
              report.summary.bySeverity.critical +
              report.summary.bySeverity.high +
              report.summary.bySeverity.medium +
              report.summary.bySeverity.low;
            expect(severitySum).toBe(expectedTotal);

            // Property: Each vulnerability from each scanner must be present
            const semgrepVulns = report.vulnerabilities.filter(v => v.scanner === 'semgrep');
            const trivyVulns = report.vulnerabilities.filter(v => v.scanner === 'trivy');
            const gitleaksVulns = report.vulnerabilities.filter(v => v.scanner === 'gitleaks');

            expect(semgrepVulns.length).toBe(testData.semgrepCount);
            expect(trivyVulns.length).toBe(testData.trivyCount);
            expect(gitleaksVulns.length).toBe(testData.gitleaksCount);

            // Property: Vulnerability types must match scanner types
            for (const vuln of semgrepVulns) {
              expect(vuln.type).toBe('code');
            }
            for (const vuln of trivyVulns) {
              expect(vuln.type).toBe('dependency');
            }
            for (const vuln of gitleaksVulns) {
              expect(vuln.type).toBe('secret');
            }

            // Property: Result aggregation correctness means:
            // 1. All vulnerabilities from all scanners are included ✓
            // 2. No vulnerabilities are duplicated ✓
            // 3. Summary counts match actual vulnerability counts ✓
            // 4. Severity counts sum to total ✓
            // 5. Scanner-specific counts are accurate ✓
            // 6. Vulnerability types match scanner types ✓
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});

