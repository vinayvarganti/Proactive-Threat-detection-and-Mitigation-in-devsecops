import * as fc from 'fast-check';
import { HTTPSEnforcer } from '../../middleware/security';
import MockAdapter from 'axios-mock-adapter';

describe('Security Property Tests', () => {
  describe('Property 39: HTTPS Enforcement', () => {
    // Feature: devsecops-platform, Property 39: HTTPS Enforcement
    // Validates: Requirements 10.2
    // For any external API call, the request URL should use HTTPS protocol

    it('should enforce HTTPS protocol for all external API calls', () => {
      fc.assert(
        fc.property(
          fc.record({
            protocol: fc.constantFrom('http:', 'https:', 'ftp:', 'ws:'),
            domain: fc.constantFrom(
              'api.github.com',
              'github.com',
              'generativelanguage.googleapis.com',
              'example.com'
            ),
            path: fc.string({ minLength: 1, maxLength: 50 }).map(s => '/' + s.replace(/\s/g, '-')),
          }),
          (testData) => {
            // Arrange
            const url = `${testData.protocol}//${testData.domain}${testData.path}`;

            // Act & Assert
            if (testData.protocol === 'https:') {
              // HTTPS should be allowed
              expect(() => HTTPSEnforcer.validateHTTPS(url)).not.toThrow();
            } else {
              // Non-HTTPS protocols should be rejected
              expect(() => HTTPSEnforcer.validateHTTPS(url)).toThrow(
                /HTTPS required for external API calls/
              );
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should validate that GitHub API calls use HTTPS', () => {
      fc.assert(
        fc.property(
          fc.record({
            endpoint: fc.constantFrom(
              '/user/repos',
              '/repos/owner/repo/tarball',
              '/repos/owner/repo/branches/main',
              '/repos/owner/repo/contents/file.txt',
              '/repos/owner/repo/git/blobs',
              '/repos/owner/repo/git/trees',
              '/repos/owner/repo/git/commits'
            ),
            protocol: fc.constantFrom('http:', 'https:'),
          }),
          (testData) => {
            // Arrange
            const url = `${testData.protocol}//api.github.com${testData.endpoint}`;

            // Act & Assert
            if (testData.protocol === 'https:') {
              expect(() => HTTPSEnforcer.validateHTTPS(url)).not.toThrow();
            } else {
              expect(() => HTTPSEnforcer.validateHTTPS(url)).toThrow();
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should validate that Gemini API calls use HTTPS', () => {
      fc.assert(
        fc.property(
          fc.record({
            endpoint: fc.constantFrom(
              '/v1/models/gemini-2.0-flash-exp:generateContent',
              '/v1/models',
              '/v1beta/models/gemini-2.0-flash-exp:generateContent'
            ),
            protocol: fc.constantFrom('http:', 'https:'),
          }),
          (testData) => {
            // Arrange
            const url = `${testData.protocol}//generativelanguage.googleapis.com${testData.endpoint}`;

            // Act & Assert
            if (testData.protocol === 'https:') {
              expect(() => HTTPSEnforcer.validateHTTPS(url)).not.toThrow();
            } else {
              expect(() => HTTPSEnforcer.validateHTTPS(url)).toThrow();
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should reject URLs with non-HTTPS protocols in axios interceptor', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            protocol: fc.constantFrom('http:', 'ftp:', 'ws:'),
            domain: fc.constantFrom('api.github.com', 'example.com'),
            path: fc.constantFrom('/test', '/api/data', '/endpoint'),
          }),
          async (testData) => {
            // Arrange
            const secureAxios = HTTPSEnforcer.createSecureAxiosInstance();
            const url = `${testData.protocol}//${testData.domain}${testData.path}`;

            // Act & Assert
            await expect(secureAxios.get(url)).rejects.toThrow(
              /HTTPS required for external API calls/
            );
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should allow HTTPS URLs through axios interceptor', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            domain: fc.constantFrom(
              'api.github.com',
              'github.com',
              'generativelanguage.googleapis.com'
            ),
            path: fc.constantFrom('/test', '/api/data', '/endpoint'),
          }),
          async (testData) => {
            // Arrange
            const secureAxios = HTTPSEnforcer.createSecureAxiosInstance();
            const mock = new MockAdapter(secureAxios);
            const url = `https://${testData.domain}${testData.path}`;

            // Mock the response
            mock.onGet(url).reply(200, { success: true });

            // Act
            const response = await secureAxios.get(url);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data).toEqual({ success: true });

            // Cleanup
            mock.restore();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should validate domain allowlist for external API calls', () => {
      fc.assert(
        fc.property(
          fc.record({
            domain: fc.constantFrom(
              'api.github.com',
              'github.com',
              'generativelanguage.googleapis.com',
              'malicious-site.com',
              'evil.example.com',
              'phishing.net'
            ),
          }),
          (testData) => {
            // Arrange
            const url = `https://${testData.domain}/api/endpoint`;
            const allowedDomains = [
              'api.github.com',
              'github.com',
              'generativelanguage.googleapis.com'
            ];

            // Act & Assert
            if (allowedDomains.includes(testData.domain)) {
              expect(() => HTTPSEnforcer.validateDomain(url)).not.toThrow();
            } else {
              expect(() => HTTPSEnforcer.validateDomain(url)).toThrow(
                /Domain not in allowed list/
              );
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should reject mixed content (HTTP in HTTPS context)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              protocol: fc.constantFrom('http:', 'https:'),
              domain: fc.constantFrom('api.github.com', 'github.com'),
              path: fc.string({ minLength: 1, maxLength: 20 }).map(s => '/' + s),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (urls) => {
            // Arrange
            const hasHttp = urls.some(u => u.protocol === 'http:');
            const hasHttps = urls.some(u => u.protocol === 'https:');

            // Act
            const validationResults = urls.map(u => {
              const url = `${u.protocol}//${u.domain}${u.path}`;
              try {
                HTTPSEnforcer.validateHTTPS(url);
                return true;
              } catch {
                return false;
              }
            });

            // Assert
            if (hasHttp) {
              // If any URL uses HTTP, at least one validation should fail
              expect(validationResults.some(r => !r)).toBe(true);
            }
            if (hasHttps && !hasHttp) {
              // If all URLs use HTTPS, all validations should pass
              expect(validationResults.every(r => r)).toBe(true);
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should handle URL parsing errors gracefully', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'not-a-url',
            'htp://invalid',
            '://missing-protocol',
            'http:/missing-slash',
            ''
          ),
          (invalidUrl) => {
            // Act & Assert
            expect(() => HTTPSEnforcer.validateHTTPS(invalidUrl)).toThrow();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should validate HTTPS for all service API calls', () => {
      fc.assert(
        fc.property(
          fc.record({
            service: fc.constantFrom('github', 'gemini'),
            operation: fc.constantFrom('get', 'post', 'patch', 'delete'),
            useHttps: fc.boolean(),
          }),
          (testData) => {
            // Arrange
            const protocol = testData.useHttps ? 'https:' : 'http:';
            const domain = testData.service === 'github' 
              ? 'api.github.com' 
              : 'generativelanguage.googleapis.com';
            const url = `${protocol}//${domain}/api/endpoint`;

            // Act
            let validationPassed = false;
            try {
              HTTPSEnforcer.validateHTTPS(url);
              validationPassed = true;
            } catch {
              validationPassed = false;
            }

            // Assert
            expect(validationPassed).toBe(testData.useHttps);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should enforce HTTPS for OAuth token exchange', () => {
      fc.assert(
        fc.property(
          fc.record({
            protocol: fc.constantFrom('http:', 'https:'),
            endpoint: fc.constantFrom(
              '/login/oauth/access_token',
              '/login/oauth/authorize'
            ),
          }),
          (testData) => {
            // Arrange
            const url = `${testData.protocol}//github.com${testData.endpoint}`;

            // Act & Assert
            if (testData.protocol === 'https:') {
              expect(() => HTTPSEnforcer.validateHTTPS(url)).not.toThrow();
            } else {
              expect(() => HTTPSEnforcer.validateHTTPS(url)).toThrow();
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});

