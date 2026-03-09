import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AIFix from './AIFix';
import { Vulnerability } from '../services/vulnerabilityService';
import { aiFixService, AIFixProposal } from '../services/aiFixService';

// Mock the AI fix service
jest.mock('../services/aiFixService', () => ({
  aiFixService: {
    requestAIFix: jest.fn(),
    approveProposal: jest.fn(),
    rejectProposal: jest.fn()
  }
}));

describe('AIFix Component', () => {
  const mockVulnerability: Vulnerability = {
    id: 'vuln-1',
    type: 'code',
    severity: 'high',
    title: 'SQL Injection',
    description: 'Potential SQL injection vulnerability',
    filePath: 'src/database.ts',
    lineNumber: 42,
    scanner: 'semgrep',
    fixStatus: 'pending',
    codeSnippet: 'const query = "SELECT * FROM users WHERE id = " + userId;',
    repositoryId: 'repo-1'
  };

  const mockProposal: AIFixProposal = {
    id: 'proposal-1',
    vulnerabilityId: 'vuln-1',
    originalCode: 'const query = "SELECT * FROM users WHERE id = " + userId;',
    fixedCode: 'const query = "SELECT * FROM users WHERE id = ?"; db.execute(query, [userId]);',
    explanation: 'Use parameterized queries to prevent SQL injection',
    confidence: 0.95
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display request button initially', () => {
    render(<AIFix vulnerability={mockVulnerability} />);

    expect(screen.getByText('AI-Assisted Fix')).toBeInTheDocument();
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request ai fix/i })).toBeInTheDocument();
  });

  it('should request AI fix when button is clicked', async () => {
    const user = userEvent.setup();
    (aiFixService.requestAIFix as jest.Mock).mockResolvedValueOnce(mockProposal);

    render(<AIFix vulnerability={mockVulnerability} />);

    const requestButton = screen.getByRole('button', { name: /request ai fix/i });
    await user.click(requestButton);

    expect(screen.getByText(/ai is analyzing/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Proposed Fix')).toBeInTheDocument();
    });

    expect(aiFixService.requestAIFix).toHaveBeenCalledWith(mockVulnerability);
  });

  it('should display proposal with original and fixed code', async () => {
    const user = userEvent.setup();
    (aiFixService.requestAIFix as jest.Mock).mockResolvedValueOnce(mockProposal);

    render(<AIFix vulnerability={mockVulnerability} />);

    const requestButton = screen.getByRole('button', { name: /request ai fix/i });
    await user.click(requestButton);

    await waitFor(() => {
      expect(screen.getByText('Proposed Fix')).toBeInTheDocument();
    });

    expect(screen.getByText('Original Code:')).toBeInTheDocument();
    expect(screen.getByText('Fixed Code:')).toBeInTheDocument();
    expect(screen.getByText(mockProposal.originalCode)).toBeInTheDocument();
    expect(screen.getByText(mockProposal.fixedCode)).toBeInTheDocument();
    expect(screen.getByText(mockProposal.explanation)).toBeInTheDocument();
    expect(screen.getByText('Confidence: 95%')).toBeInTheDocument();
  });

  it('should approve proposal when approve button is clicked', async () => {
    const user = userEvent.setup();
    const onApprove = jest.fn();
    (aiFixService.requestAIFix as jest.Mock).mockResolvedValueOnce(mockProposal);
    (aiFixService.approveProposal as jest.Mock).mockResolvedValueOnce(undefined);

    render(<AIFix vulnerability={mockVulnerability} onApprove={onApprove} />);

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
      expect(aiFixService.approveProposal).toHaveBeenCalledWith('proposal-1');
    });

    expect(onApprove).toHaveBeenCalledWith(mockProposal);
  });

  it('should reject proposal when reject button is clicked', async () => {
    const user = userEvent.setup();
    const onReject = jest.fn();
    (aiFixService.requestAIFix as jest.Mock).mockResolvedValueOnce(mockProposal);
    (aiFixService.rejectProposal as jest.Mock).mockResolvedValueOnce(undefined);

    render(<AIFix vulnerability={mockVulnerability} onReject={onReject} />);

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
      expect(aiFixService.rejectProposal).toHaveBeenCalledWith('proposal-1');
    });

    expect(onReject).toHaveBeenCalled();
  });

  it('should provide retry option after rejection', async () => {
    const user = userEvent.setup();
    (aiFixService.requestAIFix as jest.Mock).mockResolvedValue(mockProposal);
    (aiFixService.rejectProposal as jest.Mock).mockResolvedValueOnce(undefined);

    render(<AIFix vulnerability={mockVulnerability} />);

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
      expect(screen.queryByText('Proposed Fix')).not.toBeInTheDocument();
    });

    // Retry should be available
    expect(screen.getByRole('button', { name: /retry ai fix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manual correction/i })).toBeInTheDocument();
  });

  it('should provide manual correction option', async () => {
    const user = userEvent.setup();
    const onManualCorrection = jest.fn();
    (aiFixService.requestAIFix as jest.Mock).mockResolvedValueOnce(mockProposal);

    render(<AIFix vulnerability={mockVulnerability} onManualCorrection={onManualCorrection} />);

    // Request fix
    const requestButton = screen.getByRole('button', { name: /request ai fix/i });
    await user.click(requestButton);

    await waitFor(() => {
      expect(screen.getByText('Proposed Fix')).toBeInTheDocument();
    });

    // Click manual correction
    const manualButton = screen.getByRole('button', { name: /manual correction/i });
    await user.click(manualButton);

    expect(onManualCorrection).toHaveBeenCalled();
  });

  it('should handle AI fix request errors', async () => {
    const user = userEvent.setup();
    (aiFixService.requestAIFix as jest.Mock).mockRejectedValueOnce(
      new Error('AI service unavailable')
    );

    render(<AIFix vulnerability={mockVulnerability} />);

    const requestButton = screen.getByRole('button', { name: /request ai fix/i });
    await user.click(requestButton);

    await waitFor(() => {
      expect(screen.getByText(/ai service unavailable/i)).toBeInTheDocument();
    });

    // Should offer retry and manual correction
    expect(screen.getByRole('button', { name: /retry ai fix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manual correction/i })).toBeInTheDocument();
  });

  it('should retry AI fix request', async () => {
    const user = userEvent.setup();
    (aiFixService.requestAIFix as jest.Mock)
      .mockRejectedValueOnce(new Error('AI service unavailable'))
      .mockResolvedValueOnce(mockProposal);

    render(<AIFix vulnerability={mockVulnerability} />);

    // First request fails
    const requestButton = screen.getByRole('button', { name: /request ai fix/i });
    await user.click(requestButton);

    await waitFor(() => {
      expect(screen.getByText(/ai service unavailable/i)).toBeInTheDocument();
    });

    // Retry
    const retryButton = screen.getByRole('button', { name: /retry ai fix/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Proposed Fix')).toBeInTheDocument();
    });

    expect(aiFixService.requestAIFix).toHaveBeenCalledTimes(2);
  });
});
