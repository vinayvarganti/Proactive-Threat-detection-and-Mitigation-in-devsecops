# Trivy Installation Guide for Windows

## Manual Installation Steps

Since automated download is encountering issues, please follow these manual steps:

### Option 1: Download from GitHub Releases (Recommended)

1. Visit the Trivy releases page:
   https://github.com/aquasecurity/trivy/releases/latest

2. Download the Windows binary:
   - Look for a file named like: `trivy_X.X.X_Windows-64bit.tar.gz` or `trivy_X.X.X_windows-amd64.tar.gz`
   - Latest version is typically at the top

3. Extract the archive:
   - Extract the downloaded file to `D:\Major Project\tools\trivy\`
   - You should have `trivy.exe` in that folder

4. Update your `.env` file:
   ```
   TRIVY_PATH=D:/Major Project/tools/trivy/trivy.exe
   ```

### Option 2: Using Chocolatey (Run as Administrator)

```powershell
# Open PowerShell as Administrator
choco install trivy -y

# After installation, update .env with:
TRIVY_PATH=trivy
```

### Option 3: Using Scoop

```powershell
scoop install trivy

# After installation, update .env with:
TRIVY_PATH=trivy
```

## Verify Installation

After installation, verify Trivy is working:

```powershell
# If installed to tools/trivy
.\tools\trivy\trivy.exe --version

# If installed globally
trivy --version
```

## Current Scanner Status

- ✅ **Gitleaks** (v8.18.4) - Working - Detects secrets
- ⚠️ **Semgrep** (v1.153.1) - Partially working - Code analysis
- ❌ **Trivy** - Not installed - Dependency scanning

Once Trivy is installed, all 3 scanners will be operational!

## What Trivy Scans

- **Dependency vulnerabilities** in package.json, requirements.txt, go.mod, etc.
- **Known CVEs** in third-party libraries
- **Container image vulnerabilities** (if scanning Docker images)
- **Infrastructure as Code** misconfigurations

## Troubleshooting

If you encounter issues:

1. Make sure the path in `.env` matches where trivy.exe is located
2. Use forward slashes `/` or escaped backslashes `\\` in the path
3. Restart the backend server after updating `.env`
4. Check backend logs for any scanner errors
