// Set environment variable before any imports
process.env.GEMINI_API_KEY = 'test-api-key';

// Mock the Google Generative AI module before importing GeminiService
jest.mock('@google/generative-ai');

import { GeminiService } from '../../services/GeminiService';
import Vulnerability from '../../models/Vulnerability';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';

describe('GeminiService - AI API Failure Handling', () => {
  let mongoServer: MongoMemoryServer;
  let geminiService: GeminiService;
  let mockGenAI: jest.Mocked<GoogleGenerativeAI>;
  let mockModel: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Set up mock model
    mockModel = {
      generateContent: jest.fn()
    };

    // Set up mock GoogleGenerativeAI
    mockGenAI = new GoogleGenerativeAI('test-key') as jest.Mocked<GoogleGenerativeAI>;
    mockGenAI.getGenerativeModel = jest.fn().mockReturnValue(mockModel);

    // Mock the constructor
    (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>).mockImplementation(
      () => mockGenAI
    );
    
    // Create service instance
    geminiService = new GeminiService();
  });

  afterEach(async () => {
    await Vulnerability.deleteMany({});
  });

  describe('Network Failures', () => {
    it('should handle network timeout errors', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'high',
        title: 'SQL Injection',
        description: 'Potential SQL injection vulnerability',
        filePath: 'src/database.ts',
        lineNumber: 42,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'const query = "SELECT * FROM users WHERE id = " + userId;',
        metadata: {}
      });
      await vulnerability.save();

      // Mock network timeout
      mockModel.generateContent.mockRejectedValue(
        new Error('Network timeout: Request took too long')
      );

      const codeContext = 'function getUser(userId: string) {\n  const query = "SELECT * FROM users WHERE id = " + userId;\n  return db.execute(query);\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: Network timeout: Request took too long');
    });

    it('should handle connection refused errors', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'medium',
        title: 'XSS Vulnerability',
        description: 'Cross-site scripting vulnerability',
        filePath: 'src/render.ts',
        lineNumber: 15,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'element.innerHTML = userInput;',
        metadata: {}
      });
      await vulnerability.save();

      // Mock connection refused
      mockModel.generateContent.mockRejectedValue(
        new Error('ECONNREFUSED: Connection refused')
      );

      const codeContext = 'function render(userInput: string) {\n  const element = document.getElementById("content");\n  element.innerHTML = userInput;\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: ECONNREFUSED: Connection refused');
    });

    it('should handle DNS resolution failures', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'high',
        title: 'Path Traversal',
        description: 'Path traversal vulnerability',
        filePath: 'src/files.ts',
        lineNumber: 20,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'const filePath = basePath + userInput;',
        metadata: {}
      });
      await vulnerability.save();

      // Mock DNS failure
      mockModel.generateContent.mockRejectedValue(
        new Error('ENOTFOUND: DNS lookup failed')
      );

      const codeContext = 'function readFile(userInput: string) {\n  const filePath = basePath + userInput;\n  return fs.readFileSync(filePath);\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: ENOTFOUND: DNS lookup failed');
    });
  });

  describe('API Quota and Rate Limiting', () => {
    it('should handle quota exceeded errors', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'critical',
        title: 'Command Injection',
        description: 'Command injection vulnerability',
        filePath: 'src/exec.ts',
        lineNumber: 8,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'exec("ls " + userInput);',
        metadata: {}
      });
      await vulnerability.save();

      // Mock quota exceeded
      mockModel.generateContent.mockRejectedValue(
        new Error('Quota exceeded: You have exceeded your API quota')
      );

      const codeContext = 'function listFiles(userInput: string) {\n  exec("ls " + userInput);\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: Quota exceeded: You have exceeded your API quota');
    });

    it('should handle rate limit errors', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'secret',
        severity: 'critical',
        title: 'Hardcoded API Key',
        description: 'API key hardcoded in source',
        filePath: 'src/config.ts',
        lineNumber: 5,
        scanner: 'gitleaks',
        fixStatus: 'pending',
        codeSnippet: 'const apiKey = "sk-test-xxxxxxxxxxxxxxxx";',
        metadata: {}
      });
      await vulnerability.save();

      // Mock rate limit
      mockModel.generateContent.mockRejectedValue(
        new Error('Rate limit exceeded: Too many requests')
      );

      const codeContext = 'const config = {\n  apiKey: "sk-test-xxxxxxxxxxxxxxxx",\n  endpoint: "https://api.example.com"\n};';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: Rate limit exceeded: Too many requests');
    });

    it('should handle resource exhausted errors', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'dependency',
        severity: 'high',
        title: 'Vulnerable Dependency',
        description: 'Using vulnerable version of library',
        filePath: 'package.json',
        lineNumber: 12,
        scanner: 'trivy',
        fixStatus: 'pending',
        codeSnippet: '"lodash": "4.17.15"',
        metadata: {}
      });
      await vulnerability.save();

      // Mock resource exhausted
      mockModel.generateContent.mockRejectedValue(
        new Error('Resource exhausted: Service temporarily unavailable')
      );

      const codeContext = '{\n  "dependencies": {\n    "lodash": "4.17.15"\n  }\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: Resource exhausted: Service temporarily unavailable');
    });
  });

  describe('Invalid Request Errors', () => {
    it('should handle invalid API key errors', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'medium',
        title: 'Insecure Random',
        description: 'Using insecure random number generator',
        filePath: 'src/crypto.ts',
        lineNumber: 10,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'const token = Math.random().toString(36);',
        metadata: {}
      });
      await vulnerability.save();

      // Mock invalid API key
      mockModel.generateContent.mockRejectedValue(
        new Error('Invalid API key provided')
      );

      const codeContext = 'function generateToken() {\n  const token = Math.random().toString(36);\n  return token;\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: Invalid API key provided');
    });

    it('should handle malformed request errors', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'low',
        title: 'Weak Cipher',
        description: 'Using weak encryption cipher',
        filePath: 'src/encryption.ts',
        lineNumber: 7,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'crypto.createCipher("des", key);',
        metadata: {}
      });
      await vulnerability.save();

      // Mock malformed request
      mockModel.generateContent.mockRejectedValue(
        new Error('Bad request: Invalid request format')
      );

      const codeContext = 'function encrypt(data: string, key: string) {\n  const cipher = crypto.createCipher("des", key);\n  return cipher.update(data);\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: Bad request: Invalid request format');
    });

    it('should handle model not found errors', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'high',
        title: 'SSRF Vulnerability',
        description: 'Server-side request forgery',
        filePath: 'src/fetch.ts',
        lineNumber: 12,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'fetch(userProvidedUrl);',
        metadata: {}
      });
      await vulnerability.save();

      // Mock model not found
      mockModel.generateContent.mockRejectedValue(
        new Error('Model not found: The specified model does not exist')
      );

      const codeContext = 'async function fetchData(userProvidedUrl: string) {\n  const response = await fetch(userProvidedUrl);\n  return response.json();\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: Model not found: The specified model does not exist');
    });
  });

  describe('Timeout Handling', () => {
    it('should handle slow API responses that timeout', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'high',
        title: 'Regex DoS',
        description: 'Regular expression denial of service',
        filePath: 'src/validator.ts',
        lineNumber: 18,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'const regex = /^(a+)+$/;',
        metadata: {}
      });
      await vulnerability.save();

      // Mock timeout after delay
      mockModel.generateContent.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Request timeout: Operation took too long'));
          }, 100);
        });
      });

      const codeContext = 'function validate(input: string) {\n  const regex = /^(a+)+$/;\n  return regex.test(input);\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: Request timeout: Operation took too long');
    });

    it('should handle gateway timeout errors', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'medium',
        title: 'Open Redirect',
        description: 'Open redirect vulnerability',
        filePath: 'src/redirect.ts',
        lineNumber: 9,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'res.redirect(req.query.url);',
        metadata: {}
      });
      await vulnerability.save();

      // Mock gateway timeout
      mockModel.generateContent.mockRejectedValue(
        new Error('Gateway timeout: Upstream server did not respond in time')
      );

      const codeContext = 'function handleRedirect(req: Request, res: Response) {\n  res.redirect(req.query.url);\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: Gateway timeout: Upstream server did not respond in time');
    });
  });

  describe('Response Parsing Failures', () => {
    it('should handle malformed AI responses missing fixed code', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'high',
        title: 'XXE Vulnerability',
        description: 'XML external entity vulnerability',
        filePath: 'src/xml.ts',
        lineNumber: 14,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'parser.parseFromString(xmlData);',
        metadata: {}
      });
      await vulnerability.save();

      // Mock response without fixed code
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => `EXPLANATION:
This is a fix explanation but no code provided.

CONFIDENCE:
0.8`
        }
      });

      const codeContext = 'function parseXML(xmlData: string) {\n  const parser = new DOMParser();\n  return parser.parseFromString(xmlData);\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to parse AI response: Failed to extract fixed code from AI response');
    });

    it('should handle malformed AI responses missing explanation', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'medium',
        title: 'CSRF Vulnerability',
        description: 'Missing CSRF protection',
        filePath: 'src/form.ts',
        lineNumber: 22,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'app.post("/update", handler);',
        metadata: {}
      });
      await vulnerability.save();

      // Mock response without explanation
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => `FIXED_CODE:
\`\`\`
app.post("/update", csrfProtection, handler);
\`\`\`

CONFIDENCE:
0.9`
        }
      });

      const codeContext = 'app.post("/update", handler);';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to parse AI response: Failed to extract explanation from AI response');
    });

    it('should handle completely malformed AI responses', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'low',
        title: 'Information Disclosure',
        description: 'Sensitive information in error messages',
        filePath: 'src/error.ts',
        lineNumber: 11,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'throw new Error(dbConnectionString);',
        metadata: {}
      });
      await vulnerability.save();

      // Mock completely malformed response
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'This is just random text without any structure'
        }
      });

      const codeContext = 'function handleError() {\n  throw new Error(dbConnectionString);\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to parse AI response');
    });

    it('should handle empty AI responses', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'high',
        title: 'Insecure Deserialization',
        description: 'Unsafe deserialization of user input',
        filePath: 'src/deserialize.ts',
        lineNumber: 16,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'JSON.parse(userInput);',
        metadata: {}
      });
      await vulnerability.save();

      // Mock empty response
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => ''
        }
      });

      const codeContext = 'function deserialize(userInput: string) {\n  return JSON.parse(userInput);\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to parse AI response');
    });
  });

  describe('Service Unavailability', () => {
    it('should handle service unavailable errors', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'critical',
        title: 'Authentication Bypass',
        description: 'Authentication can be bypassed',
        filePath: 'src/auth.ts',
        lineNumber: 25,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'if (user || true) { authenticate(); }',
        metadata: {}
      });
      await vulnerability.save();

      // Mock service unavailable
      mockModel.generateContent.mockRejectedValue(
        new Error('Service unavailable: The service is temporarily down')
      );

      const codeContext = 'function checkAuth(user: User) {\n  if (user || true) { authenticate(); }\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: Service unavailable: The service is temporarily down');
    });

    it('should handle internal server errors', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'high',
        title: 'Race Condition',
        description: 'Race condition in concurrent access',
        filePath: 'src/concurrent.ts',
        lineNumber: 30,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'counter++;',
        metadata: {}
      });
      await vulnerability.save();

      // Mock internal server error
      mockModel.generateContent.mockRejectedValue(
        new Error('Internal server error: An unexpected error occurred')
      );

      const codeContext = 'let counter = 0;\nfunction increment() {\n  counter++;\n}';

      await expect(
        geminiService.generateFix(vulnerability, codeContext)
      ).rejects.toThrow('Failed to generate AI fix: Internal server error: An unexpected error occurred');
    });
  });

  describe('Successful Fix Generation', () => {
    it('should successfully generate and parse a valid fix', async () => {
      const vulnerability = new Vulnerability({
        reportId: new Types.ObjectId(),
        repositoryId: new Types.ObjectId(),
        type: 'code',
        severity: 'high',
        title: 'SQL Injection',
        description: 'SQL injection vulnerability',
        filePath: 'src/database.ts',
        lineNumber: 42,
        scanner: 'semgrep',
        fixStatus: 'pending',
        codeSnippet: 'const query = "SELECT * FROM users WHERE id = " + userId;',
        metadata: {}
      });
      await vulnerability.save();

      // Mock successful response
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => `FIXED_CODE:
\`\`\`
const query = "SELECT * FROM users WHERE id = ?";
const result = await db.execute(query, [userId]);
\`\`\`

EXPLANATION:
Replaced string concatenation with parameterized query to prevent SQL injection. The ? placeholder is safely replaced by the database driver with the userId parameter, preventing malicious SQL code from being executed.

CONFIDENCE:
0.95`
        }
      });

      const codeContext = 'function getUser(userId: string) {\n  const query = "SELECT * FROM users WHERE id = " + userId;\n  return db.execute(query);\n}';

      const result = await geminiService.generateFix(vulnerability, codeContext);

      expect(result).toBeDefined();
      expect(result.vulnerabilityId).toBe(vulnerability._id.toString());
      expect(result.originalCode).toBe('const query = "SELECT * FROM users WHERE id = " + userId;');
      expect(result.fixedCode).toContain('SELECT * FROM users WHERE id = ?');
      expect(result.fixedCode).toContain('db.execute(query, [userId])');
      expect(result.explanation).toContain('parameterized query');
      expect(result.confidence).toBe(0.95);
    });
  });
});

