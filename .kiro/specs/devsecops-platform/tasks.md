# Implementation Plan: AI-Assisted Proactive Threat Detection and Mitigation DevSecOps Platform

## Overview

This implementation plan breaks down the DevSecOps Platform into discrete, incremental coding tasks. The platform will be built using Node.js/Express.js for the backend, React.js for the frontend, and MongoDB for data persistence. The implementation follows a bottom-up approach, starting with core services, then building API endpoints, and finally implementing the frontend interface.

## Tasks

- [x] 1. Project setup and infrastructure
  - Initialize Node.js backend project with TypeScript, Express, and necessary dependencies
  - Initialize React frontend project with TypeScript and required libraries
  - Set up MongoDB connection configuration with environment variables
  - Configure testing frameworks (Jest, fast-check, React Testing Library)
  - Set up project structure with organized directories for services, routes, models, and tests
  - _Requirements: All requirements depend on proper project setup_

- [ ] 2. Implement authentication service and GitHub OAuth integration
  - [x] 2.1 Create AuthenticationService with token encryption/decryption
    - Implement token encryption using crypto module with AES-256
    - Implement token decryption with error handling
    - Implement secure token storage and retrieval from MongoDB
    - _Requirements: 1.3, 10.1_
  
  - [x] 2.2 Write property test for token encryption round-trip

    - **Property 3: Token Encryption Invariant**
    - **Validates: Requirements 10.1**
  
  - [x] 2.3 Implement GitHub OAuth flow (initiate, callback, token exchange)
    - Create OAuth URL generation with correct scopes (repo, read:user)
    - Implement OAuth callback handler to exchange code for token using GitHub API
    - Implement token refresh logic for expired tokens
    - Add methods to AuthenticationService: generateOAuthUrl(), exchangeCodeForToken(), refreshToken()
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [x] 2.4 Write property test for OAuth round-trip completeness
    - **Property 1: OAuth Round-Trip Completeness**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - Test that OAuth flow results in authenticated session with encrypted token
    - Mock GitHub API responses for testing
  
  - [x] 2.5 Implement session management and logout functionality
    - Create session validation middleware using express-session
    - Implement logout with session invalidation and token cleanup
    - Use existing revokeToken() method from AuthenticationService
    - _Requirements: 10.4_
  
  - [x] 2.6 Write property test for session cleanup on logout
    - **Property 4: Session Cleanup on Logout**
    - **Validates: Requirements 10.4**
    - Test that logout removes all session data and tokens from database
  
  - [x] 2.7 Write unit tests for OAuth error handling
    - Test OAuth authorization failures (invalid code, network errors)
    - Test token expiration scenarios
    - Test GitHub API error responses
    - _Requirements: 1.5_

- [x] 3. Implement repository management service
  - [x] 3.1 Create RepositoryManager service
    - Implement repository listing using GitHub REST API (axios)
    - Implement repository file download using GitHub archive API
    - Implement directory structure preservation during extraction
    - Implement temporary file management with cleanup using fs/promises
    - Create service in backend/src/services/RepositoryManager.ts
    - _Requirements: 2.1, 2.3, 2.4, 10.5_
  
  - [x] 3.2 Write property test for directory structure preservation
    - **Property 6: Directory Structure Preservation**
    - **Validates: Requirements 2.4**
    - Test that downloaded repos maintain exact directory hierarchy
    - Use fast-check to generate various directory structures
  
  - [x] 3.3 Write property test for temporary file cleanup
    - **Property 7: Temporary File Cleanup**
    - **Validates: Requirements 10.5**
    - Test that all temp files are deleted after scan completion
    - Test cleanup on both success and failure scenarios
  
  - [x] 3.4 Write property test for repository list completeness
    - **Property 5: Repository List Completeness**
    - **Validates: Requirements 2.1, 2.2**
    - Test that all accessible repos are returned with required fields
    - Mock GitHub API responses with various repo configurations
  
  - [x] 3.5 Write unit tests for repository download failure handling
    - Test network failures during download
    - Test invalid repository scenarios (404, 403 errors)
    - Test corrupted archive handling
    - _Requirements: 2.5_

- [x] 4. Implement security scanning orchestration
  - [x] 4.1 Create ScanOrchestrator service
    - Implement parallel scanner execution using Promise.allSettled()
    - Implement result aggregation and normalization into common format
    - Implement severity level mapping from scanner-specific outputs
    - Implement scanner failure resilience (continue on individual failures)
    - Create service in backend/src/services/ScanOrchestrator.ts
    - _Requirements: 3.1, 3.5, 3.6, 3.7_
  
  - [x] 4.2 Write property test for all scanners invoked
    - **Property 8: All Scanners Invoked**
    - **Validates: Requirements 3.1**
    - Test that all three scanners are initiated for every scan
    - Verify using execution logs or mock call counts
  
  - [x] 4.3 Write property test for scanner failure resilience
    - **Property 9: Scanner Failure Resilience**
    - **Validates: Requirements 3.6, 9.2**
    - Test that remaining scanners continue when one fails
    - Test that scan report includes results from successful scanners
  
  - [x] 4.4 Write property test for scan report completeness
    - **Property 10: Scan Report Completeness**
    - **Validates: Requirements 3.7**
    - Test that all required fields are present in scan reports
    - Verify vulnerability type, severity, file location, line number
  
  - [x] 4.5 Write property test for result aggregation correctness
    - **Property 11: Result Aggregation Correctness**
    - **Validates: Requirements 3.5**
    - Test that aggregation preserves all vulnerabilities without duplication
    - Test that summary counts match actual vulnerability counts
  
  - [x] 4.6 Implement individual scanner wrappers
    - Create Semgrep wrapper with command execution using child_process
    - Create Trivy wrapper with command execution and JSON output parsing
    - Create Gitleaks wrapper with command execution and JSON output parsing
    - Create wrappers in backend/src/services/scanners/ directory
    - Handle scanner-specific output formats and error codes
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [x] 4.7 Write unit tests for scanner integrations
    - Test Semgrep detection with known vulnerable code samples
    - Test Trivy detection with known vulnerable dependencies
    - Test Gitleaks detection with test secrets
    - Test scanner timeout handling
    - Test scanner not installed scenarios
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 5. Checkpoint - Ensure core services are functional
  - Run all unit and property tests for authentication, repository, and scanning services
  - Verify all tests pass before proceeding to data models
  - Ask the user if questions arise about implementation details

- [x] 6. Implement data models and MongoDB schemas
  - [x] 6.1 Create MongoDB schemas for all collections
    - Define Repository schema with GitHub metadata in backend/src/models/Repository.ts
    - Define ScanReport schema with embedded vulnerabilities in backend/src/models/ScanReport.ts
    - Define Vulnerability schema with all required fields in backend/src/models/Vulnerability.ts
    - Define Fix schema for tracking manual and AI fixes in backend/src/models/Fix.ts
    - Define Commit schema for GitHub commit tracking in backend/src/models/Commit.ts
    - User schema already exists - verify it matches design requirements
    - _Requirements: 8.1, 8.2_
  
  - [x] 6.2 Write property test for scan report persistence completeness
    - **Property 29: Scan Report Persistence Completeness**
    - **Validates: Requirements 8.1, 8.2**
    - Test that storing and retrieving scan reports preserves all fields
    - Use fast-check to generate various scan report structures
  
  - [x] 6.3 Write property test for secret sanitization in storage
    - **Property 31: Secret Sanitization in Storage**
    - **Validates: Requirements 10.3**
    - Test that secrets detected by Gitleaks are sanitized before storage
    - Verify actual secret values are redacted while metadata is preserved

- [x] 7. Implement fix management service
  - [x] 7.1 Create FixManager service for manual fixes
    - Implement code validation before saving using appropriate parsers
    - Implement fix status tracking and updates in MongoDB
    - Implement file modification and persistence to local filesystem
    - Create service in backend/src/services/FixManager.ts
    - _Requirements: 5.2, 5.3, 5.4_
  
  - [x] 7.2 Write property test for fix status progression
    - **Property 19: Fix Status Progression**
    - **Validates: Requirements 5.3, 5.4**
    - Test status transitions: Pending → In Progress → Fixed
    - Verify status updates are persisted to database
  
  - [x] 7.3 Write property test for syntax validation prevents invalid saves
    - **Property 18: Syntax Validation Prevents Invalid Saves**
    - **Validates: Requirements 5.2, 5.5**
    - Test that code with syntax errors cannot be saved
    - Test that validation errors are returned to user
  
  - [x] 7.4 Create GeminiService for AI-assisted fixes
    - Implement Gemini API integration using @google/generative-ai package
    - Use gemini-2.0-flash-exp model as specified in requirements
    - Implement prompt building with vulnerability context and code snippets
    - Implement response parsing to extract fix proposals
    - Create service in backend/src/services/GeminiService.ts
    - _Requirements: 6.1, 6.7_
  
  - [x] 7.5 Write property test for AI fix request completeness
    - **Property 20: AI Fix Request Completeness**
    - **Validates: Requirements 6.1**
    - Test that AI requests include all required context
    - Verify vulnerability details, code snippet, and surrounding context
  
  - [x] 7.6 Write property test for AI model specification
    - **Property 21: AI Model Specification**
    - **Validates: Requirements 6.7**
    - Test that all AI requests specify gemini-2.0-flash-exp model
  
  - [x] 7.7 Implement AI fix approval and rejection workflows
    - Implement fix proposal display and user review endpoints
    - Implement fix application on approval with file updates
    - Implement alternative options on rejection (retry, manual)
    - Add methods to FixManager for AI workflow coordination
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  
  - [x] 7.8 Write property test for AI fix application updates status
    - **Property 23: AI Fix Application Updates Status**
    - **Validates: Requirements 6.3, 6.4**
    - Test that approved fixes update vulnerability status to Fixed
    - Test that fix details are stored in database
  
  - [x] 7.9 Write unit tests for AI API failure handling
    - Test Gemini API failures (network, quota, invalid requests)
    - Test fallback to manual correction when AI fails
    - Test timeout handling for slow AI responses
    - _Requirements: 6.6, 9.4_

- [-] 8. Implement GitHub commit service
  - [x] 8.1 Create GitHubCommitService
    - Implement commit message generation with fix summary
    - Implement Git operations using GitHub API (create/update file contents)
    - Implement conflict detection and handling
    - Implement default branch targeting logic
    - Create service in backend/src/services/GitHubCommitService.ts
    - _Requirements: 7.2, 7.3, 7.4, 7.7_
  
  - [x] 8.2 Write property test for commit message generation completeness
    - **Property 25: Commit Message Generation Completeness**
    - **Validates: Requirements 7.2, 7.3**
    - Test that commit messages include fix count and severity breakdown
  
  - [x] 8.3 Write property test for commit authentication
    - **Property 26: Commit Authentication**
    - **Validates: Requirements 7.4**
    - Test that all commits use authenticated user's access token
  
  - [ ] 8.4 Write property test for commit success updates report
    - **Property 27: Commit Success Updates Report**
    - **Validates: Requirements 7.5**
    - Test that successful commits update vulnerability status to Verified
  
  - [x] 8.5 Write property test for default branch targeting
    - **Property 28: Default Branch Targeting**
    - **Validates: Requirements 7.7**
    - Test that commits target default branch when not specified
  
  - [x] 8.6 Write unit tests for commit conflict handling
    - Test merge conflicts detection
    - Test conflict resolution options presentation
    - Test handling of branch protection rules
    - _Requirements: 7.6_

- [x] 9. Implement error handling and logging infrastructure
  - [x] 9.1 Create centralized error logging service
    - Implement structured logging with winston or pino
    - Implement error log format with timestamp, endpoint, and details
    - Implement admin notification for critical errors (console for now)
    - Create service in backend/src/services/LoggingService.ts
    - _Requirements: 9.1, 9.6_
  
  - [x] 9.2 Write property test for API error logging completeness
    - **Property 32: API Error Logging Completeness**
    - **Validates: Requirements 9.1**
    - Test that all API errors are logged with required fields
  
  - [x] 9.3 Implement rate limiting middleware
    - Implement rate limiting for scan operations using express-rate-limit
    - Implement GitHub API rate limit handling with retry logic
    - Create middleware in backend/src/middleware/rateLimiter.ts
    - _Requirements: 9.3, 10.6_
  
  - [x] 9.4 Write property test for rate limiting enforcement
    - **Property 40: Rate Limiting Enforcement**
    - **Validates: Requirements 10.6**
    - Test that exceeding rate limits results in request rejection
  
  - [x] 9.5 Write property test for rate limit handling
    - **Property 35: Rate Limit Handling**
    - **Validates: Requirements 9.3**
    - Test that GitHub API rate limits trigger retry after reset time

- [x] 10. Checkpoint - Ensure backend services are complete
  - Run all unit and property tests for all backend services
  - Verify database schemas are working correctly
  - Test error handling and logging across all services
  - Ask the user if questions arise about implementation details

- [x] 11. Implement backend API endpoints
  - [x] 11.1 Create authentication endpoints
    - POST /api/auth/github/initiate - Initiate OAuth flow
    - GET /api/auth/github/callback - Handle OAuth callback
    - POST /api/auth/logout - Logout user
    - GET /api/auth/status - Get authentication status
    - Create routes in backend/src/routes/auth.routes.ts
    - Wire up to AuthenticationService
    - _Requirements: 1.1, 1.2, 10.4_
  
  - [x] 11.2 Create repository endpoints
    - GET /api/repositories - List user repositories
    - POST /api/repositories/:id/scan - Initiate scan
    - GET /api/repositories/:id/files - Get file tree
    - Create routes in backend/src/routes/repository.routes.ts
    - Wire up to RepositoryManager and ScanOrchestrator
    - _Requirements: 2.1, 2.3_
  
  - [x] 11.3 Create vulnerability endpoints
    - GET /api/vulnerabilities - List vulnerabilities with filters
    - GET /api/vulnerabilities/:id - Get vulnerability details
    - PATCH /api/vulnerabilities/:id - Update vulnerability status
    - Create routes in backend/src/routes/vulnerability.routes.ts
    - _Requirements: 4.1, 4.3, 4.4_
  
  - [x] 11.4 Create fix endpoints
    - POST /api/fixes/manual - Submit manual fix
    - POST /api/fixes/ai - Request AI fix
    - POST /api/fixes/ai/:id/approve - Approve AI fix
    - POST /api/fixes/ai/:id/reject - Reject AI fix
    - Create routes in backend/src/routes/fix.routes.ts
    - Wire up to FixManager and GeminiService
    - _Requirements: 5.1, 6.1, 6.3, 6.5_
  
  - [x] 11.5 Create commit endpoints
    - POST /api/commits - Commit fixes to GitHub
    - GET /api/commits/:id/status - Get commit status
    - Create routes in backend/src/routes/commit.routes.ts
    - Wire up to GitHubCommitService
    - _Requirements: 7.1, 7.5_
  
  - [x] 11.6 Create report endpoints
    - GET /api/reports - List scan reports
    - GET /api/reports/:id - Get specific report
    - Create routes in backend/src/routes/report.routes.ts
    - _Requirements: 8.3, 8.5_
  
  - [x] 11.7 Write integration tests for API endpoints
    - Test authentication flow end-to-end using supertest
    - Test scan workflow end-to-end
    - Test fix workflow end-to-end
    - Test commit workflow end-to-end
    - Create tests in backend/src/tests/integration/

- [x] 12. Implement security middleware and HTTPS enforcement
  - [x] 12.1 Create security middleware
    - Implement HTTPS enforcement for external API calls (verify URLs)
    - Implement request validation middleware using express-validator
    - CORS already configured in index.ts - verify settings
    - Helmet already configured in index.ts - verify settings
    - Create middleware in backend/src/middleware/security.ts
    - _Requirements: 10.2_
  
  - [x] 12.2 Write property test for HTTPS enforcement
    - **Property 39: HTTPS Enforcement**
    - **Validates: Requirements 10.2**
    - Test that all external API calls use HTTPS protocol
    - Verify GitHub API and Gemini API calls

- [x] 13. Implement React frontend - Authentication components
  - [x] 13.1 Create AuthenticationComponent
    - Implement GitHub login button and OAuth initiation
    - Implement OAuth callback handling (parse URL params)
    - Implement logout functionality
    - Implement authentication status display
    - Create component in frontend/src/components/Authentication.tsx
    - Create auth service in frontend/src/services/authService.ts
    - _Requirements: 1.1, 1.2, 10.4_
  
  - [x] 13.2 Write unit tests for authentication UI
    - Test login flow using React Testing Library
    - Test logout flow
    - Test error display for failed authentication
    - Create tests in frontend/src/components/Authentication.test.tsx
    - _Requirements: 1.5_

- [ ] 14. Implement React frontend - Repository components
  - [x] 14.1 Create RepositoryListComponent
    - Implement repository list display with required fields (name, visibility, lastUpdated)
    - Implement repository selection functionality
    - Implement multi-repository selection support with checkboxes
    - Implement scan initiation button
    - Create component in frontend/src/components/RepositoryList.tsx
    - Create repository service in frontend/src/services/repositoryService.ts
    - _Requirements: 2.1, 2.2, 12.1_
  
  - [ ] 14.2 Write property test for repository display completeness
    - **Property 5: Repository List Completeness**
    - **Validates: Requirements 2.1, 2.2**
    - Test that all repositories are displayed with required fields
    - Use fast-check to generate repository data

- [ ] 15. Implement React frontend - Dashboard components
  - [x] 15.1 Create VulnerabilityDashboardComponent
    - Implement vulnerability list display with all required fields
    - Implement severity filtering functionality (dropdown or buttons)
    - Implement file search functionality (search input)
    - Implement severity-based sorting (Critical → High → Medium → Low)
    - Implement repository filtering for multi-repo view
    - Create component in frontend/src/components/VulnerabilityDashboard.tsx
    - Create vulnerability service in frontend/src/services/vulnerabilityService.ts
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 12.3_
  
  - [x] 15.2 Write property test for vulnerability display completeness
    - **Property 12: Vulnerability Display Completeness**
    - **Validates: Requirements 4.1, 4.2**
    - Test that all vulnerabilities are displayed with required fields
  
  - [x] 15.3 Write property test for severity filtering correctness
    - **Property 13: Severity Filtering Correctness**
    - **Validates: Requirements 4.3**
    - Test that filtering shows only matching severity levels
  
  - [x] 15.4 Write property test for file search filtering correctness
    - **Property 14: File Search Filtering Correctness**
    - **Validates: Requirements 4.4**
    - Test that file search shows only matching vulnerabilities
  
  - [x] 15.5 Write property test for severity sorting correctness
    - **Property 15: Severity Sorting Correctness**
    - **Validates: Requirements 4.6**
    - Test that vulnerabilities are sorted by severity correctly
  
  - [x] 15.6 Implement vulnerability detail view
    - Display detailed vulnerability information in modal or panel
    - Display remediation guidance
    - Add click handler to vulnerability list items
    - _Requirements: 4.5_

- [-] 16. Implement React frontend - Fix components
  - [x] 16.1 Create CodeEditorComponent for manual fixes
    - Implement code editor using @monaco-editor/react
    - Implement code loading with vulnerable line highlighting
    - Implement syntax validation before save
    - Implement save functionality with status updates
    - Create component in frontend/src/components/CodeEditor.tsx
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [x] 16.2 Write property test for code editor loading correctness
    - **Property 17: Code Editor Loading Correctness**
    - **Validates: Requirements 5.1**
    - Test that correct file content is loaded with highlighted line
  
  - [x] 16.3 Create AIFixComponent
    - Implement AI fix request button
    - Implement fix proposal display with diff view
    - Implement approve/reject buttons
    - Implement retry and manual correction options
    - Create component in frontend/src/components/AIFix.tsx
    - Create AI fix service in frontend/src/services/aiFixService.ts
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [x] 16.4 Write property test for AI fix proposal display
    - **Property 22: AI Fix Proposal Display**
    - **Validates: Requirements 6.2**
    - Test that proposals are displayed with original and fixed code

- [-] 17. Implement React frontend - Progress indicators and notifications
  - [x] 17.1 Create progress indicator components
    - Implement scan progress indicator (spinner or progress bar)
    - Implement download progress indicator
    - Implement AI processing loading indicator
    - Implement commit progress indicator
    - Create reusable component in frontend/src/components/ProgressIndicator.tsx
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [x] 17.2 Write property test for operation progress indicators
    - **Property 41: Operation Progress Indicators**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
    - Test that progress indicators are shown during operations
  
  - [x] 17.3 Create notification system
    - Implement success notifications (toast or snackbar)
    - Implement error notifications
    - Implement notification auto-dismiss after timeout
    - Create notification component in frontend/src/components/Notification.tsx
    - Create notification context/hook for global state
    - _Requirements: 11.5_
  
  - [ ] 17.4 Write property test for operation completion notifications
    - **Property 42: Operation Completion Notifications**
    - **Validates: Requirements 11.5**
    - Test that notifications are displayed on operation completion

- [-] 18. Implement multi-repository support features
  - [x] 18.1 Implement sequential scanning for multiple repositories
    - Create scan queue management in backend
    - Implement sequential execution logic (wait for completion before next)
    - Add queue status tracking
    - _Requirements: 12.2_
  
  - [ ] 18.2 Write property test for sequential scan execution
    - **Property 43: Sequential Scan Execution**
    - **Validates: Requirements 12.2**
    - Test that scans execute one at a time in order
  
  - [x] 18.3 Implement repository context switching in dashboard
    - Implement repository selector dropdown in dashboard
    - Implement dashboard update on repository switch
    - Filter vulnerabilities by selected repository
    - _Requirements: 12.5_
  
  - [ ] 18.4 Write property test for repository context switching
    - **Property 44: Repository Context Switching**
    - **Validates: Requirements 12.5**
    - Test that switching repos updates displayed vulnerabilities
  
  - [x] 18.5 Implement report repository attribution display
    - Display repository name and ID in reports
    - Ensure clear visual distinction between repositories
    - Add repository badges or labels to vulnerability items
    - _Requirements: 12.4_
  
  - [ ] 18.6 Write property test for report repository attribution
    - **Property 45: Report Repository Attribution**
    - **Validates: Requirements 12.4**
    - Test that reports clearly indicate which repository they belong to

- [x] 19. Implement historical report viewing
  - [x] 19.1 Create historical report list component
    - Display list of past scan reports with summary (date, total vulns, status)
    - Implement report selection to view details
    - Create component in frontend/src/components/ReportHistory.tsx
    - Wire up to report service
    - _Requirements: 8.3, 8.4, 8.5_
  
  - [x] 19.2 Write property test for historical report retrieval
    - **Property 30: Historical Report Retrieval**
    - **Validates: Requirements 8.3**
    - Test that all historical reports are retrieved and displayed

- [x] 20. Checkpoint - Ensure frontend is complete
  - Test all frontend components individually
  - Test component integration and data flow
  - Verify all UI requirements are met
  - Ask the user if questions arise about implementation details

- [x] 21. Integration and end-to-end testing
  - [x] 21.1 Write E2E test for complete scan workflow
    - Test authentication → repository selection → scan → results display
    - Use Playwright or similar E2E testing framework
    - Mock external services (GitHub API, scanners)
    - Create test in backend/src/tests/integration/scan-workflow.test.ts
  
  - [x] 21.2 Write E2E test for manual fix workflow
    - Test vulnerability selection → code editing → save → commit
    - Verify status updates throughout the flow
    - Create test in backend/src/tests/integration/manual-fix-workflow.test.ts
  
  - [x] 21.3 Write E2E test for AI fix workflow
    - Test vulnerability selection → AI fix request → review → approve → commit
    - Mock Gemini API responses
    - Create test in backend/src/tests/integration/ai-fix-workflow.test.ts

- [x] 22. Final integration and deployment preparation
  - [x] 22.1 Wire all components together
    - Connect frontend to backend API (configure axios base URL)
    - Verify all API endpoints are accessible from frontend
    - Verify all error handling paths work correctly
    - Test complete user flows manually
    - _Requirements: All requirements_
  
  - [x] 22.2 Create environment configuration documentation
    - Document all required environment variables in README
    - Verify .env.example is complete and accurate
    - Document MongoDB connection string format
    - Document GitHub OAuth app setup steps
    - Document Gemini API key setup steps
    - Document scanner installation (Semgrep, Trivy, Gitleaks)
  
  - [x] 22.3 Create deployment documentation
    - Document installation steps (npm install for both frontend and backend)
    - Document configuration steps (environment variables)
    - Document running the application (npm run dev for development)
    - Document testing procedures (npm test)
    - Document production build steps
    - Update README.md and SETUP_GUIDE.md

- [x] 23. Final checkpoint - Ensure all tests pass
  - Run complete test suite (unit, property, integration)
  - Verify all 45 correctness properties are tested and passing
  - Run test coverage report and ensure minimum 80% coverage
  - Fix any failing tests or coverage gaps
  - Ask the user if questions arise about test results or coverage

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout development
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation follows a bottom-up approach: services → API → frontend
- External dependencies (Semgrep, Trivy, Gitleaks) must be installed on the system
- MongoDB connection string will be provided by the user during setup
- GitHub OAuth app must be created and configured before testing authentication
- Gemini API key must be obtained before testing AI fix functionality
