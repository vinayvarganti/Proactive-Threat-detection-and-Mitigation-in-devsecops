# Quick Fix: Get the Application Running

## The Problem
Your backend server is failing because MongoDB Atlas won't accept connections from your IP address.

## The Solution (Takes 2 minutes)

### Step 1: Whitelist Your IP in MongoDB Atlas

1. Open your browser and go to: **https://cloud.mongodb.com/**

2. Log in with your MongoDB Atlas credentials

3. Click on **"Network Access"** in the left sidebar (under Security section)

4. Click the green **"Add IP Address"** button

5. In the popup, click **"Add Current IP Address"**
   - This will automatically detect and add your current IP
   - Or manually enter `0.0.0.0/0` to allow all IPs (development only)

6. Click **"Confirm"**

7. Wait about 30 seconds for the changes to take effect

### Step 2: Restart the Backend Server

The backend server should automatically reconnect. If not:

1. Stop the current backend process (if running)
2. In your terminal, run:
   ```bash
   cd backend
   npm run dev
   ```

### Step 3: Verify It's Working

1. Open http://localhost:5173 in your browser
2. You should see the DevSecOps Platform login page
3. Click "Login with GitHub"
4. If it works, you're all set!

## What's Already Working

✅ **Gitleaks Scanner** - Integrated and finding real secrets
✅ **Frontend** - Running on http://localhost:5173
✅ **Scanner Configuration** - Real scanning enabled (not mock data)

## What Needs MongoDB

❌ **Authentication** - Storing user sessions
❌ **Repository Management** - Saving scanned repositories
❌ **Vulnerability Storage** - Persisting scan results
❌ **Report History** - Viewing past scans

## Alternative: Use Local MongoDB

If you can't access MongoDB Atlas, install MongoDB locally:

1. Download from: https://www.mongodb.com/try/download/community
2. Install and start the MongoDB service
3. Update `backend/.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017/devsecops-platform
   ```
4. Restart backend server

---

**Once MongoDB is connected, your application will be fully functional with real security scanning!**
