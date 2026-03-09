# Install Security Scanners Script
# This script downloads and installs Gitleaks, Trivy, and Semgrep

$ErrorActionPreference = "Stop"
$ToolsDir = "$PSScriptRoot\..\tools"

# Create tools directory if it doesn't exist
if (-not (Test-Path $ToolsDir)) {
    New-Item -ItemType Directory -Path $ToolsDir | Out-Null
    Write-Host "Created tools directory: $ToolsDir" -ForegroundColor Green
}

# Function to download and extract files
function Install-Tool {
    param(
        [string]$Name,
        [string]$Url,
        [string]$FileName
    )
    
    Write-Host "`nInstalling $Name..." -ForegroundColor Cyan
    
    $DownloadPath = Join-Path $ToolsDir $FileName
    $ExtractPath = Join-Path $ToolsDir $Name
    
    # Download
    Write-Host "Downloading from $Url..."
    Invoke-WebRequest -Uri $Url -OutFile $DownloadPath -UseBasicParsing
    
    # Extract
    Write-Host "Extracting..."
    if ($FileName.EndsWith(".zip")) {
        Expand-Archive -Path $DownloadPath -DestinationPath $ExtractPath -Force
    } elseif ($FileName.EndsWith(".tar.gz")) {
        tar -xzf $DownloadPath -C $ExtractPath
    }
    
    # Cleanup
    Remove-Item $DownloadPath
    
    Write-Host "$Name installed successfully!" -ForegroundColor Green
}

# Install Gitleaks
$GitleaksUrl = "https://github.com/gitleaks/gitleaks/releases/download/v8.18.4/gitleaks_8.18.4_windows_x64.zip"
Install-Tool -Name "gitleaks" -Url $GitleaksUrl -FileName "gitleaks.zip"

# Install Trivy
$TrivyUrl = "https://github.com/aquasecurity/trivy/releases/download/v0.48.0/trivy_0.48.0_Windows-64bit.zip"
Install-Tool -Name "trivy" -Url $TrivyUrl -FileName "trivy.zip"

# Install Semgrep (using pip)
Write-Host "`nInstalling Semgrep..." -ForegroundColor Cyan
try {
    python -m pip install --user semgrep
    Write-Host "Semgrep installed successfully!" -ForegroundColor Green
} catch {
    Write-Host "Failed to install Semgrep. Please install Python and pip first." -ForegroundColor Red
    Write-Host "Download Python from: https://www.python.org/downloads/" -ForegroundColor Yellow
}

Write-Host "`n=== Installation Complete ===" -ForegroundColor Green
Write-Host "`nTools installed in: $ToolsDir" -ForegroundColor Cyan
Write-Host "`nTo use these tools, add them to your PATH or update the scanner configurations." -ForegroundColor Yellow
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Add $ToolsDir\gitleaks to your PATH"
Write-Host "2. Add $ToolsDir\trivy to your PATH"
Write-Host "3. Restart your terminal"
Write-Host "4. Set MOCK_SCANNERS=false in backend/.env"
