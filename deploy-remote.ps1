# PowerShell script to deploy to DigitalOcean server
# This script connects via SSH, pulls latest changes, and runs deployment

param(
    [string]$ConfigFile = "deploy.config.json"
)

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Check if config file exists
if (-Not (Test-Path $ConfigFile)) {
    Write-ColorOutput Red "❌ Error: Configuration file '$ConfigFile' not found!"
    Write-Output "Please create '$ConfigFile' from 'deploy.config.example.json'"
    Write-Output "See Guides/DEPLOYMENT.md for details."
    exit 1
}

# Load configuration
try {
    $config = Get-Content $ConfigFile | ConvertFrom-Json
} catch {
    Write-ColorOutput Red "❌ Error: Failed to parse configuration file!"
    Write-Output $_.Exception.Message
    exit 1
}

# Validate required configuration
$requiredFields = @("sshKey", "serverUser", "serverHost", "serverPath")
foreach ($field in $requiredFields) {
    if (-Not $config.$field) {
        Write-ColorOutput Red "❌ Error: Missing required configuration field: $field"
        exit 1
    }
}

# Expand user path for SSH key
$sshKey = $config.sshKey
if ($sshKey -like "~/*") {
    $sshKey = $sshKey -replace "~", $env:USERPROFILE
}
$sshKey = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($sshKey)

# Check if SSH key exists
if (-Not (Test-Path $sshKey)) {
    Write-ColorOutput Red "❌ Error: SSH key not found at: $sshKey"
    exit 1
}

Write-ColorOutput Cyan "🚀 Starting deployment to DigitalOcean server..."
Write-Output ""
Write-Output "Server: $($config.serverUser)@$($config.serverHost)"
Write-Output "Path: $($config.serverPath)"
Write-Output ""

# Build SSH command
$serverAddress = "$($config.serverUser)@$($config.serverHost)"
$remoteCommands = @(
    "cd $($config.serverPath)",
    "echo '📥 Pulling latest changes from git...'",
    "(git pull origin main || git pull origin master || echo '⚠️  Git pull skipped')",
    "echo ''",
    "echo '🔄 Running deployment script...'",
    "bash deploy.sh"
) -join " && "

$sshCommand = "ssh -i `"$sshKey`" -o StrictHostKeyChecking=no $serverAddress `"$remoteCommands`""

Write-ColorOutput Yellow "Connecting to server and running deployment..."
Write-Output ""

# Execute SSH command
try {
    Invoke-Expression $sshCommand
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Output ""
        Write-ColorOutput Green "✅ Deployment completed successfully!"
    } else {
        Write-Output ""
        Write-ColorOutput Red "❌ Deployment failed with exit code: $exitCode"
        exit $exitCode
    }
} catch {
    Write-ColorOutput Red "❌ Error during deployment:"
    Write-Output $_.Exception.Message
    exit 1
}


