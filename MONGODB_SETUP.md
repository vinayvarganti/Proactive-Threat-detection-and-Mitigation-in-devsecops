# MongoDB Connection Setup

## Current Issue
The backend server cannot connect to MongoDB Atlas because your IP address is not whitelisted.

## Error Message
```
MongooseServerSelectionError: Could not connect to any servers in your MongoDB Atlas cluster.
One common reason is that you're trying to access the database from an IP that isn't whitelisted.
```

## Solution Options

### Option 1: Whitelist Your IP in MongoDB Atlas (Recommended)

1. **Go to MongoDB Atlas Dashboard**
   - Visit: https://cloud.mongodb.com/
   - Log in with your credentials

2. **Navigate to Network Access**
   - Select your project (Cluster0)
   - Click "Network Access" in the left sidebar under "Security"

3. **Add Your IP Address**
   - Click the "Add IP Address" button
   - Choose one of:
     - **"Add Current IP Address"** - Automatically detects and adds your current IP (recommended)
     - **"Allow Access from Anywhere"** - Enter `0.0.0.0/0` (for development only, not secure)
     - **Manual Entry** - Enter your specific IP address

4. **Confirm and Wait**
   - Click "Confirm"
   - Wait 1-2 minutes for the changes to propagate

5. **Restart Backend Server**
   - The server should automatically reconnect once your IP is whitelisted

### Option 2: Use Local MongoDB

If you have MongoDB installed locally:

1. **Update backend/.env**
   ```env
   MONGODB_URI=mongodb://localhost:27017/devsecops-platform
   ```

2. **Start MongoDB Service**
   - Windows: `net start MongoDB`
   - Mac/Linux: `sudo systemctl start mongod`

3. **Restart Backend Server**

### Option 3: Install MongoDB Locally

If you don't have MongoDB installed:

1. **Download MongoDB Community Server**
   - Visit: https://www.mongodb.com/try/download/community
   - Download the installer for your OS

2. **Install MongoDB**
   - Run the installer
   - Choose "Complete" installation
   - Install MongoDB as a service

3. **Update backend/.env**
   ```env
   MONGODB_URI=mongodb://localhost:27017/devsecops-platform
   ```

4. **Restart Backend Server**

## Verifying the Connection

Once you've completed one of the above options:

1. **Check Backend Logs**
   - Look for: "MongoDB connected successfully"
   - If you see this, the connection is working

2. **Test the Frontend**
   - Open http://localhost:5173
   - Try to log in with GitHub
   - If authentication works, MongoDB is connected

## Current Configuration

Your current MongoDB connection string:
```
mongodb+srv://vinay:MAv9jlxnFgIx7WFq@cluster0.n75qaw.mongodb.net/devsecops-platform?retryWrites=true&w=majority&appName=Cluster0
```

This is a MongoDB Atlas connection string that requires:
- Valid credentials (username: vinay)
- Whitelisted IP address
- Active internet connection

## Next Steps

1. Choose one of the solution options above
2. Implement the solution
3. Restart the backend server
4. Verify the connection is working
5. Test the application

The scanners are already integrated and working - once MongoDB is connected, you'll be able to scan repositories and see real vulnerability results!
