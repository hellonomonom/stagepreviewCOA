# Simple ngrok Test Script
Write-Host "Testing ngrok..."
Write-Host ""

# Check if ngrok exists
if (-not (Test-Path "C:\ngrok\ngrok.exe")) {
    Write-Host "ERROR: ngrok.exe not found at C:\ngrok\" -ForegroundColor Red
    Write-Host "Download from: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

# Check config
Write-Host "Checking ngrok configuration..."
cd C:\ngrok
.\ngrok.exe config check

Write-Host ""
Write-Host "Attempting to start ngrok..."
Write-Host "This will run for 5 seconds to check for errors..."
Write-Host ""

# Try to start ngrok and capture output
$job = Start-Job -ScriptBlock {
    cd C:\ngrok
    & .\ngrok.exe http 3000 2>&1 | Out-String
}

Start-Sleep -Seconds 5

$output = Receive-Job -Job $job
Stop-Job -Job $job
Remove-Job -Job $job

Write-Host "ngrok output:"
Write-Host $output
Write-Host ""

# Check for common errors
if ($output -match "ERR_NGROK_108|authtoken|Your authtoken") {
    Write-Host "ERROR: Authtoken issue!" -ForegroundColor Red
    Write-Host "Solution: Run .\setup-ngrok-authtoken.ps1" -ForegroundColor Yellow
} elseif ($output -match "ERR_NGROK_3200|session") {
    Write-Host "ERROR: Connection issue!" -ForegroundColor Red
    Write-Host "Solution: Check internet connection" -ForegroundColor Yellow
} elseif ($output -match "ERR_NGROK_105|rate limit") {
    Write-Host "ERROR: Rate limit!" -ForegroundColor Red
    Write-Host "Solution: Wait a few minutes" -ForegroundColor Yellow
} elseif ($output -match "Forwarding.*https://") {
    Write-Host "SUCCESS: ngrok is working!" -ForegroundColor Green
    $url = ($output | Select-String -Pattern "https://[^\s]+").Matches[0].Value
    Write-Host "Your URL: $url" -ForegroundColor Cyan
} else {
    Write-Host "Could not determine status. Full output above." -ForegroundColor Yellow
}

