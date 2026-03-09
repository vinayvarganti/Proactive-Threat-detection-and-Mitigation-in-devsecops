import axios from 'axios';
import { IVulnerability } from '../models/Vulnerability';

export interface AIFixProposal {
  id: string;
  vulnerabilityId: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
  confidence: number;
}

export class GeminiService {
  private model: string = 'gemini-flash-latest';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
  }

  /**
   * Generate a fix proposal for a vulnerability using Gemini AI
   */
  async generateFix(
    vulnerability: IVulnerability,
    codeContext: string
  ): Promise<AIFixProposal> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const prompt = this.buildPrompt(vulnerability, codeContext);
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey
          }
        }
      );

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('Failed to generate fix: No content returned from AI');
      }

      return this.parseResponse(text, vulnerability);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to generate AI fix from REST API: ${error.response?.data?.error?.message || error.message}`
        );
      }
      throw new Error(
        `Failed to generate AI fix: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build a prompt for the AI model with vulnerability context
   */
  buildPrompt(vulnerability: IVulnerability, codeContext: string): string {
    const prompt = `You are a security expert helping to fix code vulnerabilities.

**Vulnerability Details:**
- Type: ${vulnerability.type}
- Severity: ${vulnerability.severity}
- Title: ${vulnerability.title}
- Description: ${vulnerability.description}
- Scanner: ${vulnerability.scanner}
- File: ${vulnerability.filePath}
- Line: ${vulnerability.lineNumber}

**Vulnerable Code Snippet:**
\`\`\`
${vulnerability.codeSnippet}
\`\`\`

**Surrounding Code Context:**
\`\`\`
${codeContext}
\`\`\`

**Task:**
Please provide a secure fix for this vulnerability. Your response must follow this exact format:

FIXED_CODE:
\`\`\`
[Your fixed code here]
\`\`\`

EXPLANATION:
[Detailed explanation of what was wrong and how your fix addresses the vulnerability]

CONFIDENCE:
[A number between 0 and 1 indicating your confidence in this fix, where 1 is highest confidence]

Important:
- Provide only the fixed code snippet, not the entire file
- Ensure the fix maintains the original functionality while addressing the security issue
- Be specific about what changes were made and why
- Consider the surrounding code context when making the fix`;

    return prompt;
  }

  /**
   * Parse the AI response to extract fix proposal
   */
  parseResponse(response: string, vulnerability: IVulnerability): AIFixProposal {
    try {
      // Extract fixed code
      const fixedCodeMatch = response.match(/FIXED_CODE:\s*\`\`\`[\s\S]*?\n([\s\S]*?)\`\`\`/);
      const fixedCode = fixedCodeMatch ? fixedCodeMatch[1].trim() : '';

      // Extract explanation
      const explanationMatch = response.match(/EXPLANATION:\s*([\s\S]*?)(?=CONFIDENCE:|$)/);
      const explanation = explanationMatch ? explanationMatch[1].trim() : '';

      // Extract confidence
      const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/);
      const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;

      // Validate extracted data
      if (!fixedCode) {
        throw new Error('Failed to extract fixed code from AI response');
      }

      if (!explanation) {
        throw new Error('Failed to extract explanation from AI response');
      }

      // Generate a unique ID for this proposal
      const proposalId = `${vulnerability._id.toString()}-${Date.now()}`;

      return {
        id: proposalId,
        vulnerabilityId: vulnerability._id.toString(),
        originalCode: vulnerability.codeSnippet,
        fixedCode,
        explanation,
        confidence: Math.max(0, Math.min(1, confidence)) // Clamp between 0 and 1
      };
    } catch (error) {
      throw new Error(
        `Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the model name being used
   */
  getModelName(): string {
    return this.model;
  }
}

export default new GeminiService();