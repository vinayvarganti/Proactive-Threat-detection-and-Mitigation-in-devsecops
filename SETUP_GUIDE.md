# DevSecOps Platform - Detailed Setup Guide

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Installing Prerequisites](#installing-prerequisites)
3. [Project Installation](#project-installation)
4. [Configuration](#configuration)
5. [Running the Application](#running-the-application)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## System Requirements

- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher
- **MongoDB**: Version 6.x or higher
- **Git**: Version 2.x or higher
- **Operating System**: Linux, macOS, or Windows with WSL2

## Installing Prerequisites

### Node.js and npm

**macOS (using Homebrew):**
```bash
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows:**
Download and install from [nodejs.org](https://nodejs.org/)

Verify installation:
```bash
node --version  # Should show v18.x or higher
npm --version   # Should show 9.x or higher
```

### MongoDB

**macOS (using Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community@6.0
brew services start mongodb-community@6.0
```

**Linux (Ubuntu/Debian):**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Windows:**
Download and install from [mongodb.com](https://www.mongodb.com/try/download/community)

Verify installation:
```bash
mongosh --version
```

### Security Scanning Tools

#### Semgrep

```bash
# Using pip
pip install semgrep

# Or using Homebrew (macOS)
brew install semgrep

# Verify
semgrep --version
```

#### Trivy

**macOS:**
```bash
brew install aquasecurity/trivy/trivy
```

**Linux:**
```bash
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update
sudo apt-get install trivy
```

**Verify:**
```bash
trivy --version
```

#### Gitleaks

**macOS:**
```bash
brew install gitleaks
```

**Linux:**
```bash
# Download latest release
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.1/gitleaks_8.18.1_linux_x64.tar.gz
tar -xzf gitleaks_8.18.1_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/
```

**Verify:**
```bash
gitleaks version
```

## Project Installation

### 1. Clone or Navigate to Project

```bash
cd /path/to/devsecops-platform
```

### 2. Install All Dependencies

```bash
# Install root, backend, and frontend dependencies
npm run install:all
```

This will install:
- Root workspace dependencies
- Backend dependencies (Express, MongoDB, testing frameworks)
- Frontend dependencies (React, Vite, testing libraries)

## Configuration

### 1. Backend Environment Variables

Create the backend `.env` file:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/devsecops-platform

# GitHub OAuth Configuration (see below for setup)
GITHUB_CLIENT_ID=your_actual_github_client_id
GITHUB_CLIENT_SECRET=your_actual_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

# Gemini AI Configuration (see below for setup)
GEMINI_API_KEY=your_actual_gemini_api_key

# Security Configuration
TOKEN_ENCRYPTION_KEY=generate_a_64_character_hex_string_here
SESSION_SECRET=generate_a_128_character_hex_string_here

# Rate Limiting
SCAN_RATE_LIMIT=10
SCAN_RATE_WINDOW_HOURS=1
```

#### Environment Variable Details

**Server Configuration**:
- `PORT`: The port the backend server will listen on (default: 3000)
- `NODE_ENV`: Set to `development` for local development, `production` for deployment
- `FRONTEND_URL`: The URL where your frontend is running (used for CORS)

**MongoDB Configuration**:
- `MONGODB_URI`: Connection string for MongoDB
  - Local: `mongodb://localhost:27017/devsecops-platform`
  - Atlas: `mongodb+srv://username:password@cluster.mongodb.net/devsecops-platform`
  - Docker: `mongodb://mongodb:27017/devsecops-platform`

**GitHub OAuth Configuration**:
- `GITHUB_CLIENT_ID`: OAuth App Client ID from GitHub
- `GITHUB_CLIENT_SECRET`: OAuth App Client Secret from GitHub
- `GITHUB_CALLBACK_URL`: Must match the callback URL in your GitHub OAuth App settings
  - Development: `http://localhost:3000/api/auth/github/callback`
  - Production: `https://yourdomain.com/api/auth/github/callback`

**Gemini AI Configuration**:
- `GEMINI_API_KEY`: API key from Google AI Studio
- The platform uses the `gemini-2.0-flash-exp` model for AI-assisted vulnerability fixes

**Security Configuration**:
- `TOKEN_ENCRYPTION_KEY`: Used to encrypt GitHub access tokens in the database (must be 64 character hex string)
- `SESSION_SECRET`: Used for session cookie signing (should be a long random string)

**Rate Limiting Configuration**:
- `SCAN_RATE_LIMIT`: Maximum number of scans a user can initiate per time window
- `SCAN_RATE_WINDOW_HOURS`: Time window for rate limiting (in hours)

### 2. Generate Secure Keys

Generate secure random strings for encryption:

```bash
# Generate TOKEN_ENCRYPTION_KEY (64 character hex string - 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET (128 character hex string - 64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy these values into your `.env` file.

**Important Security Notes**:
- Never commit your `.env` file to version control
- Use different keys for development and production
- Store production keys securely (use environment variables or secret management services)
- Rotate keys periodically in production environments
- The `TOKEN_ENCRYPTION_KEY` must be exactly 64 characters (32 bytes in hex)
- Keep these keys secret - they protect your users' GitHub access tokens

### 3. GitHub OAuth App Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "OAuth Apps" → "New OAuth App"
3. Fill in the form:
   - **Application name**: DevSecOps Platform (or your preferred name)
   - **Homepage URL**: `http://localhost:5173`
   - **Application description**: AI-Assisted Security Scanning Platform
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
4. Click "Register application"
5. Copy the **Client ID** and generate a **Client Secret**
6. Add these to your `backend/.env` file:
   ```env
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   ```

### 4. Gemini API Key Setup

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" or "Get API Key"
4. Select a Google Cloud project (or create a new one)
5. Copy the generated API key
6. Add it to your `backend/.env` file:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

**Important Notes**:
- The platform uses the `gemini-2.0-flash-exp` model
- Ensure you have enabled the Generative Language API in your Google Cloud project
- Check your API quota and billing settings
- Free tier has usage limits - monitor your usage in Google Cloud Console
- For production, consider setting up billing and higher quotas

**Testing Your API Key**:
```bash
# Test the API key with a simple curl request
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_API_KEY"
```

### 5. MongoDB Setup

If using local MongoDB, ensure it's running:

```bash
# macOS
brew services start mongodb-community@6.0

# Linux
sudo systemctl start mongod

# Verify it's running
mongosh --eval "db.version()"
```

If using MongoDB Atlas (cloud):
1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Get your connection string
3. Update `MONGODB_URI` in `.env`:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/devsecops-platform
   ```

## Running the Application

### Development Mode

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

You should see:
```
Server running on port 3000
MongoDB connected successfully
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## Testing

### Run All Tests

From the root directory:
```bash
npm test
```

This runs both backend and frontend tests.

### Run Backend Tests Only

```bash
cd backend
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Run Frontend Tests Only

```bash
cd frontend
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Verify Test Setup

The project includes basic tests to verify the setup:
- Backend: `backend/src/config/database.test.ts`
- Frontend: `frontend/src/App.test.tsx`

### Test Types

**Backend Tests**:
1. **Unit Tests** (`backend/src/tests/unit/`):
   - Test individual services and functions
   - Mock external dependencies
   - Fast execution

2. **Property-Based Tests** (`backend/src/tests/properties/`):
   - Test universal properties with randomized inputs
   - Use `fast-check` library
   - Run 100+ iterations per test
   - Validate correctness properties from design document

3. **Integration Tests** (`backend/src/tests/integration/`):
   - Test complete workflows
   - Use real database (MongoDB Memory Server)
   - Test API endpoints with supertest

**Frontend Tests**:
1. **Component Tests** (`frontend/src/components/*.test.tsx`):
   - Test React components
   - Use React Testing Library
   - Test user interactions

2. **Property-Based Tests** (`frontend/src/tests/properties/`):
   - Test UI properties
   - Use `fast-check` library

### Running Specific Tests

```bash
# Run specific test file
npm test -- AuthenticationService.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="OAuth"

# Run tests in specific directory
npm test -- tests/unit/

# Run with verbose output
npm test -- --verbose
```

### Test Coverage

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
# Backend: open backend/coverage/lcov-report/index.html
# Frontend: open frontend/coverage/lcov-report/index.html
```

**Coverage Goals**:
- Minimum 80% code coverage
- All 45 correctness properties tested
- All critical user workflows covered

### Continuous Integration

Set up automated testing in CI/CD:

**GitHub Actions** (`.github/workflows/test.yml`):
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:6
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Run backend tests
        run: cd backend && npm test
        env:
          MONGODB_URI: mongodb://localhost:27017/test
          NODE_ENV: test
      
      - name: Run frontend tests
        run: cd frontend && npm test
      
      - name: Generate coverage
        run: |
          cd backend && npm run test:coverage
          cd ../frontend && npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Troubleshooting

### MongoDB Connection Issues

**Error: "MongoServerError: Authentication failed"**
- Check your MongoDB connection string
- Ensure username and password are correct
- For local MongoDB, authentication might not be required

**Error: "MongooseServerSelectionError: connect ECONNREFUSED"**
- Ensure MongoDB is running: `mongosh --eval "db.version()"`
- Check if MongoDB is listening on the correct port (default: 27017)

### GitHub OAuth Issues

**Error: "OAuth authorization failed"**
- Verify your Client ID and Client Secret are correct
- Ensure the callback URL matches exactly: `http://localhost:3000/api/auth/github/callback`
- Check that your OAuth app is not suspended

### Gemini API Issues

**Error: "API key not valid"**
- Verify your API key is correct
- Ensure you've enabled the Generative Language API in Google Cloud Console
- Check for any usage limits or billing issues

### Port Already in Use

**Error: "EADDRINUSE: address already in use"**

Backend (port 3000):
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9
```

Frontend (port 5173):
```bash
# Find and kill the process
lsof -ti:5173 | xargs kill -9
```

### Security Scanner Not Found

**Error: "semgrep: command not found"**
- Ensure the scanner is installed and in your PATH
- Try running `which semgrep` to verify installation
- Reinstall if necessary

### TypeScript Compilation Errors

```bash
# Clean and rebuild
cd backend
rm -rf dist node_modules
npm install
npm run build
```

### Test Failures

```bash
# Clear Jest cache
cd backend
npx jest --clearCache

cd frontend
npx jest --clearCache
```

## Next Steps

After successful setup:

1. **Verify all services are running**:
   - MongoDB: `mongosh --eval "db.version()"`
   - Backend: http://localhost:3000/health
   - Frontend: http://localhost:5173

2. **Test GitHub OAuth**:
   - Click "Login with GitHub" in the frontend
   - Authorize the application
   - Verify you're redirected back successfully

3. **Run tests**:
   - Backend: `cd backend && npm test`
   - Frontend: `cd frontend && npm test`
   - Verify all tests pass

4. **Start implementing features**:
   - Follow the tasks in `.kiro/specs/devsecops-platform/tasks.md`
   - Begin with Task 2: Authentication service

## Production Build

When ready to deploy to production:

### Backend Production Build

```bash
cd backend

# Install production dependencies only
npm ci --production

# Build TypeScript to JavaScript
npm run build

# Verify build output
ls -la dist/

# Start production server
npm start
```

The compiled code will be in `backend/dist/` directory.

### Frontend Production Build

```bash
cd frontend

# Install dependencies
npm ci

# Build optimized production bundle
npm run build

# Verify build output
ls -la dist/

# Preview production build (optional)
npm run preview
```

The production build will be in `frontend/dist/` directory.

### Production Deployment

For detailed deployment instructions, see:
- `docs/DEPLOYMENT.md` - Comprehensive deployment guide
- `docs/ENVIRONMENT_VARIABLES.md` - Environment configuration reference
- `README.md` - Quick start and overview

**Key Production Considerations**:
1. Use different environment variables for production
2. Enable HTTPS for all endpoints
3. Configure proper CORS origins
4. Set up monitoring and logging
5. Configure database backups
6. Use process manager (PM2) or container orchestration
7. Set up reverse proxy (Nginx)
8. Configure SSL certificates
9. Enable rate limiting
10. Set up health checks and alerts

## Support

For issues or questions:
- Check the main README.md
- Review the requirements and design documents in `.kiro/specs/devsecops-platform/`
- Ensure all prerequisites are correctly installed
