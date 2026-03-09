import { FixManager, pendingProposals } from '../../services/FixManager';
import Vulnerability from '../../models/Vulnerability';
import Fix from '../../models/Fix';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('FixManager Unit Tests', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fix-manager-test-'));
    // Clear pending proposals before each test
    fixManager.clearPendingProposals();
    // Set API key for GeminiService
    process.env.GEMINI_API_KEY = 'test-api-key-for-unit-testing';
  });

  afterEach(async () => {
    await Vulnerability.deleteMany({});
    await Fix.deleteMany({});
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('AI Fix Approval Workflow', () => {
    it('should approve and apply an AI fix successfully', async () => {
      // Create a vulnerability
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'high',
        title: 'Hardcoded password',
        description: 'Password is hardcoded in source code',
        filePath: 'src/config.ts',
        lineNumber: 10,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'const password = "hardcoded123";',
        metadata: {}
      });
      await vulnerability.save();

      // Create test file
      const testFilePath = path.join(tempDir, 'src/config.ts');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, 'const password = "hardcoded123";', 'utf-8');

      // Create a mock AI fix proposal
      const proposal = {
        id: `${vulnerability._id.toString()}-${Date.now()}`,
        vulnerabilityId: vulnerability._id.toString(),
        originalCode: 'const password = "hardcoded123";',
        fixedCode: 'const password = process.env.PASSWORD;',
        explanation: 'Replaced hardcoded password with environment variable',
        confidence: 0.95
      };

      // Manually add proposal to pending (simulating requestAIFix)
      pendingProposals.set(proposal.id, proposal);

      // Approve the fix
      const userId = new Types.ObjectId().toString();
      await fixManager.approveAIFix(proposal.id, userId, tempDir);

      // Verify vulnerability status updated
      const updatedVuln = await Vulnerability.findById(vulnerability._id);
      expect(updatedVuln?.fixStatus).toBe('fixed');

      // Verify fix record created
      const fixRecord = await Fix.findOne({ vulnerabilityId: vulnerability._id });
      expect(fixRecord).not.toBeNull();
      expect(fixRecord?.type).toBe('ai');
      expect(fixRecord?.fixedCode).toBe('const password = process.env.PASSWORD;');
      expect(fixRecord?.aiProposal?.explanation).toBe('Replaced hardcoded password with environment variable');
      expect(fixRecord?.aiProposal?.confidence).toBe(0.95);
      expect(fixRecord?.aiProposal?.model).toBe('gemini-2.0-flash-exp');

      // Verify file updated
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('const password = process.env.PASSWORD;');

      // Verify proposal removed from pending
      const retrievedProposal = fixManager.getAIFixProposal(proposal.id);
      expect(retrievedProposal).toBeUndefined();
    });

    it('should throw error when approving non-existent proposal', async () => {
      const userId = new Types.ObjectId().toString();
      
      await expect(
        fixManager.approveAIFix('non-existent-id', userId, tempDir)
      ).rejects.toThrow('AI fix proposal not found or expired');
    });

    it('should throw error when vulnerability not found during approval', async () => {
      const proposal = {
        id: 'test-proposal-id',
        vulnerabilityId: new Types.ObjectId().toString(),
        originalCode: 'const x = 1;',
        fixedCode: 'const x = 2;',
        explanation: 'Test fix',
        confidence: 0.9
      };

      // Add proposal to pending
      pendingProposals.set(proposal.id, proposal);

      const userId = new Types.ObjectId().toString();
      
      await expect(
        fixManager.approveAIFix(proposal.id, userId, tempDir)
      ).rejects.toThrow('Vulnerability not found');
    });

    it('should throw error when AI-generated code fails validation', async () => {
      // Create a vulnerability
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'high',
        title: 'Test vulnerability',
        description: 'Test description',
        filePath: 'src/test.ts',
        lineNumber: 5,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'const x = 1;',
        metadata: {}
      });
      await vulnerability.save();

      // Create test file
      const testFilePath = path.join(tempDir, 'src/test.ts');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, 'const x = 1;', 'utf-8');

      // Create a proposal with invalid code
      const proposal = {
        id: `${vulnerability._id.toString()}-${Date.now()}`,
        vulnerabilityId: vulnerability._id.toString(),
        originalCode: 'const x = 1;',
        fixedCode: 'const x = {a: 1, b: 2;', // Invalid syntax
        explanation: 'Test fix with invalid syntax',
        confidence: 0.8
      };

      // Add proposal to pending
      pendingProposals.set(proposal.id, proposal);

      const userId = new Types.ObjectId().toString();
      
      await expect(
        fixManager.approveAIFix(proposal.id, userId, tempDir)
      ).rejects.toThrow('AI-generated code validation failed');

      // Verify vulnerability status unchanged
      const updatedVuln = await Vulnerability.findById(vulnerability._id);
      expect(updatedVuln?.fixStatus).toBe('pending');

      // Verify no fix record created
      const fixRecord = await Fix.findOne({ vulnerabilityId: vulnerability._id });
      expect(fixRecord).toBeNull();
    });
  });

  describe('AI Fix Rejection Workflow', () => {
    it('should reject an AI fix and return alternative options', async () => {
      const proposal = {
        id: 'test-proposal-id',
        vulnerabilityId: new Types.ObjectId().toString(),
        originalCode: 'const x = 1;',
        fixedCode: 'const x = 2;',
        explanation: 'Test fix',
        confidence: 0.9
      };

      // Add proposal to pending
      pendingProposals.set(proposal.id, proposal);

      // Reject the fix
      const result = await fixManager.rejectAIFix(proposal.id);

      // Verify result contains options
      expect(result.options).toContain('retry');
      expect(result.options).toContain('manual');
      expect(result.message).toContain('AI fix rejected');
      expect(result.message).toContain('retry');
      expect(result.message).toContain('manual correction');

      // Verify proposal removed from pending
      const retrievedProposal = fixManager.getAIFixProposal(proposal.id);
      expect(retrievedProposal).toBeUndefined();
    });

    it('should throw error when rejecting non-existent proposal', async () => {
      await expect(
        fixManager.rejectAIFix('non-existent-id')
      ).rejects.toThrow('AI fix proposal not found or expired');
    });
  });

  describe('Proposal Management', () => {
    it('should retrieve a pending proposal by ID', () => {
      const proposal = {
        id: 'test-proposal-id',
        vulnerabilityId: new Types.ObjectId().toString(),
        originalCode: 'const x = 1;',
        fixedCode: 'const x = 2;',
        explanation: 'Test fix',
        confidence: 0.9
      };

      // Add proposal to pending
      pendingProposals.set(proposal.id, proposal);

      // Retrieve proposal
      const retrieved = fixManager.getAIFixProposal(proposal.id);
      expect(retrieved).toEqual(proposal);
    });

    it('should return undefined for non-existent proposal', () => {
      const retrieved = fixManager.getAIFixProposal('non-existent-id');
      expect(retrieved).toBeUndefined();
    });

    it('should clear all pending proposals', () => {
      // Add some proposals
      pendingProposals.set('id1', { id: 'id1' } as any);
      pendingProposals.set('id2', { id: 'id2' } as any);
      
      expect(fixManager.getPendingProposalCount()).toBe(2);
      
      fixManager.clearPendingProposals();
      
      expect(fixManager.getPendingProposalCount()).toBe(0);
    });

    it('should get correct count of pending proposals', () => {
      expect(fixManager.getPendingProposalCount()).toBe(0);
      
      pendingProposals.set('id1', { id: 'id1' } as any);
      expect(fixManager.getPendingProposalCount()).toBe(1);
      
      pendingProposals.set('id2', { id: 'id2' } as any);
      expect(fixManager.getPendingProposalCount()).toBe(2);
    });
  });
});

