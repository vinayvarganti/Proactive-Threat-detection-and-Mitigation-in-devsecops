# Environment Variables Reference

This document provides a comprehensive reference for all environment variables used in the DevSecOps Platform.

## Backend Environment Variables

All backend environment variables should be defined in `backend/.env` file.

### Server Configuration

#### PORT
- **Required**: No
- **Default**: `3000`
- **Type**: Number
- **Description**: The port number on which the backend server will listen
- **Example**: `PORT=3000`
- **Production**: Can be set to any available port (commonly 80, 443, 8080, or 3000)

#### NODE_ENV
- **Required**: No
- **Default**: `development`
- **Type**: String
- **Values**: `development`, `production`, `test`
- **Description**: Determines the environment mode for the application
- **Example**: `NODE_ENV=production`
- **Impact**:
  - In `production`: Enables HTTPS-only cookies, optimized logging, stricter security
  - In `development`: Enables detailed error messages, hot reloading support
  - In `test`: Disables certain features for testing

#### FRONTEND_URL
- **Required**: No
- **Default**: `http://localhost:5173`
- **Type**: String (URL)
- **Description**: The URL where the frontend application is hosted (used for CORS configuration)
- **Example**: `FRONTEND_URL=https://app.yourdomain.com`
- **Production**: Must match your actual frontend domain

---

### MongoDB Configuration

#### MONGODB_URI
- **Required**: Yes
- **Type**: String (Connection String)
- **Description**: MongoDB connection string for database access
- **Examples**:
  - Local: `mongodb://localhost:27017/devsecops-platform`
  - Atlas: `mongodb+srv://username:password@cluster.mongodb.net/devsecops-platform`
  - Docker: `mongodb://mongodb:27017/devsecops-platform`
  - With auth: `mongodb://admin:password@localhost:27017/devsecops-platform?authSource=admin`
- **Security**: 
  - Use strong passwords for production
  - Enable authentication in production
  - Use IP whitelisting for Atlas clusters
  - Consider using connection string encryption

---

### GitHub OAuth Configuration

#### GITHUB_CLIENT_ID
- **Required**: Yes
- **Type**: String
- **Description**: OAuth App Client ID from GitHub
- **Example**: `GITHUB_CLIENT_ID=Ov23lizzp1tsAPy3rHbB`
- **How to Get**:
  1. Go to GitHub Settings → Developer settings → OAuth Apps
  2. Create a new OAuth App
  3. Copy the Client ID
- **Security**: Not sensitive, can be public

#### GITHUB_CLIENT_SECRET
- **Required**: Yes
- **Type**: String
- **Description**: OAuth App Client Secret from GitHub
- **Example**: `GITHUB_CLIENT_SECRET=16e20b75c87d74caa8d0eabacb374abb84e95ac7`
- **How to Get**:
  1. In your GitHub OAuth App settings
  2. Generate a new client secret
  3. Copy immediately (shown only once)
- **Security**: 
  - Keep this secret and never commit to version control
  - Rotate periodically
  - Use different secrets for dev/staging/production

#### GITHUB_CALLBACK_URL
- **Required**: Yes
- **Type**: String (URL)
- **Description**: OAuth callback URL that GitHub will redirect to after authorization
- **Examples**:
  - Development: `http://localhost:3000/api/auth/github/callback`
  - Production: `https://api.yourdomain.com/api/auth/github/callback`
- **Important**: Must exactly match the callback URL configured in your GitHub OAuth App
- **Path**: Always `/api/auth/github/callback`

---

### Gemini AI Configuration

#### GEMINI_API_KEY
- **Required**: Yes
- **Type**: String
- **Description**: Google Gemini API key for AI-assisted vulnerability fixes
- **Example**: `GEMINI_API_KEY=AIzaSyBIeXF61t-DxJoDCmVvVu06miqIDauKHTw`
- **How to Get**:
  1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
  2. Sign in with Google account
  3. Create API key
  4. Enable Generative Language API
- **Model Used**: `gemini-2.0-flash-exp`
- **Security**:
  - Keep secret and never commit to version control
  - Monitor usage in Google Cloud Console
  - Set up billing alerts
  - Consider API key restrictions (HTTP referrers, IP addresses)
- **Quotas**:
  - Free tier: Limited requests per minute
  - Check current limits in Google Cloud Console
  - Consider upgrading for production use

---

### Security Configuration

#### TOKEN_ENCRYPTION_KEY
- **Required**: Yes
- **Type**: String (Hex)
- **Length**: Exactly 64 characters (32 bytes in hex)
- **Description**: Encryption key for GitHub access tokens stored in database
- **Example**: `TOKEN_ENCRYPTION_KEY=8f3c150dffd913e6e03787b9f73427ae7dbc458e6cd98c8ab8ec65a0b3fa42f4`
- **How to Generate**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **Security**:
  - Must be exactly 64 hex characters (32 bytes)
  - Use different keys for each environment
  - Never commit to version control
  - Store securely (environment variables, secret manager)
  - Rotate periodically (requires re-encrypting all tokens)
  - If compromised, all stored tokens must be considered compromised

#### SESSION_SECRET
- **Required**: Yes
- **Type**: String
- **Length**: Minimum 64 characters (recommended 128)
- **Description**: Secret key for signing session cookies
- **Example**: `SESSION_SECRET=86f35116bdafda9547afb2733444b1eae7bdf0dd72e29fbb013997682fdc000d...`
- **How to Generate**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- **Security**:
  - Use a long, random string
  - Different secret for each environment
  - Never commit to version control
  - Rotate periodically (invalidates all existing sessions)
  - If compromised, all sessions must be considered compromised

---

### Rate Limiting Configuration

#### SCAN_RATE_LIMIT
- **Required**: No
- **Default**: `10`
- **Type**: Number
- **Description**: Maximum number of scans a user can initiate within the time window
- **Example**: `SCAN_RATE_LIMIT=10`
- **Recommendations**:
  - Development: 10-20 for testing
  - Production: 5-10 to prevent abuse
  - Adjust based on your scanner capacity and user needs

#### SCAN_RATE_WINDOW_HOURS
- **Required**: No
- **Default**: `1`
- **Type**: Number
- **Description**: Time window for rate limiting in hours
- **Example**: `SCAN_RATE_WINDOW_HOURS=1`
- **Recommendations**:
  - 1 hour for strict limiting
  - 24 hours for daily limits
  - Combine with SCAN_RATE_LIMIT (e.g., 50 scans per 24 hours)

---

## Frontend Environment Variables

Frontend environment variables should be defined in `frontend/.env` file (optional).

### API Configuration

#### VITE_API_BASE_URL
- **Required**: No
- **Default**: Empty (uses Vite proxy)
- **Type**: String (URL)
- **Description**: Base URL for backend API requests
- **Examples**:
  - Development: Leave empty (uses proxy)
  - Production: `https://api.yourdomain.com`
- **When to Set**:
  - Not needed in development (Vite proxy handles it)
  - Required for production builds
  - Required when frontend and backend are on different domains
- **Note**: Must NOT include trailing slash or `/api` path

---

## Environment-Specific Configurations

### Development Environment

```env
# backend/.env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/devsecops-platform
GITHUB_CLIENT_ID=your_dev_client_id
GITHUB_CLIENT_SECRET=your_dev_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
GEMINI_API_KEY=your_dev_api_key
TOKEN_ENCRYPTION_KEY=dev_encryption_key_64_chars
SESSION_SECRET=dev_session_secret
SCAN_RATE_LIMIT=20
SCAN_RATE_WINDOW_HOURS=1
```

```env
# frontend/.env (optional)
# Leave empty to use Vite proxy
VITE_API_BASE_URL=
```

### Production Environment

```env
# backend/.env
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://app.yourdomain.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/devsecops-platform
GITHUB_CLIENT_ID=your_prod_client_id
GITHUB_CLIENT_SECRET=your_prod_client_secret
GITHUB_CALLBACK_URL=https://api.yourdomain.com/api/auth/github/callback
GEMINI_API_KEY=your_prod_api_key
TOKEN_ENCRYPTION_KEY=prod_encryption_key_64_chars_different_from_dev
SESSION_SECRET=prod_session_secret_different_from_dev
SCAN_RATE_LIMIT=10
SCAN_RATE_WINDOW_HOURS=1
```

```env
# frontend/.env
VITE_API_BASE_URL=https://api.yourdomain.com
```

---

## Security Best Practices

### General Guidelines

1. **Never commit `.env` files** to version control
   - Add `.env` to `.gitignore`
   - Use `.env.example` as a template

2. **Use different values for each environment**
   - Development, staging, and production should have separate credentials
   - Prevents accidental data leaks between environments

3. **Rotate secrets regularly**
   - Change encryption keys, session secrets, and API keys periodically
   - Have a rotation plan for production

4. **Use secret management services in production**
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault
   - Google Secret Manager

5. **Limit access to production secrets**
   - Only authorized personnel should have access
   - Use role-based access control
   - Audit secret access

6. **Monitor for exposed secrets**
   - Use tools like Gitleaks to scan for accidentally committed secrets
   - Set up alerts for secret exposure

### Encryption Key Management

- **TOKEN_ENCRYPTION_KEY**:
  - If lost, all stored GitHub tokens become unrecoverable
  - Users will need to re-authenticate
  - Keep secure backups in production

- **SESSION_SECRET**:
  - If changed, all active sessions are invalidated
  - Users will need to log in again
  - Plan rotations during low-traffic periods

### API Key Management

- **GEMINI_API_KEY**:
  - Monitor usage and costs
  - Set up billing alerts
  - Consider API key restrictions
  - Have backup keys ready

- **GITHUB_CLIENT_SECRET**:
  - Can be regenerated in GitHub settings
  - Regenerating invalidates the old secret immediately
  - Update all environments after regeneration

---

## Troubleshooting

### Common Issues

**"MongoDB connection failed"**
- Check `MONGODB_URI` format
- Verify MongoDB is running
- Check network connectivity
- Verify credentials

**"GitHub OAuth failed"**
- Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
- Check `GITHUB_CALLBACK_URL` matches GitHub app settings exactly
- Ensure OAuth app is not suspended

**"Gemini API error"**
- Verify `GEMINI_API_KEY` is valid
- Check API is enabled in Google Cloud Console
- Verify quota limits
- Check billing status

**"Token decryption failed"**
- `TOKEN_ENCRYPTION_KEY` may have changed
- Key must be exactly 64 hex characters
- Users need to re-authenticate if key changed

**"Session invalid"**
- `SESSION_SECRET` may have changed
- Users need to log in again
- Check cookie settings in production (secure, sameSite)

---

## Validation

Use this checklist to validate your environment configuration:

- [ ] All required variables are set
- [ ] MongoDB connection string is correct and accessible
- [ ] GitHub OAuth app is configured with matching callback URL
- [ ] Gemini API key is valid and has quota
- [ ] TOKEN_ENCRYPTION_KEY is exactly 64 hex characters
- [ ] SESSION_SECRET is a long random string
- [ ] Rate limiting values are appropriate for your use case
- [ ] Production uses different secrets than development
- [ ] All secrets are stored securely (not in version control)
- [ ] FRONTEND_URL matches your actual frontend domain
- [ ] CORS is properly configured

---

## Additional Resources

- [MongoDB Connection Strings](https://www.mongodb.com/docs/manual/reference/connection-string/)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Google AI Studio](https://makersuite.google.com/app/apikey)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [Express Session](https://github.com/expressjs/session)
