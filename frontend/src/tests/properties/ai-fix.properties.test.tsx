import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import AIFix from '../../components/AIFix';
import { Vulnerability, SeverityLevel, VulnerabilityType, Scanner, FixStatus } from '../../services/vulnerabilityService';
import { aiFixService, AIFixProposal } from '../../services/aiFixService';

// Mock the AI fix service
jest.mock('../../services/aiFixService', () => ({
  aiFixService: {
    requestAIFix: jest.fn(),
    approveProposal: jest.fn(),
    rejectProposal: jest.fn()
  }
}));

describe('AI Fix Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Feature: devsecops-platform, Property 22: AI Fix Proposal Display
   * 
   * For any successful AI fix response, the platform should display the proposal 
   * with original code, fixed code, and explanation before allowing user approval.
   * 
   * Validates: Requirements 6.2
   */
  it('Property 22: AI Fix Proposal Display', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary vulnerabilities
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          type: fc.constantFrom<VulnerabilityType>('code', 'dependency', 'secret'),
          severity: fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low'),
          title: fc.string({ minLength: 5, maxLength: 100 }),
          description: fc.string({ minLength: 10, maxLength: 500 }),
          filePath: fc.string({ minLength: 5, maxLength: 200 }).map(s => `src/${s}.ts`),
          lineNumber: fc.integer({ min: 1, max: 1000 }),
          scanner: fc.constantFrom<Scanner>('semgrep', 'trivy', 'gitleaks'),
          fixStatus: fc.constantFrom<FixStatus>('pending', 'in_progress', 'fixed', 'verified'),
          codeSnippet: fc.string({ minLength: 10, maxLength: 200 }),
          repositoryId: fc.string({ minLength: 1, maxLength: 50 })
        }),
        // Generate arbitrary AI fix proposals
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          originalCode: fc.string({ minLength: 20, maxLength: 500 }),
          fixedCode: fc.string({ minLength: 20, maxLength: 500 }),
          explanation: fc.string({ minLength: 20, maxLength: 500 }),
          confidence: fc.double({ min: 0, max: 1 })
        }),
        async (vulnerability: Vulnerability, proposalData: Omit<AIFixProposal, 'vulnerabilityId'>) => {
          const proposal: AIFixProposal = {
            ...proposalData,
            vulnerabilityId: vulnerability.id
          };

          // Mock the AI fix service to return the generated proposal
          (aiFixService.requestAIFix as jest.Mock).mockResolvedValueOnce(proposal);

          const user = userEvent.setup();
          const { unmount } = render(<AIFix vulnerability={vulnerability} />);

          // Request AI fix
          const requestButton = screen.getByRole('button', { name: /request ai fix/i });
          await user.click(requestButton);

          // Wait for proposal to be displayed
          await waitFor(
            () => {
              expect(screen.getByText('Proposed Fix')).toBeInTheDocument();
            },
            { timeout: 3000 }
          );

          // Property: Original code must be displayed
          expect(screen.getByText('Original Code:')).toBeInTheDocument();
          expect(screen.getByText(proposal.originalCode)).toBeInTheDocument();

          // Property: Fixed code must be displayed
          expect(screen.getByText('Fixed Code:')).toBeInTheDocument();
          expect(screen.getByText(proposal.fixedCode)).toBeInTheDocument();

          // Property: Explanation must be displayed
          expect(screen.getByText('Explanation:')).toBeInTheDocument();
          expect(screen.getByText(proposal.explanation)).toBeInTheDocument();

          // Property: Confidence must be displayed
          const confidencePercent = Math.round(proposal.confidence * 100);
          expect(screen.getByText(`Confidence: ${confidencePercent}%`)).toBeInTheDocument();

          // Property: Approve and Reject buttons must be present
          expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();

          // Property: Alternative options must be available
          expect(screen.getByRole('button', { name: /retry ai fix/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /manual correction/i })).toBeInTheDocument();

          // Cleanup
          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 30000); // Increase timeout for property test

  /**
   * Property: AI fix proposals should handle various confidence levels
   */
  it('should display confidence levels correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1 }),
          type: fc.constantFrom<VulnerabilityType>('code', 'dependency', 'secret'),
          severity: fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low'),
          title: fc.string({ minLength: 5 }),
          description: fc.string({ minLength: 10 }),
          filePath: fc.string({ minLength: 5 }).map(s => `src/${s}.ts`),
          lineNumber: fc.integer({ min: 1, max: 1000 }),
          scanner: fc.constantFrom<Scanner>('semgrep', 'trivy', 'gitleaks'),
          fixStatus: fc.constantFrom<FixStatus>('pending', 'in_progress', 'fixed', 'verified'),
          codeSnippet: fc.string({ minLength: 10 }),
          repositoryId: fc.string({ minLength: 1 })
        }),
        fc.double({ min: 0, max: 1 }),
        async (vulnerability: Vulnerability, confidence: number) => {
          const proposal: AIFixProposal = {
            id: 'test-proposal',
            vulnerabilityId: vulnerability.id,
            originalCode: 'original code',
            fixedCode: 'fixed code',
            explanation: 'test explanation',
            confidence: confidence
          };

          (aiFixService.requestAIFix as jest.Mock).mockResolvedValueOnce(proposal);

          const user = userEvent.setup();
          const { unmount } = render(<AIFix vulnerability={vulnerability} />);

          const requestButton = screen.getByRole('button', { name: /request ai fix/i });
          await user.click(requestButton);

          await waitFor(() => {
            expect(screen.getByText('Proposed Fix')).toBeInTheDocument();
          });

          // Property: Confidence should be displayed as percentage
          const confidencePercent = Math.round(confidence * 100);
          expect(screen.getByText(`Confidence: ${confidencePercent}%`)).toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 15000);

  /**
   * Property: AI fix workflow should handle approval correctly
   */
  it('should handle approval workflow for any proposal', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1 }),
          vulnerabilityId: fc.string({ minLength: 1 }),
          originalCode: fc.string({ minLength: 20, maxLength: 200 }),
          fixedCode: fc.string({ minLength: 20, maxLength: 200 }),
          explanation: fc.string({ minLength: 20, maxLength: 200 }),
          confidence: fc.double({ min: 0, max: 1 })
        }),
        async (proposal: AIFixProposal) => {
          const vulnerability: Vulnerability = {
            id: proposal.vulnerabilityId,
            type: 'code',
            severity: 'high',
            title: 'Test Vulnerability',
            description: 'Test description',
            filePath: 'src/test.ts',
            lineNumber: 10,
            scanner: 'semgrep',
            fixStatus: 'pending',
            codeSnippet: 'test snippet',
            repositoryId: 'repo-1'
          };

          (aiFixService.requestAIFix as jest.Mock).mockResolvedValueOnce(proposal);
          (aiFixService.approveProposal as jest.Mock).mockResolvedValueOnce(undefined);

          const onApprove = jest.fn();
          const user = userEvent.setup();
          const { unmount } = render(<AIFix vulnerability={vulnerability} onApprove={onApprove} />);

          // Request fix
          const requestButton = screen.getByRole('button', { name: /request ai fix/i });
          await user.click(requestButton);

          await waitFor(() => {
            expect(screen.getByText('Proposed Fix')).toBeInTheDocument();
          });

          // Approve fix
          const approveButton = screen.getByRole('button', { name: /approve/i });
          await user.click(approveButton);

          await waitFor(() => {
            expect(aiFixService.approveProposal).toHaveBeenCalledWith(proposal.id);
          });

          // Property: onApprove callback should be called with the proposal
          expect(onApprove).toHaveBeenCalledWith(proposal);

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 15000);

  /**
   * Property: AI fix workflow should handle rejection correctly
   */
  it('should handle rejection workflow for any proposal', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1 }),
          vulnerabilityId: fc.string({ minLength: 1 }),
          originalCode: fc.string({ minLength: 20, maxLength: 200 }),
          fixedCode: fc.string({ minLength: 20, maxLength: 200 }),
          explanation: fc.string({ minLength: 20, maxLength: 200 }),
          confidence: fc.double({ min: 0, max: 1 })
        }),
        async (proposal: AIFixProposal) => {
          const vulnerability: Vulnerability = {
            id: proposal.vulnerabilityId,
            type: 'code',
            severity: 'high',
            title: 'Test Vulnerability',
            description: 'Test description',
            filePath: 'src/test.ts',
            lineNumber: 10,
            scanner: 'semgrep',
            fixStatus: 'pending',
            codeSnippet: 'test snippet',
            repositoryId: 'repo-1'
          };

          (aiFixService.requestAIFix as jest.Mock).mockResolvedValueOnce(proposal);
          (aiFixService.rejectProposal as jest.Mock).mockResolvedValueOnce(undefined);

          const onReject = jest.fn();
          const user = userEvent.setup();
          const { unmount } = render(<AIFix vulnerability={vulnerability} onReject={onReject} />);

          // Request fix
          const requestButton = screen.getByRole('button', { name: /request ai fix/i });
          await user.click(requestButton);

          await waitFor(() => {
            expect(screen.getByText('Proposed Fix')).toBeInTheDocument();
          });

          // Reject fix
          const rejectButton = screen.getByRole('button', { name: /reject/i });
          await user.click(rejectButton);

          await waitFor(() => {
            expect(aiFixService.rejectProposal).toHaveBeenCalledWith(proposal.id);
          });

          // Property: onReject callback should be called
          expect(onReject).toHaveBeenCalled();

          // Property: Proposal should be cleared after rejection
          await waitFor(() => {
            expect(screen.queryByText('Proposed Fix')).not.toBeInTheDocument();
          });

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 15000);
});

