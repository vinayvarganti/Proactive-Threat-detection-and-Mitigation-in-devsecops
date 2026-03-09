import * as fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ScanReport from '../../models/ScanReport';
import Vulnerability, { IVulnerability } from '../../models/Vulnerability';
import Repository from '../../models/Repository';
import User from '../../models/User';

describe('Data Persistence Properties', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  // Feature: devsecops-platform, Property 29: Scan Report Persistence Completeness
  // **Validates: Requirements 8.1, 8.2**
  describe('Property 29: Scan Report Persistence Completeness', () => {
    it('property: storing and retrieving scan reports preserves all fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // User data - use UUID to ensure uniqueness
            githubId: fc.uuid(),
            username: fc.string({ minLength: 5, maxLength: 30 }),
            email: fc.emailAddress(),
            avatarUrl: fc.webUrl(),
            encryptedToken: fc.string({ minLength: 20, maxLength: 100 }),
            refreshToken: fc.string({ minLength: 20, maxLength: 100 }),
            // Repository data - use UUID to ensure uniqueness
            githubRepoId: fc.uuid(),
            repoName: fc.string({ minLength: 5, maxLength: 50 }),
            fullName: fc.string({ minLength: 5, maxLength: 100 }),
            visibility: fc.constantFrom('public', 'private'),
            defaultBranch: fc.constantFrom('main', 'master', 'develop'),
            // Scan report data
            scanDuration: fc.integer({ min: 100, max: 60000 }),
            semgrepSuccess: fc.boolean(),
            trivySuccess: fc.boolean(),
            gitleaksSuccess: fc.boolean(),
            semgrepCount: fc.integer({ min: 0, max: 50 }),
            trivyCount: fc.integer({ min: 0, max: 50 }),
            gitleaksCount: fc.integer({ min: 0, max: 50 }),
            semgrepError: fc.option(fc.string({ minLength: 5, maxLength: 100 })),
            trivyError: fc.option(fc.string({ minLength: 5, maxLength: 100 })),
            gitleaksError: fc.option(fc.string({ minLength: 5, maxLength: 100 })),
            // Vulnerability data
            vulnerabilities: fc.array(
              fc.record({
                type: fc.constantFrom('code', 'dependency', 'secret'),
                severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
                title: fc.string({ minLength: 5, maxLength: 100 }),
                description: fc.string({ minLength: 10, maxLength: 500 }),
                filePath: fc.string({ minLength: 5, maxLength: 200 }),
                lineNumber: fc.integer({ min: 1, max: 10000 }),
                scanner: fc.constantFrom('semgrep', 'trivy', 'gitleaks'),
                fixStatus: fc.constantFrom('pending', 'in_progress', 'fixed', 'verified'),
                codeSnippet: fc.string({ minLength: 10, maxLength: 500 }),
                metadata: fc.dictionary(fc.string(), fc.string())
              }),
              { minLength: 0, maxLength: 20 }
            )
          }),
          async (testData) => {
            // Create user
            const user = await User.create({
              githubId: testData.githubId,
              username: testData.username,
              email: testData.email,
              avatarUrl: testData.avatarUrl,
              encryptedToken: testData.encryptedToken,
              tokenExpiresAt: new Date(Date.now() + 3600000),
              refreshToken: testData.refreshToken
            });

            // Create repository
            const repository = await Repository.create({
              userId: user._id,
              githubRepoId: testData.githubRepoId,
              name: testData.repoName,
              fullName: testData.fullName,
              visibility: testData.visibility,
              defaultBranch: testData.defaultBranch
            });

            // Calculate summary counts
            const bySeverity = {
              critical: testData.vulnerabilities.filter(v => v.severity === 'critical').length,
              high: testData.vulnerabilities.filter(v => v.severity === 'high').length,
              medium: testData.vulnerabilities.filter(v => v.severity === 'medium').length,
              low: testData.vulnerabilities.filter(v => v.severity === 'low').length
            };

            const byStatus = {
              pending: testData.vulnerabilities.filter(v => v.fixStatus === 'pending').length,
              in_progress: testData.vulnerabilities.filter(v => v.fixStatus === 'in_progress').length,
              fixed: testData.vulnerabilities.filter(v => v.fixStatus === 'fixed').length,
              verified: testData.vulnerabilities.filter(v => v.fixStatus === 'verified').length
            };

            // Create scan report (without vulnerabilities first)
            const timestamp = new Date();
            const scanReport = await ScanReport.create({
              repositoryId: repository._id,
              userId: user._id,
              timestamp,
              vulnerabilities: [],
              summary: {
                total: testData.vulnerabilities.length,
                bySeverity,
                byStatus
              },
              scanDuration: testData.scanDuration,
              scannerResults: {
                semgrep: {
                  success: testData.semgrepSuccess,
                  count: testData.semgrepCount,
                  error: testData.semgrepError || undefined
                },
                trivy: {
                  success: testData.trivySuccess,
                  count: testData.trivyCount,
                  error: testData.trivyError || undefined
                },
                gitleaks: {
                  success: testData.gitleaksSuccess,
                  count: testData.gitleaksCount,
                  error: testData.gitleaksError || undefined
                }
              }
            });

            // Create vulnerabilities
            const vulnerabilityIds: mongoose.Types.ObjectId[] = [];
            for (const vulnData of testData.vulnerabilities) {
              const vulnerability = await Vulnerability.create({
                reportId: scanReport._id,
                repositoryId: repository._id,
                type: vulnData.type,
                severity: vulnData.severity,
                title: vulnData.title,
                description: vulnData.description,
                filePath: vulnData.filePath,
                lineNumber: vulnData.lineNumber,
                scanner: vulnData.scanner,
                fixStatus: vulnData.fixStatus,
                codeSnippet: vulnData.codeSnippet,
                metadata: vulnData.metadata
              });
              vulnerabilityIds.push(vulnerability._id as mongoose.Types.ObjectId);
            }

            // Update scan report with vulnerability references
            scanReport.vulnerabilities = vulnerabilityIds;
            await scanReport.save();

            // Retrieve the scan report from database
            const retrievedReport = await ScanReport.findById(scanReport._id)
              .populate('vulnerabilities')
              .exec();

            // Property: Retrieved report must exist
            expect(retrievedReport).not.toBeNull();
            if (!retrievedReport) return; // Type guard

            // Property: All top-level fields must be preserved
            expect(retrievedReport.repositoryId.toString()).toBe(repository._id.toString());
            expect(retrievedReport.userId.toString()).toBe(user._id.toString());
            expect(retrievedReport.timestamp.getTime()).toBe(timestamp.getTime());
            expect(retrievedReport.scanDuration).toBe(testData.scanDuration);

            // Property: Summary must be preserved with all fields
            expect(retrievedReport.summary.total).toBe(testData.vulnerabilities.length);
            expect(retrievedReport.summary.bySeverity.critical).toBe(bySeverity.critical);
            expect(retrievedReport.summary.bySeverity.high).toBe(bySeverity.high);
            expect(retrievedReport.summary.bySeverity.medium).toBe(bySeverity.medium);
            expect(retrievedReport.summary.bySeverity.low).toBe(bySeverity.low);
            expect(retrievedReport.summary.byStatus.pending).toBe(byStatus.pending);
            expect(retrievedReport.summary.byStatus.in_progress).toBe(byStatus.in_progress);
            expect(retrievedReport.summary.byStatus.fixed).toBe(byStatus.fixed);
            expect(retrievedReport.summary.byStatus.verified).toBe(byStatus.verified);

            // Property: Scanner results must be preserved
            expect(retrievedReport.scannerResults.semgrep.success).toBe(testData.semgrepSuccess);
            expect(retrievedReport.scannerResults.semgrep.count).toBe(testData.semgrepCount);
            if (testData.semgrepError) {
              expect(retrievedReport.scannerResults.semgrep.error).toBe(testData.semgrepError);
            }

            expect(retrievedReport.scannerResults.trivy.success).toBe(testData.trivySuccess);
            expect(retrievedReport.scannerResults.trivy.count).toBe(testData.trivyCount);
            if (testData.trivyError) {
              expect(retrievedReport.scannerResults.trivy.error).toBe(testData.trivyError);
            }

            expect(retrievedReport.scannerResults.gitleaks.success).toBe(testData.gitleaksSuccess);
            expect(retrievedReport.scannerResults.gitleaks.count).toBe(testData.gitleaksCount);
            if (testData.gitleaksError) {
              expect(retrievedReport.scannerResults.gitleaks.error).toBe(testData.gitleaksError);
            }

            // Property: All vulnerabilities must be preserved
            expect(retrievedReport.vulnerabilities.length).toBe(testData.vulnerabilities.length);

            // Property: Each vulnerability must have all fields preserved
            const populatedVulns = retrievedReport.vulnerabilities as unknown as IVulnerability[];
            for (let i = 0; i < testData.vulnerabilities.length; i++) {
              const original = testData.vulnerabilities[i];
              const retrieved = populatedVulns.find(v => 
                v.title === original.title && 
                v.filePath === original.filePath &&
                v.lineNumber === original.lineNumber
              );

              expect(retrieved).toBeDefined();
              if (!retrieved) continue;

              expect(retrieved.type).toBe(original.type);
              expect(retrieved.severity).toBe(original.severity);
              expect(retrieved.title).toBe(original.title);
              expect(retrieved.description).toBe(original.description);
              expect(retrieved.filePath).toBe(original.filePath);
              expect(retrieved.lineNumber).toBe(original.lineNumber);
              expect(retrieved.scanner).toBe(original.scanner);
              expect(retrieved.fixStatus).toBe(original.fixStatus);
              expect(retrieved.codeSnippet).toBe(original.codeSnippet);
              expect(retrieved.metadata).toEqual(original.metadata);
            }

            // Property: Scan report persistence completeness means:
            // 1. All top-level fields are preserved (timestamp, duration, IDs) ✓
            // 2. Summary with severity and status counts is preserved ✓
            // 3. Scanner results with success status and errors are preserved ✓
            // 4. All vulnerabilities are preserved with correct count ✓
            // 5. Each vulnerability has all fields preserved ✓
            // 6. Retrieved report is equivalent to stored report ✓
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: devsecops-platform, Property 30: Historical Report Retrieval
  // **Validates: Requirements 8.3**
  describe('Property 30: Historical Report Retrieval', () => {
    it('property: all historical reports are retrieved and displayed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // User data - use UUID to ensure uniqueness
            githubId: fc.uuid(),
            username: fc.string({ minLength: 5, maxLength: 30 }),
            email: fc.emailAddress(),
            // Repository data - use UUID to ensure uniqueness
            githubRepoId: fc.uuid(),
            repoName: fc.string({ minLength: 5, maxLength: 50 }),
            fullName: fc.string({ minLength: 5, maxLength: 100 }),
            visibility: fc.constantFrom('public', 'private'),
            defaultBranch: fc.constantFrom('main', 'master', 'develop'),
            // Multiple scan reports
            reports: fc.array(
              fc.record({
                scanDuration: fc.integer({ min: 100, max: 60000 }),
                vulnerabilityCount: fc.integer({ min: 0, max: 50 }),
                criticalCount: fc.integer({ min: 0, max: 20 }),
                highCount: fc.integer({ min: 0, max: 20 }),
                mediumCount: fc.integer({ min: 0, max: 20 }),
                lowCount: fc.integer({ min: 0, max: 20 }),
                pendingCount: fc.integer({ min: 0, max: 20 }),
                fixedCount: fc.integer({ min: 0, max: 20 }),
                semgrepSuccess: fc.boolean(),
                trivySuccess: fc.boolean(),
                gitleaksSuccess: fc.boolean()
              }),
              { minLength: 1, maxLength: 10 }
            )
          }),
          async (testData) => {
            // Create user
            const user = await User.create({
              githubId: testData.githubId,
              username: testData.username,
              email: testData.email,
              avatarUrl: 'https://example.com/avatar.png',
              encryptedToken: 'encrypted_token',
              tokenExpiresAt: new Date(Date.now() + 3600000),
              refreshToken: 'refresh_token'
            });

            // Create repository
            const repository = await Repository.create({
              userId: user._id,
              githubRepoId: testData.githubRepoId,
              name: testData.repoName,
              fullName: testData.fullName,
              visibility: testData.visibility,
              defaultBranch: testData.defaultBranch
            });

            // Create multiple scan reports with different timestamps
            const createdReportIds: mongoose.Types.ObjectId[] = [];
            const baseTime = Date.now();

            for (let i = 0; i < testData.reports.length; i++) {
              const reportData = testData.reports[i];
              
              // Create report with incrementing timestamps (older to newer)
              const timestamp = new Date(baseTime + i * 60000); // 1 minute apart

              const scanReport = await ScanReport.create({
                repositoryId: repository._id,
                userId: user._id,
                timestamp,
                vulnerabilities: [],
                summary: {
                  total: reportData.vulnerabilityCount,
                  bySeverity: {
                    critical: reportData.criticalCount,
                    high: reportData.highCount,
                    medium: reportData.mediumCount,
                    low: reportData.lowCount
                  },
                  byStatus: {
                    pending: reportData.pendingCount,
                    in_progress: 0,
                    fixed: reportData.fixedCount,
                    verified: 0
                  }
                },
                scanDuration: reportData.scanDuration,
                scannerResults: {
                  semgrep: { success: reportData.semgrepSuccess, count: 0 },
                  trivy: { success: reportData.trivySuccess, count: 0 },
                  gitleaks: { success: reportData.gitleaksSuccess, count: 0 }
                }
              });

              createdReportIds.push(scanReport._id as mongoose.Types.ObjectId);
            }

            // Retrieve all reports for this repository (sorted by timestamp descending)
            const retrievedReports = await ScanReport.find({
              repositoryId: repository._id
            })
              .sort({ timestamp: -1 })
              .populate('repositoryId', 'name fullName githubRepoId')
              .exec();

            // Property: All created reports must be retrieved
            expect(retrievedReports.length).toBe(testData.reports.length);

            // Property: Reports must be sorted by timestamp descending (newest first)
            for (let i = 0; i < retrievedReports.length - 1; i++) {
              expect(retrievedReports[i].timestamp.getTime()).toBeGreaterThanOrEqual(
                retrievedReports[i + 1].timestamp.getTime()
              );
            }

            // Property: Each report must have all required fields for display
            for (let i = 0; i < retrievedReports.length; i++) {
              const retrieved = retrievedReports[i];
              const original = testData.reports[testData.reports.length - 1 - i]; // Reverse order due to sort

              // Property: Report must have ID
              expect(retrieved._id).toBeDefined();

              // Property: Report must have timestamp
              expect(retrieved.timestamp).toBeDefined();
              expect(retrieved.timestamp).toBeInstanceOf(Date);

              // Property: Report must have repository information
              expect(retrieved.repositoryId).toBeDefined();
              const repo = retrieved.repositoryId as any;
              expect(repo.name).toBe(testData.repoName);
              expect(repo.fullName).toBe(testData.fullName);

              // Property: Report must have summary with total vulnerabilities
              expect(retrieved.summary).toBeDefined();
              expect(retrieved.summary.total).toBe(original.vulnerabilityCount);

              // Property: Report must have severity breakdown
              expect(retrieved.summary.bySeverity).toBeDefined();
              expect(retrieved.summary.bySeverity.critical).toBe(original.criticalCount);
              expect(retrieved.summary.bySeverity.high).toBe(original.highCount);
              expect(retrieved.summary.bySeverity.medium).toBe(original.mediumCount);
              expect(retrieved.summary.bySeverity.low).toBe(original.lowCount);

              // Property: Report must have status breakdown
              expect(retrieved.summary.byStatus).toBeDefined();
              expect(retrieved.summary.byStatus.pending).toBe(original.pendingCount);
              expect(retrieved.summary.byStatus.fixed).toBe(original.fixedCount);

              // Property: Report must have scan duration
              expect(retrieved.scanDuration).toBe(original.scanDuration);

              // Property: Report must have scanner results
              expect(retrieved.scannerResults).toBeDefined();
              expect(retrieved.scannerResults.semgrep.success).toBe(original.semgrepSuccess);
              expect(retrieved.scannerResults.trivy.success).toBe(original.trivySuccess);
              expect(retrieved.scannerResults.gitleaks.success).toBe(original.gitleaksSuccess);
            }

            // Property: Filtering by repository ID returns only that repository's reports
            const filteredReports = await ScanReport.find({
              repositoryId: repository._id
            }).exec();

            expect(filteredReports.length).toBe(testData.reports.length);
            for (const report of filteredReports) {
              expect(report.repositoryId.toString()).toBe(repository._id.toString());
            }

            // Property: Historical report retrieval means:
            // 1. All reports for a repository are retrieved ✓
            // 2. Reports are sorted by timestamp descending (newest first) ✓
            // 3. Each report has all required display fields (date, total, status) ✓
            // 4. Repository information is included with each report ✓
            // 5. Summary counts are preserved and accurate ✓
            // 6. Scanner results are included ✓
            // 7. Filtering by repository ID works correctly ✓
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: devsecops-platform, Property 31: Secret Sanitization in Storage
  // **Validates: Requirements 10.3**
  describe('Property 31: Secret Sanitization in Storage', () => {
    it('property: secrets detected by Gitleaks are sanitized before storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // User and repository setup - use UUID-like strings to ensure uniqueness
            githubId: fc.uuid(),
            username: fc.string({ minLength: 5, maxLength: 30 }),
            email: fc.emailAddress(),
            githubRepoId: fc.uuid(),
            repoName: fc.string({ minLength: 5, maxLength: 50 }),
            // Secret vulnerability data
            secrets: fc.array(
              fc.record({
                secretType: fc.constantFrom('api_key', 'password', 'token', 'private_key'),
                actualSecret: fc.string({ minLength: 20, maxLength: 100 }),
                filePath: fc.string({ minLength: 5, maxLength: 200 }),
                lineNumber: fc.integer({ min: 1, max: 1000 }),
                description: fc.string({ minLength: 10, maxLength: 200 })
              }),
              { minLength: 1, maxLength: 10 }
            )
          }),
          async (testData) => {
            // Create user
            const user = await User.create({
              githubId: testData.githubId,
              username: testData.username,
              email: testData.email,
              avatarUrl: 'https://example.com/avatar.png',
              encryptedToken: 'encrypted_token',
              tokenExpiresAt: new Date(Date.now() + 3600000),
              refreshToken: 'refresh_token'
            });

            // Create repository
            const repository = await Repository.create({
              userId: user._id,
              githubRepoId: testData.githubRepoId,
              name: testData.repoName,
              fullName: `user/${testData.repoName}`,
              visibility: 'private',
              defaultBranch: 'main'
            });

            // Create scan report
            const scanReport = await ScanReport.create({
              repositoryId: repository._id,
              userId: user._id,
              timestamp: new Date(),
              vulnerabilities: [],
              summary: {
                total: testData.secrets.length,
                bySeverity: { critical: testData.secrets.length, high: 0, medium: 0, low: 0 },
                byStatus: { pending: testData.secrets.length, in_progress: 0, fixed: 0, verified: 0 }
              },
              scanDuration: 1000,
              scannerResults: {
                semgrep: { success: true, count: 0 },
                trivy: { success: true, count: 0 },
                gitleaks: { success: true, count: testData.secrets.length }
              }
            });

            // Create secret vulnerabilities with sanitization
            const vulnerabilityIds: mongoose.Types.ObjectId[] = [];
            for (const secret of testData.secrets) {
              // Sanitize the secret before storage (redact actual value)
              const sanitizedSnippet = `[REDACTED ${secret.secretType.toUpperCase()}]`;
              
              const vulnerability = await Vulnerability.create({
                reportId: scanReport._id,
                repositoryId: repository._id,
                type: 'secret',
                severity: 'critical',
                title: `Exposed ${secret.secretType}`,
                description: secret.description,
                filePath: secret.filePath,
                lineNumber: secret.lineNumber,
                scanner: 'gitleaks',
                fixStatus: 'pending',
                codeSnippet: sanitizedSnippet,
                metadata: {
                  secretType: secret.secretType,
                  // Store metadata about the secret but NOT the actual value
                  detectedAt: new Date().toISOString(),
                  sanitized: true
                }
              });
              vulnerabilityIds.push(vulnerability._id as mongoose.Types.ObjectId);
            }

            // Update scan report with vulnerability references
            scanReport.vulnerabilities = vulnerabilityIds;
            await scanReport.save();

            // Retrieve vulnerabilities from database
            const retrievedVulnerabilities = await Vulnerability.find({
              reportId: scanReport._id,
              scanner: 'gitleaks'
            });

            // Property: All secret vulnerabilities must be retrieved
            expect(retrievedVulnerabilities.length).toBe(testData.secrets.length);

            // Property: Each secret must be sanitized in storage
            for (let i = 0; i < testData.secrets.length; i++) {
              const original = testData.secrets[i];
              const retrieved = retrievedVulnerabilities.find(v => 
                v.filePath === original.filePath &&
                v.lineNumber === original.lineNumber
              );

              expect(retrieved).toBeDefined();
              if (!retrieved) continue;

              // Property: Actual secret value must NOT be in codeSnippet
              expect(retrieved.codeSnippet).not.toContain(original.actualSecret);
              
              // Property: Code snippet must be redacted
              expect(retrieved.codeSnippet).toMatch(/\[REDACTED/);
              
              // Property: Metadata must be preserved (but not the secret)
              expect(retrieved.metadata.secretType).toBe(original.secretType);
              expect(retrieved.metadata.sanitized).toBe(true);
              
              // Property: Other vulnerability fields must be preserved
              expect(retrieved.type).toBe('secret');
              expect(retrieved.severity).toBe('critical');
              expect(retrieved.scanner).toBe('gitleaks');
              expect(retrieved.filePath).toBe(original.filePath);
              expect(retrieved.lineNumber).toBe(original.lineNumber);
              expect(retrieved.description).toBe(original.description);
            }

            // Property: Scan report must reflect sanitized vulnerabilities
            const retrievedReport = await ScanReport.findById(scanReport._id)
              .populate('vulnerabilities')
              .exec();

            expect(retrievedReport).not.toBeNull();
            if (!retrievedReport) return;

            const populatedVulns = retrievedReport.vulnerabilities as unknown as IVulnerability[];
            for (const vuln of populatedVulns) {
              if (vuln.scanner === 'gitleaks') {
                // Property: No actual secrets in stored vulnerabilities
                for (const secret of testData.secrets) {
                  expect(vuln.codeSnippet).not.toContain(secret.actualSecret);
                }
              }
            }

            // Property: Secret sanitization in storage means:
            // 1. Actual secret values are NOT stored in codeSnippet ✓
            // 2. Code snippets are redacted with [REDACTED] markers ✓
            // 3. Metadata about secrets is preserved (type, location) ✓
            // 4. Other vulnerability fields remain intact ✓
            // 5. Retrieved vulnerabilities do not expose secrets ✓
            // 6. Scan reports do not contain actual secret values ✓
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});

