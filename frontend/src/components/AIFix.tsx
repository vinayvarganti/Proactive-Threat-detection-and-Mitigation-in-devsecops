import React, { useState } from 'react';
import { Vulnerability } from '../services/vulnerabilityService';
import { aiFixService, AIFixProposal } from '../services/aiFixService';
import './AIFix.css';

interface AIFixProps {
  vulnerability: Vulnerability;
  onApprove?: (proposal: AIFixProposal) => void;
  onReject?: () => void;
  onManualCorrection?: () => void;
}

const AIFix: React.FC<AIFixProps> = ({ 
  vulnerability
}) => {
  const [proposal, setProposal] = useState<AIFixProposal | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestFix = async () => {
    try {
      setLoading(true);
      setError(null);
      setProposal(null);

      const fixProposal = await aiFixService.requestAIFix(vulnerability);
      setProposal(fixProposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request AI fix');
      console.error('AI fix request error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-fix-container">
      <div className="ai-fix-header">
        <h3>AI-Assisted Fix</h3>
        <div className="vulnerability-info">
          <span className={`severity-badge ${vulnerability.severity}`}>
            {vulnerability.severity.toUpperCase()}
          </span>
          <span className="vulnerability-title">{vulnerability.title}</span>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
          <button 
            onClick={() => setError(null)}
            className="error-dismiss"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {!proposal && !loading && (
        <div className="ai-fix-request">
          <p className="description">
            Request an AI-generated fix for this vulnerability. The AI will analyze 
            the code and suggest a secure solution.
          </p>
          <button
            onClick={handleRequestFix}
            className="request-button"
            aria-label="Request AI fix"
          >
            Request AI Fix
          </button>
        </div>
      )}

      {loading && (
        <div className="ai-fix-loading">
          <div className="loading-spinner" />
          <p>AI is analyzing the vulnerability and generating a fix...</p>
        </div>
      )}

      {proposal && (
        <div className="ai-fix-proposal">
          <div className="proposal-header">
            <h4>AI-Generated Fix</h4>
            <div className="confidence-badge">
              Confidence: {Math.round(proposal.confidence * 100)}%
            </div>
          </div>

          <div className="proposal-explanation">
            <h5>Explanation:</h5>
            <p>{proposal.explanation}</p>
          </div>

          <div className="code-diff">
            <div className="code-section original">
              <h5>Original Code:</h5>
              <pre>
                <code>{proposal.originalCode}</code>
              </pre>
            </div>

            <div className="code-section fixed">
              <h5>Fixed Code:</h5>
              <pre>
                <code>{proposal.fixedCode}</code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {error && !loading && !proposal && (
        <div className="error-recovery">
          <p>Failed to generate AI fix. Please try again.</p>
        </div>
      )}
    </div>
  );
};

export default AIFix;
