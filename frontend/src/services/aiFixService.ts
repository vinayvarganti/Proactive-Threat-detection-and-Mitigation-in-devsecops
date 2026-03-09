import axios from 'axios';
import { Vulnerability } from './vulnerabilityService';

export interface AIFixProposal {
  id: string;
  vulnerabilityId: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
  confidence: number;
}

export interface AIFixRequest {
  vulnerabilityId: string;
}

export interface AIFixResponse {
  proposal: AIFixProposal;
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    suggestedAction?: string;
  };
  timestamp: Date;
  requestId: string;
}

class AIFixService {
  private baseURL = '/api/fixes';

  /**
   * Requests an AI-generated fix for a vulnerability
   */
  async requestAIFix(vulnerability: Vulnerability): Promise<AIFixProposal> {
    try {
      const response = await axios.post<AIFixResponse>(`${this.baseURL}/ai`, {
        vulnerabilityId: vulnerability.id
      });

      return response.data.proposal;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(errorData.error.message || 'Failed to request AI fix');
      }
      throw new Error('Failed to request AI fix');
    }
  }

  /**
   * Approves an AI-generated fix proposal
   */
  async approveProposal(proposalId: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/ai/${proposalId}/approve`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(errorData.error.message || 'Failed to approve fix');
      }
      throw new Error('Failed to approve fix');
    }
  }

  /**
   * Rejects an AI-generated fix proposal
   */
  async rejectProposal(proposalId: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/ai/${proposalId}/reject`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(errorData.error.message || 'Failed to reject fix');
      }
      throw new Error('Failed to reject fix');
    }
  }
}

export const aiFixService = new AIFixService();
