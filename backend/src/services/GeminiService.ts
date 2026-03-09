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
  private model: string = 'gemini-1.5-flash';
  private maxRetries: number = 3;
  private baseDelay: number = 1000; // 1 second

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate a fix proposal for a vulnerability using Gemini AI
   */
  async generateFix(
    vulnerability: IVulnerability,
    codeContext: string
  ): Promise<AIFixProposal> {
    let lastError: Error | null = null;

    // Try with retries and exponential backoff
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
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
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': apiKey
            },
            timeout: 30000 // 30 second timeout
          }
        );

        const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
          throw new Error('Failed to generate fix: No content returned from AI');
        }

        return this.parseResponse(text, vulnerability);
      } catch (error) {
        lastError = error as Error;
        
        // Check if it's a rate limit or high demand error
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const errorMessage = error.response?.data?.error?.message || error.message;
          
          // If it's a rate limit (429) or service unavailable (503), retry
          if ((status === 429 || status === 503 || errorMessage.includes('high demand')) && attempt < this.maxRetries - 1) {
            const delay = this.baseDelay * Math.pow(2, attempt); // Exponential backoff
            console.log(`Gemini API rate limited or high demand. Retrying in ${delay}ms... (attempt ${attempt + 1}/${this.maxRetries})`);
            await this.sleep(delay);
            continue;
          }
          
          throw new Error(
            `Failed to generate AI fix: ${errorMessage}. ${attempt < this.maxRetries - 1 ? 'Please try again in a few moments.' : 'Please try again later.'}`
          );
        }
        
        throw new Error(
          `Failed to generate AI fix: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // If all retries failed
    throw new Error(
      `Failed to generate AI fix after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}. The AI service is currently experiencing high demand. Please try again later.`
    );
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