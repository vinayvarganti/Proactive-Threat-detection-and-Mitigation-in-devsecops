# JWT Authentication Deployment Guide

## What Was Changed

### Backend Changes
1. ✅ Created `JWTService.ts` - Generates and verifies JWT tokens
2. ✅ Created `jwtAuth.ts` middleware - Authenticates requests using Bearer tokens
3. ✅ Updated all route files to use JWT authentication:
   - `auth.routes.ts` - Returns JWT token in callback redirect
   - `report.routes.ts` - Uses `authenticateJWT` middleware
   - `repository.routes.ts` - Uses `authenticateJWT` middleware
   - `commit.routes.ts` - Uses `authenticateJWT` middleware
   - `fix.routes.ts` - Uses `authenticateJWT` middleware
   - `vulnerability.routes.ts` - Uses `authenticateJWT` middleware

### Frontend Changes
1. ✅ Updated `authService.ts`:
   - Added token storage methods (localStorage)
   - Modified `handleOAuthCallback()` to extract JWT from URL
   - Simplified `logout()` to just clear token
   - Updated `getAuthStatus()` to check token validity

2. ✅ Updated `axios.config.ts`:
   - Added request interceptor to include `Authorization: Bearer <token>` header

3. ✅ Updated `Authentication.tsx`:
   - Modified OAuth callback handling to extract JWT from URL
   - Simplified logout flow

## Deployment Steps

### 1. Redeploy Backend to Render
The backend code has been pushed to GitHub. Render will automatically redeploy.

**Environment Variables Required:**
- `JWT_SECRET` - Set this in Render dashboard (use a strong random string)
- `FRONTEND_URL` - Already set to `https://proactive-threat-detection-and-miti.vercel.app`
- `GITHUB_CALLBACK_URL` - Already set to `https://proactive-threat-detection-and-fcro.onrender.com/api/auth/github/callback`

**To generate a secure JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Redeploy Frontend to Vercel
The frontend code has been pushed to GitHub. Vercel will automatically redeploy.

**Environment Variables Required:**
- `VITE_API_BASE_URL` - Already set to `https://proactive-threat-detection-and-fcro.onrender.com`

### 3. Test the Authentication Flow

1. **Clear browser storage** (important!):
   - Open DevTools (F12)
   - Go to Application tab
   - Clear Local Storage
   - Clear Cookies

2. **Test login**:
   - Visit `https://proactive-threat-detection-and-miti.vercel.app`
   - Click "Sign in with GitHub"
   - Complete GitHub OAuth
   - You should be redirected back with a JWT token in the URL
   - The token should be stored in localStorage
   - You should see the dashboard

3. **Test API calls**:
   - Navigate to repositories page
   - Check browser DevTools Network tab
   - Verify requests include `Authorization: Bearer <token>` header
   - Verify you get 200 responses (not 401)

4. **Test logout**:
   - Click logout
   - Token should be cleared from localStorage
   - You should be redirected to login page

## Authentication Flow

### Old Flow (Session-based)
1. User clicks login → Redirects to GitHub
2. GitHub redirects back with code
3. Backend exchanges code for GitHub token
4. Backend creates session cookie
5. Frontend uses session cookie for API calls
❌ **Problem**: Cross-domain cookies don't work reliably

### New Flow (JWT-based)
1. User clicks login → Redirects to GitHub
2. GitHub redirects back with code
3. Backend exchanges code for GitHub token
4. Backend generates JWT token
5. Backend redirects to frontend with JWT in URL: `?token=xxx&username=xxx`
6. Frontend extracts JWT and stores in localStorage
7. Frontend includes JWT in Authorization header for all API calls
✅ **Solution**: Works across domains, no cookie issues

## Troubleshooting

### Issue: Still getting 401 errors
- Clear localStorage and cookies
- Check that JWT_SECRET is set in Render
- Check browser DevTools → Network → Request Headers for Authorization header
- Verify backend logs show JWT authentication

### Issue: Token not being stored
- Check browser console for errors
- Verify URL contains `?token=xxx&username=xxx` after OAuth callback
- Check localStorage in DevTools → Application tab

### Issue: CORS errors
- Verify FRONTEND_URL is set correctly in Render
- Check backend CORS configuration includes production frontend URL

## Next Steps (Optional Cleanup)

After confirming JWT authentication works:

1. Remove session middleware from `backend/src/index.ts`:
   - Remove `express-session` import
   - Remove session configuration
   - Remove `app.use(session(...))`

2. Remove session-related dependencies from `backend/package.json`:
   - `express-session`
   - `@types/express-session`
   - `connect-mongo`

3. Update `backend/src/middleware/session.ts` or delete if no longer needed

## Security Notes

- JWT tokens are stored in localStorage (XSS vulnerable but acceptable for this use case)
- Tokens expire after 7 days (configurable in JWTService.ts)
- Always use HTTPS in production
- JWT_SECRET should be a strong random string (64+ characters)
- Never commit JWT_SECRET to version control
