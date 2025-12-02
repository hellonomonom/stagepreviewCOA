# Quick Deploy Script - Connect, Pull Git, Restart App
# Simple script to quickly update and restart the app on DigitalOcean

param(
    [string]$ConfigFile = "deploy.config.json"
)

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }

# Check if config file exists
if (-Not (Test-Path $ConfigFile)) {
    Write-Error "❌ Error: Configuration file '$ConfigFile' not found!"
    Write-Host "Please create '$ConfigFile' from 'deploy.config.example.json'"
    exit 1
}

# Load configuration
try {
    $config = Get-Content $ConfigFile | ConvertFrom-Json
} catch {
    Write-Error "❌ Error: Failed to parse configuration file!"
    Write-Host $_.Exception.Message
    exit 1
}

# Validate required configuration
if (-Not $config.sshKey -or -Not $config.serverUser -or -Not $config.serverHost -or -Not $config.serverPath) {
    Write-Error "❌ Error: Missing required configuration fields!"
    exit 1
}

# Expand user path for SSH key
$sshKey = $config.sshKey
if ($sshKey -like "~/*") {
    $sshKey = $sshKey -replace "~", $env:USERPROFILE
}
$sshKey = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($sshKey)

# Check if SSH key exists
if (-Not (Test-Path $sshKey)) {
    Write-Error "❌ Error: SSH key not found at: $sshKey"
    exit 1
}

Write-Info "🚀 Quick Deploy - Connecting to server..."
Write-Host ""
Write-Host "Server: $($config.serverUser)@$($config.serverHost)"
Write-Host "Path: $($config.serverPath)"
Write-Host ""

# Build remote commands
$serverAddress = "$($config.serverUser)@$($config.serverHost)"
$remoteCommands = @(
    "cd $($config.serverPath)",
    "echo '📥 Pulling latest changes from git...'",
    "git pull origin main 2>&1 || git pull origin master 2>&1",
    "echo ''",
    "echo '🔄 Restarting application with PM2...'",
    "pm2 restart stagepreview-coa 2>&1 || pm2 restart ecosystem.config.cjs 2>&1",
    "echo ''",
    "echo '✅ Deployment complete!'",
    "pm2 status"
) -join " && "

# Build SSH command
$sshCommand = "ssh -i `"$sshKey`" -o StrictHostKeyChecking=no -o ConnectTimeout=10 $serverAddress `"$remoteCommands`""

Write-Warning "Executing commands on server..."
Write-Host ""

# Execute SSH command
try {
    Invoke-Expression $sshCommand
    $exitCode = $LASTEXITCODE
    
    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Success "✅ Quick deploy completed successfully!"
    } else {
        Write-Error "❌ Deployment failed with exit code: $exitCode"
        Write-Host ""
        Write-Host "Troubleshooting tips:"
        Write-Host "1. Check if server is running: ping $($config.serverHost)"
        Write-Host "2. Verify SSH key permissions"
        Write-Host "3. Check server logs: ssh -i `"$sshKey`" $serverAddress 'pm2 logs stagepreview-coa --lines 50'"
        exit $exitCode
    }
} catch {
    Write-Error "❌ Error during deployment:"
    Write-Host $_.Exception.Message
    exit 1
}


