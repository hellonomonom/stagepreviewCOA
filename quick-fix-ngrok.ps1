# Quick Fix for ngrok
Write-Host "========================================"
Write-Host "ngrok Quick Fix"
Write-Host "========================================"
Write-Host ""

# Step 1: Stop any running ngrok processes
Write-Host "[1] Stopping any running ngrok processes..."
Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
Write-Host "Done" -ForegroundColor Green
Write-Host ""

# Step 2: Check if authtoken needs to be updated
Write-Host "[2] Checking authtoken..."
Write-Host "If ngrok is not working, you may need to update your authtoken."
Write-Host ""
Write-Host "Get your authtoken from:"
Write-Host "https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Cyan
Write-Host ""

$update = Read-Host "Do you want to update your authtoken now? (y/n)"
if ($update -eq "y" -or $update -eq "Y") {
    $token = Read-Host "Enter your ngrok authtoken"
    if ($token) {
        cd C:\ngrok
        .\ngrok.exe config add-authtoken $token
        Write-Host "Authtoken updated!" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "[3] Starting ngrok..."
Write-Host "Opening ngrok in a new window..."
Write-Host ""

# Check if dev server is running
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $port3000) {
    Write-Host "WARNING: Port 3000 is not in use!" -ForegroundColor Yellow
    Write-Host "Make sure your dev server is running (npm run dev:all)" -ForegroundColor Yellow
    Write-Host ""
}

# Start ngrok in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\ngrok; Write-Host 'Starting ngrok for port 3000...'; Write-Host ''; .\ngrok.exe http 3000"

Write-Host "========================================"
Write-Host "ngrok should now be starting!"
Write-Host "========================================"
Write-Host ""
Write-Host "Check the ngrok window for:"
Write-Host "- Any error messages"
Write-Host "- Your HTTPS URL (looks like: https://xxxx-xxxx.ngrok.io)"
Write-Host ""
Write-Host "Common issues:"
Write-Host "- If you see 'authtoken' error: Run this script again and update authtoken"
Write-Host "- If you see 'connection' error: Check your internet"
Write-Host "- If you see 'rate limit': Wait a few minutes"
Write-Host ""








