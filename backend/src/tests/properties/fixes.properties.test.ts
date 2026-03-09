import { FixManager } from '../../services/FixManager';
import Vulnerability from '../../models/Vulnerability';
import Fix from '../../models/Fix';
import * as fc from 'fast-check';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Fix Management Properties', () => {
  let mongoServer: MongoMemoryServer;
  let fixManager: FixManager;
  let tempDir: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    fixManager = new FixManager();
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fix-test-'));
  });

  afterEach(async () => {
    await Vulnerability.deleteMany({});
    await Fix.deleteMany({});
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Feature: devsecops-platform, Property 19: Fix Status Progression
  // **Validates: Requirements 5.3, 5.4**
  describe('Property 19: Fix Status Progression', () => {
    it('property: fix status progresses from Pending → In Progress → Fixed with database persistence', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary vulnerability and fix data
          fc.record({
            vulnerabilityData: fc.record({
              type: fc.constantFrom('code', 'dependency', 'secret'),
              severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
              title: fc.string({ minLength: 10, maxLength: 100 }),
              description: fc.string({ minLength: 20, maxLength: 200 }),
              filePath: fc.constantFrom('src/index.ts', 'src/utils.js'),
              lineNumber: fc.integer({ min: 1, max: 1000 }),
              scanner: fc.constantFrom('semgrep', 'trivy', 'gitleaks'),
              codeSnippet: fc.string({ minLength: 10, maxLength: 200 })
            }),
            userId: fc.hexaString({ minLength: 24, maxLength: 24 }),
            // Generate valid JavaScript/TypeScript code snippets only
            fixedCode: fc.constantFrom(
              'const x = 1;',
              'function test() { return true; }',
              'export default class Test {}',
              'const result = { key: "value" };'
            )
          }),
          async (testData) => {
            // Step 1: Create a vulnerability with Pending status
            const vulnerability = new Vulnerability({
              reportId: new Types.ObjectId(),
              repositoryId: new Types.ObjectId(),
              type: testData.vulnerabilityData.type,
              severity: testData.vulnerabilityData.severity,
              title: testData.vulnerabilityData.title,
              description: testData.vulnerabilityData.description,
              filePath: testData.vulnerabilityData.filePath,
              lineNumber: testData.vulnerabilityData.lineNumber,
              scanner: testData.vulnerabilityData.scanner,
              fixStatus: 'pending',
              codeSnippet: testData.vulnerabilityData.codeSnippet,
              metadata: {}
            });
            await vulnerability.save();

            // Property: Initial status must be Pending
            expect(vulnerability.fixStatus).toBe('pending');
            
            // Verify status is persisted in database
            const dbVulnPending = await Vulnerability.findById(vulnerability._id);
            expect(dbVulnPending?.fixStatus).toBe('pending');

            // Step 2: Update status to In Progress (when user starts editing)
            await fixManager.updateFixStatus(vulnerability._id.toString(), 'in_progress');
            
            // Property: Status must progress to In Progress
            const dbVulnInProgress = await Vulnerability.findById(vulnerability._id);
            expect(dbVulnInProgress?.fixStatus).toBe('in_progress');
            
            // Verify updatedAt timestamp changed
            expect(dbVulnInProgress?.updatedAt.getTime()).toBeGreaterThan(
              dbVulnPending?.updatedAt.getTime() || 0
            );

            // Step 3: Create test file for the vulnerability
            const testFilePath = path.join(tempDir, testData.vulnerabilityData.filePath);
            await fs.mkdir(path.dirname(testFilePath), { recursive: true });
            await fs.writeFile(testFilePath, testData.vulnerabilityData.codeSnippet, 'utf-8');

            // Step 4: Apply manual fix (completes the fix)
            await fixManager.applyManualFix(
              vulnerability._id.toString(),
              testData.userId,
              testData.fixedCode,
              tempDir
            );

            // Property: Status must progress to Fixed after applying fix
            const dbVulnFixed = await Vulnerability.findById(vulnerability._id);
            expect(dbVulnFixed?.fixStatus).toBe('fixed');
            
            // Verify updatedAt timestamp changed again
            expect(dbVulnFixed?.updatedAt.getTime()).toBeGreaterThan(
              dbVulnInProgress?.updatedAt.getTime() || 0
            );

            // Step 5: Verify fix record was created in database
            const fixRecord = await Fix.findOne({ vulnerabilityId: vulnerability._id });
            expect(fixRecord).not.toBeNull();
            expect(fixRecord?.type).toBe('manual');
            expect(fixRecord?.userId.toString()).toBe(testData.userId);
            expect(fixRecord?.originalCode).toBe(testData.vulnerabilityData.codeSnippet);
            expect(fixRecord?.fixedCode).toBe(testData.fixedCode);
            expect(fixRecord?.appliedAt).toBeInstanceOf(Date);

            // Property: Fix status progression means:
            // 1. Status starts at Pending ✓
            // 2. Status can be updated to In Progress ✓
            // 3. Status progresses to Fixed after applying fix ✓
            // 4. All status updates are persisted to database ✓
            // 5. Fix details are stored in database ✓
            // 6. updatedAt timestamp changes with each status update ✓
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: devsecops-platform, Property 18: Syntax Validation Prevents Invalid Saves
  // **Validates: Requirements 5.2, 5.5**
  describe('Property 18: Syntax Validation Prevents Invalid Saves', () => {
    it('property: code with syntax errors cannot be saved and validation errors are returned', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary vulnerability data with invalid code
          fc.record({
            vulnerabilityData: fc.record({
              type: fc.constantFrom('code', 'dependency', 'secret'),
              severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
              title: fc.string({ minLength: 10, maxLength: 100 }),
              description: fc.string({ minLength: 20, maxLength: 200 }),
              filePath: fc.constantFrom('src/index.ts', 'src/utils.js'),
              lineNumber: fc.integer({ min: 1, max: 1000 }),
              scanner: fc.constantFrom('semgrep', 'trivy', 'gitleaks'),
              codeSnippet: fc.constant('const x = 1;')
            }),
            userId: fc.hexaString({ minLength: 24, maxLength: 24 }),
            invalidCode: fc.constantFrom(
              'function test() { return;',  // Missing closing brace
              'const x = {a: 1, b: 2;',     // Missing closing brace
              'if (true) { console.log("test")',  // Missing closing brace
              'const arr = [1, 2, 3;',      // Mismatched brackets
              'function() { return })',     // Extra closing paren
            )
          }),
          async (testData) => {
            // Create a temporary directory for this test iteration
            const testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fix-validation-test-'));
            
            try {
              // Step 1: Create a vulnerability
              const vulnerability = new Vulnerability({
                reportId: new Types.ObjectId(),
                repositoryId: new Types.ObjectId(),
                type: testData.vulnerabilityData.type,
                severity: testData.vulnerabilityData.severity,
                title: testData.vulnerabilityData.title,
                description: testData.vulnerabilityData.description,
                filePath: testData.vulnerabilityData.filePath,
                lineNumber: testData.vulnerabilityData.lineNumber,
                scanner: testData.vulnerabilityData.scanner,
                fixStatus: 'pending',
                codeSnippet: testData.vulnerabilityData.codeSnippet,
                metadata: {}
              });
              await vulnerability.save();

              // Step 2: Create test file
              const testFilePath = path.join(testTempDir, testData.vulnerabilityData.filePath);
              await fs.mkdir(path.dirname(testFilePath), { recursive: true });
              await fs.writeFile(testFilePath, testData.vulnerabilityData.codeSnippet, 'utf-8');

              // Step 3: Attempt to apply fix with invalid code
              let errorThrown = false;
              let errorMessage = '';
              
              try {
                await fixManager.applyManualFix(
                  vulnerability._id.toString(),
                  testData.userId,
                  testData.invalidCode,
                  testTempDir
                );
              } catch (error) {
                errorThrown = true;
                errorMessage = error instanceof Error ? error.message : 'Unknown error';
              }

              // Property: Invalid code must throw an error
              expect(errorThrown).toBe(true);
              expect(errorMessage).toContain('Code validation failed');

              // Property: Vulnerability status must remain unchanged (not saved)
              const dbVuln = await Vulnerability.findById(vulnerability._id);
              expect(dbVuln?.fixStatus).toBe('pending');

              // Property: No fix record should be created for invalid code
              const fixRecord = await Fix.findOne({ vulnerabilityId: vulnerability._id });
              expect(fixRecord).toBeNull();

              // Step 4: Verify validation errors are returned
              const validation = await fixManager.validateFix(
                testData.vulnerabilityData.filePath,
                testData.invalidCode
              );

              // Property: Validation must return isValid: false
              expect(validation.isValid).toBe(false);
              
              // Property: Validation must return error details
              expect(validation.errors).toBeDefined();
              expect(validation.errors.length).toBeGreaterThan(0);
              expect(validation.errors[0].message).toBeDefined();

              // Property: Syntax validation prevents invalid saves means:
              // 1. Invalid code throws an error ✓
              // 2. Error message indicates validation failure ✓
              // 3. Vulnerability status remains unchanged ✓
              // 4. No fix record is created ✓
              // 5. Validation errors are returned to user ✓
            } finally {
              // Clean up test directory for this iteration
              await fs.rm(testTempDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });


  // Feature: devsecops-platform, Property 20: AI Fix Request Completeness
  // **Validates: Requirements 6.1**
  describe('Property 20: AI Fix Request Completeness', () => {
    it('property: AI requests include all required context (vulnerability details, code snippet, surrounding context)', async () => {
      // Set up environment variable for GeminiService
      const originalApiKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'test-api-key-for-property-testing';

      try {
        await fc.assert(
          fc.asyncProperty(
            // Generate arbitrary vulnerability data
            fc.record({
              vulnerabilityData: fc.record({
                type: fc.constantFrom('code', 'dependency', 'secret'),
                severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
                title: fc.string({ minLength: 10, maxLength: 100 }),
                description: fc.string({ minLength: 20, maxLength: 200 }),
                filePath: fc.constantFrom('src/index.ts', 'src/utils.js', 'app.py'),
                lineNumber: fc.integer({ min: 1, max: 1000 }),
                scanner: fc.constantFrom('semgrep', 'trivy', 'gitleaks'),
                codeSnippet: fc.constant('const password = "hardcoded123";')
              }),
              codeContext: fc.string({ minLength: 50, maxLength: 500 })
            }),
            async (testData) => {
              // Step 1: Create a vulnerability
              const vulnerability = new Vulnerability({
                reportId: new Types.ObjectId(),
                repositoryId: new Types.ObjectId(),
                type: testData.vulnerabilityData.type,
                severity: testData.vulnerabilityData.severity,
                title: testData.vulnerabilityData.title,
                description: testData.vulnerabilityData.description,
                filePath: testData.vulnerabilityData.filePath,
                lineNumber: testData.vulnerabilityData.lineNumber,
                scanner: testData.vulnerabilityData.scanner,
                fixStatus: 'pending',
                codeSnippet: testData.vulnerabilityData.codeSnippet,
                metadata: {}
              });
              await vulnerability.save();

              // Step 2: Build prompt for AI fix request
              const { GeminiService } = await import('../../services/GeminiService');
              const geminiService = new GeminiService();
              const prompt = geminiService.buildPrompt(vulnerability, testData.codeContext);

              // Property: Prompt must include vulnerability type
              expect(prompt).toContain(testData.vulnerabilityData.type);

              // Property: Prompt must include severity level
              expect(prompt).toContain(testData.vulnerabilityData.severity);

              // Property: Prompt must include vulnerability title
              expect(prompt).toContain(testData.vulnerabilityData.title);

              // Property: Prompt must include vulnerability description
              expect(prompt).toContain(testData.vulnerabilityData.description);

              // Property: Prompt must include scanner name
              expect(prompt).toContain(testData.vulnerabilityData.scanner);

              // Property: Prompt must include file path
              expect(prompt).toContain(testData.vulnerabilityData.filePath);

              // Property: Prompt must include line number
              expect(prompt).toContain(testData.vulnerabilityData.lineNumber.toString());

              // Property: Prompt must include vulnerable code snippet
              expect(prompt).toContain(testData.vulnerabilityData.codeSnippet);

              // Property: Prompt must include surrounding code context
              expect(prompt).toContain(testData.codeContext);

              // Property: AI fix request completeness means:
              // 1. Vulnerability type is included ✓
              // 2. Severity level is included ✓
              // 3. Title is included ✓
              // 4. Description is included ✓
              // 5. Scanner name is included ✓
              // 6. File path is included ✓
              // 7. Line number is included ✓
              // 8. Vulnerable code snippet is included ✓
              // 9. Surrounding code context is included ✓
            }
          ),
          { numRuns: 5 }
        );
      } finally {
        // Restore original API key
        if (originalApiKey) {
          process.env.GEMINI_API_KEY = originalApiKey;
        } else {
          delete process.env.GEMINI_API_KEY;
        }
      }
    });
  });

  // Feature: devsecops-platform, Property 21: AI Model Specification
  // **Validates: Requirements 6.7**
  describe('Property 21: AI Model Specification', () => {
    it('property: all AI requests specify gemini-2.0-flash-exp model', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary test data
          fc.record({
            apiKey: fc.string({ minLength: 20, maxLength: 50 })
          }),
          async (testData) => {
            // Set up environment variable for testing
            const originalApiKey = process.env.GEMINI_API_KEY;
            process.env.GEMINI_API_KEY = testData.apiKey;

            try {
              // Step 1: Create GeminiService instance
              const geminiService = new (await import('../../services/GeminiService')).GeminiService();

              // Property: Service must use gemini-2.0-flash-exp model
              const modelName = geminiService.getModelName();
              expect(modelName).toBe('gemini-2.0-flash-exp');

              // Property: AI model specification means:
              // 1. Model name is exactly 'gemini-2.0-flash-exp' ✓
              // 2. Model name is retrievable from service ✓
            } finally {
              // Restore original API key
              if (originalApiKey) {
                process.env.GEMINI_API_KEY = originalApiKey;
              } else {
                delete process.env.GEMINI_API_KEY;
              }
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: devsecops-platform, Property 23: AI Fix Application Updates Status
  // **Validates: Requirements 6.3, 6.4**
  describe('Property 23: AI Fix Application Updates Status', () => {
    it('property: approved AI fixes update vulnerability status to Fixed and store fix details in database', async () => {
      // Set up environment variable for GeminiService
      const originalApiKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'test-api-key-for-property-testing';

      try {
        await fc.assert(
          fc.asyncProperty(
            // Generate arbitrary vulnerability and fix data
            fc.record({
              vulnerabilityData: fc.record({
                type: fc.constantFrom('code', 'dependency', 'secret'),
                severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
                title: fc.string({ minLength: 10, maxLength: 100 }),
                description: fc.string({ minLength: 20, maxLength: 200 }),
                filePath: fc.constantFrom('src/index.ts', 'src/utils.js', 'app.py'),
                lineNumber: fc.integer({ min: 1, max: 1000 }),
                scanner: fc.constantFrom('semgrep', 'trivy', 'gitleaks'),
                codeSnippet: fc.constant('const password = "hardcoded123";')
              }),
              userId: fc.hexaString({ minLength: 24, maxLength: 24 }),
              fixedCode: fc.constant('const password = process.env.PASSWORD;'),
              explanation: fc.string({ minLength: 20, maxLength: 200 }),
              confidence: fc.double({ min: 0.5, max: 1.0 })
            }),
            async (testData) => {
              // Create a temporary directory for this test iteration
              const testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-fix-test-'));
              
              try {
                // Step 1: Create a vulnerability
                const vulnerability = new Vulnerability({
                  reportId: new Types.ObjectId(),
                  repositoryId: new Types.ObjectId(),
                  type: testData.vulnerabilityData.type,
                  severity: testData.vulnerabilityData.severity,
                  title: testData.vulnerabilityData.title,
                  description: testData.vulnerabilityData.description,
                  filePath: testData.vulnerabilityData.filePath,
                  lineNumber: testData.vulnerabilityData.lineNumber,
                  scanner: testData.vulnerabilityData.scanner,
                  fixStatus: 'pending',
                  codeSnippet: testData.vulnerabilityData.codeSnippet,
                  metadata: {}
                });
                await vulnerability.save();

                // Step 2: Create test file
                const testFilePath = path.join(testTempDir, testData.vulnerabilityData.filePath);
                await fs.mkdir(path.dirname(testFilePath), { recursive: true });
                await fs.writeFile(testFilePath, testData.vulnerabilityData.codeSnippet, 'utf-8');

                // Step 3: Create a mock AI fix proposal
                const proposal = {
                  id: `${vulnerability._id.toString()}-${Date.now()}`,
                  vulnerabilityId: vulnerability._id.toString(),
                  originalCode: testData.vulnerabilityData.codeSnippet,
                  fixedCode: testData.fixedCode,
                  explanation: testData.explanation,
                  confidence: testData.confidence
                };

                // Manually add proposal to pending proposals (simulating requestAIFix)
                const fixManagerInstance = new FixManager();
                // Access the private pendingProposals map through a test helper
                (fixManagerInstance as any).constructor.prototype.addTestProposal = function(p: any) {
                  const pendingProposals = (this.constructor as any).pendingProposals || new Map();
                  pendingProposals.set(p.id, p);
                };
                
                // For testing, we'll use the clearPendingProposals and then manually set
                fixManagerInstance.clearPendingProposals();
                
                // Import the module to access the pendingProposals map
                const FixManagerModule = await import('../../services/FixManager');
                const pendingProposalsMap = (FixManagerModule as any).pendingProposals;
                if (pendingProposalsMap) {
                  pendingProposalsMap.set(proposal.id, proposal);
                }

                // Step 4: Approve the AI fix
                await fixManagerInstance.approveAIFix(
                  proposal.id,
                  testData.userId,
                  testTempDir
                );

                // Property: Vulnerability status must be updated to Fixed
                const dbVuln = await Vulnerability.findById(vulnerability._id);
                expect(dbVuln?.fixStatus).toBe('fixed');

                // Property: Fix record must be created in database
                const fixRecord = await Fix.findOne({ vulnerabilityId: vulnerability._id });
                expect(fixRecord).not.toBeNull();
                expect(fixRecord?.type).toBe('ai');
                expect(fixRecord?.userId.toString()).toBe(testData.userId);
                expect(fixRecord?.originalCode).toBe(testData.vulnerabilityData.codeSnippet);
                expect(fixRecord?.fixedCode).toBe(testData.fixedCode);

                // Property: AI proposal metadata must be stored
                expect(fixRecord?.aiProposal).toBeDefined();
                expect(fixRecord?.aiProposal?.explanation).toBe(testData.explanation);
                expect(fixRecord?.aiProposal?.confidence).toBe(testData.confidence);
                expect(fixRecord?.aiProposal?.model).toBe('gemini-2.0-flash-exp');

                // Property: Applied timestamp must be set
                expect(fixRecord?.appliedAt).toBeInstanceOf(Date);

                // Property: Fixed code must be written to file
                const fileContent = await fs.readFile(testFilePath, 'utf-8');
                expect(fileContent).toBe(testData.fixedCode);

                // Property: Proposal must be removed from pending after approval
                const retrievedProposal = fixManagerInstance.getAIFixProposal(proposal.id);
                expect(retrievedProposal).toBeUndefined();

                // Property: AI fix application updates status means:
                // 1. Vulnerability status is updated to Fixed ✓
                // 2. Fix record is created in database ✓
                // 3. Fix type is 'ai' ✓
                // 4. AI proposal metadata is stored ✓
                // 5. Fixed code is written to file ✓
                // 6. Proposal is removed from pending ✓
              } finally {
                // Clean up test directory
                await fs.rm(testTempDir, { recursive: true, force: true });
              }
            }
          ),
          { numRuns: 5 }
        );
      } finally {
        // Restore original API key
        if (originalApiKey) {
          process.env.GEMINI_API_KEY = originalApiKey;
        } else {
          delete process.env.GEMINI_API_KEY;
        }
      }
    });
  });
});

