# DevSecOps Platform

AI-Assisted Proactive Threat Detection and Mitigation DevSecOps Platform

## Overview

This platform integrates with GitHub repositories to perform automated security scanning using open-source tools (Semgrep, Gitleaks, Trivy) and provides both manual and AI-assisted correction mechanisms using Gemini 2.5 Flash.

## Features

- **GitHub Integration**: OAuth authentication and repository access
- **Multi-Scanner Security Analysis**: Semgrep (code), Trivy (dependencies), Gitleaks (secrets)
- **AI-Assisted Fixes**: Gemini 2.5 Flash powered vulnerability remediation
- **Manual Code Editor**: Monaco-based editor for manual fixes
- **Vulnerability Dashboard**: Comprehensive view with filtering and sorting
- **Automated Commits**: Push fixes directly to GitHub
- **Historical Reports**: Track security improvements over time
- **Multi-Repository Support**: Manage multiple repositories simultaneously

## Project Structure

## Prerequisites

- Node.js 18+ and npm
- MongoDB 6+
- Git
- Security scanning tools:
  - Semgrep: `pip install semgrep`
  - Trivy: [Installation guide](https://aquasecurity.github.io/trivy/latest/getting-started/installation/)
  - Gitleaks: [Installation guide](https://github.com/gitleaks/gitleaks#installing)

## Setup Instructions

### 1. Install Dependencies

```bash
# Install all dependencies (root, backend, and frontend)
npm run install:all
```

### 2. Configure Environment Variables

#### Backend Environment Variables

Create a `.env` file in the `backend/` directory based on `.env.example`:

```bash
cd backend
cp .env.example .env
```

Edit the `.env` file with your configuration. All required environment variables are documented below:

#### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Port for the backend server |
| `NODE_ENV` | No | `development` | Environment mode (`development` or `production`) |
| `FRONTEND_URL` | No | `http://localhost:5173` | Frontend URL for CORS configuration |

#### MongoDB Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | Yes | - | MongoDB connection string |

**Format**: `mongodb://localhost:27017/devsecops-platform` (local) or `mongodb+srv://username:password@cluster.mongodb.net/devsecops-platform` (Atlas)

#### GitHub OAuth Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_CLIENT_ID` | Yes | - | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Yes | - | GitHub OAuth App Client Secret |
| `GITHUB_CALLBACK_URL` | Yes | - | OAuth callback URL (must match GitHub app settings) |

**Setup Instructions**: See [GitHub OAuth App Setup](#3-github-oauth-app-setup) section below.

#### Gemini AI Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | - | Google Gemini API key for AI-assisted fixes |

**Model Used**: `gemini-2.0-flash-exp`

**Setup Instructions**: See [Gemini API Key Setup](#4-gemini-api-key-setup) section below.

#### Security Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TOKEN_ENCRYPTION_KEY` | Yes | - | 32+ character key for encrypting GitHub tokens (use hex string) |
| `SESSION_SECRET` | Yes | - | Secret key for session management (use random string) |

**Generate Secure Keys**:
```bash
# Generate TOKEN_ENCRYPTION_KEY (64 character hex string)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET (128 character hex string)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### Rate Limiting Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SCAN_RATE_LIMIT` | No | `10` | Maximum number of scans per time window |
| `SCAN_RATE_WINDOW_HOURS` | No | `1` | Time window for rate limiting (in hours) |

#### Frontend Environment Variables (Optional)

Create a `.env` file in the `frontend/` directory if you need to customize the API URL:

```bash
cd frontend
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | Empty (uses proxy) | Backend API URL (only needed for production) |

**Note**: In development, the frontend uses Vite's proxy to forward `/api` requests to `http://localhost:3000`. You only need to set `VITE_API_BASE_URL` for production deployments.

### 3. GitHub OAuth App Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - Application name: DevSecOps Platform
   - Homepage URL: http://localhost:5173
   - Authorization callback URL: http://localhost:3000/api/auth/github/callback
4. Copy the Client ID and Client Secret to your `.env` file

### 4. Gemini API Key Setup

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key to your `.env` file

## Running the Application

### Development Mode

Start both backend and frontend servers in separate terminals:

```bash
# Terminal 1 - Start backend server
cd backend
npm run dev

# Terminal 2 - Start frontend development server
cd frontend
npm run dev
```

The backend will run on http://localhost:3000 and the frontend on http://localhost:5173.

**Development Features**:
- Hot module reloading for both frontend and backend
- Detailed error messages and stack traces
- Vite proxy forwards `/api` requests from frontend to backend
- Session cookies work across localhost ports

### Production Build

#### Backend Production Build

```bash
cd backend

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

The compiled JavaScript will be in the `backend/dist/` directory.

#### Frontend Production Build

```bash
cd frontend

# Build optimized production bundle
npm run build

# Preview production build locally (optional)
npm run preview
```

The production build will be in the `frontend/dist/` directory.

### Production Deployment

#### Environment Setup

1. **Set production environment variables**:
   ```bash
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend-domain.com
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/devsecops-platform
   # ... other production values
   ```

2. **Use different secrets** for production (never reuse development secrets)

3. **Enable HTTPS** for both frontend and backend

#### Deployment Options

**Option 1: Traditional Server (VPS, EC2, etc.)**

Backend:
```bash
# Install dependencies
cd backend
npm ci --production

# Build
npm run build

# Start with process manager (PM2)
npm install -g pm2
pm2 start dist/index.js --name devsecops-backend

# Or use systemd service
sudo systemctl start devsecops-backend
```

Frontend:
```bash
# Build
cd frontend
npm ci
npm run build

# Serve with nginx, Apache, or any static file server
# Copy dist/ contents to web server root
```

**Option 2: Docker**

See `docs/DEPLOYMENT.md` for Docker deployment instructions.

**Option 3: Cloud Platforms**

- **Heroku**: Use Procfile for backend, static buildpack for frontend
- **Vercel**: Deploy frontend directly, backend as serverless functions
- **AWS**: EC2 for backend, S3+CloudFront for frontend
- **Azure**: App Service for both frontend and backend
- **Google Cloud**: Cloud Run for backend, Cloud Storage for frontend

#### Reverse Proxy Configuration (Nginx)

```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name app.yourdomain.com;
    root /var/www/devsecops-frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### SSL/TLS Configuration

Use Let's Encrypt for free SSL certificates:

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com

# Auto-renewal is configured automatically
```

#### Health Checks

The backend provides a health check endpoint:

```bash
curl http://localhost:3000/health
# Response: {"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

Use this for:
- Load balancer health checks
- Monitoring systems
- Container orchestration (Kubernetes liveness/readiness probes)

#### Monitoring and Logging

**Backend Logs**:
- Logs are written to `backend/logs/` directory
- `combined.log`: All logs
- `error.log`: Error logs only
- Use log aggregation services (ELK, Splunk, CloudWatch)

**Frontend Monitoring**:
- Use browser error tracking (Sentry, Rollbar)
- Monitor Core Web Vitals
- Set up analytics (Google Analytics, Mixpanel)

#### Scaling Considerations

**Backend**:
- Run multiple instances behind a load balancer
- Use session store (Redis) for session persistence across instances
- Consider horizontal pod autoscaling in Kubernetes

**Database**:
- Use MongoDB Atlas for managed scaling
- Set up replica sets for high availability
- Configure backups and point-in-time recovery

**Frontend**:
- Use CDN for static assets (CloudFront, Cloudflare)
- Enable gzip/brotli compression
- Implement caching strategies

## Testing

### Running Tests

#### All Tests (Root)

From the root directory:
```bash
# Run all tests (backend + frontend)
npm test

# Run with coverage
npm run test:coverage
```

#### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch

# Run specific test file
npm test -- AuthenticationService.test.ts

# Run specific test suite
npm test -- --testNamePattern="OAuth"
```

**Test Types**:
- **Unit Tests**: Test individual functions and classes
  - Location: `backend/src/tests/unit/`
  - Example: `AuthenticationService.test.ts`
- **Property-Based Tests**: Test universal properties with randomized inputs
  - Location: `backend/src/tests/properties/`
  - Example: `auth.properties.test.ts`
  - Uses `fast-check` library
- **Integration Tests**: Test complete workflows
  - Location: `backend/src/tests/integration/`
  - Example: `scan-workflow.test.ts`

#### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch

# Run specific test file
npm test -- Authentication.test.tsx
```

**Test Types**:
- **Component Tests**: Test React components
  - Location: `frontend/src/components/*.test.tsx`
  - Uses React Testing Library
- **Property-Based Tests**: Test UI properties
  - Location: `frontend/src/tests/properties/`
  - Uses `fast-check` library

### Test Coverage Goals

- **Minimum Coverage**: 80% code coverage
- **Property Tests**: All 45 correctness properties implemented
- **Integration Tests**: All critical user workflows covered

### Continuous Integration

Tests should run automatically on:
- Every pull request
- Every commit to main branch
- Scheduled nightly builds (extended property tests)

**Example GitHub Actions Workflow**:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## API Documentation

The backend API will be available at `http://localhost:3000/api` with the following endpoints:

- **Authentication**: `/api/auth/*`
- **Repositories**: `/api/repositories/*`
- **Vulnerabilities**: `/api/vulnerabilities/*`
- **Fixes**: `/api/fixes/*`
- **Commits**: `/api/commits/*`
- **Reports**: `/api/reports/*`

For detailed API documentation, see the design document at `.kiro/specs/devsecops-platform/design.md`.

## Documentation

- **[README.md](README.md)** - This file, quick start guide
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Detailed setup instructions
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production deployment guide
- **[docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)** - Environment configuration reference
- **[docs/INTEGRATION_CHECKLIST.md](docs/INTEGRATION_CHECKLIST.md)** - Integration verification checklist
- **[.kiro/specs/devsecops-platform/requirements.md](.kiro/specs/devsecops-platform/requirements.md)** - Requirements specification
- **[.kiro/specs/devsecops-platform/design.md](.kiro/specs/devsecops-platform/design.md)** - Design document with architecture and API details
- **[.kiro/specs/devsecops-platform/tasks.md](.kiro/specs/devsecops-platform/tasks.md)** - Implementation task list

## Project Structure

```
devsecops-platform/
├── backend/              # Node.js/Express backend API
│   ├── src/
│   │   ├── config/       # Configuration files
│   │   ├── models/       # MongoDB schemas
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   ├── middleware/   # Express middleware
│   │   ├── types/        # TypeScript types
│   │   └── tests/        # Test files
│   │       ├── unit/     # Unit tests
│   │       ├── properties/ # Property-based tests
│   │       └── integration/ # Integration tests
│   ├── logs/             # Application logs
│   ├── .env              # Environment variables (not in git)
│   ├── .env.example      # Environment template
│   └── package.json
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API client services
│   │   ├── contexts/     # React contexts
│   │   ├── config/       # Configuration
│   │   ├── types/        # TypeScript types
│   │   └── tests/        # Test files
│   │       └── properties/ # Property-based tests
│   ├── .env.example      # Environment template
│   └── package.json
├── docs/                 # Documentation
│   ├── DEPLOYMENT.md     # Deployment guide
│   ├── ENVIRONMENT_VARIABLES.md # Environment reference
│   └── INTEGRATION_CHECKLIST.md # Integration checklist
├── scripts/              # Utility scripts
│   └── verify-integration.ts # Integration verification
├── .kiro/specs/          # Specification documents
│   └── devsecops-platform/
│       ├── requirements.md # Requirements
│       ├── design.md     # Design document
│       └── tasks.md      # Implementation tasks
├── README.md             # This file
├── SETUP_GUIDE.md        # Detailed setup guide
└── package.json          # Root workspace configuration
```

## Security Scanning Tools

Ensure the following tools are installed and accessible in your PATH:

### Semgrep
**Purpose**: Detects code-level security vulnerabilities

**Installation**:
```bash
# Using pip
pip install semgrep

# Using Homebrew (macOS)
brew install semgrep

# Using Docker
docker pull returntocorp/semgrep
```

**Verify**: `semgrep --version`

**Documentation**: https://semgrep.dev/docs/getting-started/

### Trivy
**Purpose**: Detects dependency vulnerabilities in packages and containers

**Installation**:
```bash
# macOS
brew install aquasecurity/trivy/trivy

# Linux (Debian/Ubuntu)
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update
sudo apt-get install trivy

# Using Docker
docker pull aquasec/trivy
```

**Verify**: `trivy --version`

**Documentation**: https://aquasecurity.github.io/trivy/

### Gitleaks
**Purpose**: Detects exposed secrets and credentials in code

**Installation**:
```bash
# macOS
brew install gitleaks

# Linux
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.1/gitleaks_8.18.1_linux_x64.tar.gz
tar -xzf gitleaks_8.18.1_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/

# Using Docker
docker pull zricethezav/gitleaks
```

**Verify**: `gitleaks version`

**Documentation**: https://github.com/gitleaks/gitleaks

**Important**: All three scanners must be installed and accessible in your system PATH for the platform to function correctly.

## License

MIT
