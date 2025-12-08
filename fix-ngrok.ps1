# ngrok Fix Script
Write-Host "========================================"
Write-Host "ngrok Fix Tool"
Write-Host "========================================"
Write-Host ""

# Step 1: Check current status
Write-Host "[Step 1] Checking current ngrok status..." -ForegroundColor Cyan
& .\diagnose-ngrok.ps1

Write-Host ""
Write-Host "========================================"
Write-Host "Fixing ngrok..."
Write-Host "========================================"
Write-Host ""

# Step 2: Kill any existing ngrok processes
Write-Host "[Step 2] Stopping any running ngrok processes..." -ForegroundColor Cyan
$ngrokProcesses = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
if ($ngrokProcesses) {
    $ngrokProcesses | Stop-Process -Force
    Write-Host "    ✓ Stopped $($ngrokProcesses.Count) ngrok process(es)" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "    ✓ No ngrok processes running" -ForegroundColor Green
}

# Step 3: Verify authtoken
Write-Host "[Step 3] Verifying authtoken..." -ForegroundColor Cyan
$configPath = "$env:LOCALAPPDATA\ngrok\ngrok.yml"
if (Test-Path $configPath) {
    $config = Get-Content $configPath
    if ($config -match "authtoken:\s*(\S+)") {
        $token = $matches[1]
        Write-Host "    ✓ Authtoken found in config" -ForegroundColor Green
        Write-Host "    -> Token: $($token.Substring(0, [Math]::Min(20, $token.Length)))..." -ForegroundColor Gray
    } else {
        Write-Host "    ✗ No authtoken found in config" -ForegroundColor Red
        Write-Host "    -> You need to set up authtoken" -ForegroundColor Yellow
        Write-Host ""
        $setup = Read-Host "    Run setup-ngrok-authtoken.ps1 now? (y/n)"
        if ($setup -eq "y" -or $setup -eq "Y") {
            & .\setup-ngrok-authtoken.ps1
        } else {
            Write-Host "    -> Please run: .\setup-ngrok-authtoken.ps1" -ForegroundColor Yellow
            exit 1
        }
    }
} else {
    Write-Host "    ✗ Config file not found" -ForegroundColor Red
    Write-Host "    -> Setting up authtoken..." -ForegroundColor Yellow
    & .\setup-ngrok-authtoken.ps1
}

# Step 4: Verify dev server is running
Write-Host "[Step 4] Checking dev server..." -ForegroundColor Cyan
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $port3000) {
    Write-Host "    ✗ Port 3000 is not in use" -ForegroundColor Red
    Write-Host "    -> Starting dev server..." -ForegroundColor Yellow
    Write-Host "    -> Run in another terminal: npm run dev:all" -ForegroundColor Yellow
    Write-Host ""
    $startServer = Read-Host "    Start dev server now? (y/n)"
    if ($startServer -eq "y" -or $startServer -eq "Y") {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev:all"
        Write-Host "    -> Waiting 5 seconds for server to start..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    } else {
        Write-Host "    -> Please start dev server first: npm run dev:all" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "    ✓ Dev server is running on port 3000" -ForegroundColor Green
}

# Step 5: Test ngrok
Write-Host "[Step 5] Testing ngrok..." -ForegroundColor Cyan
Write-Host "    Starting ngrok (will show URL in 3 seconds)..." -ForegroundColor Yellow
Write-Host ""

# Start ngrok
$ngrokPath = "C:\ngrok\ngrok.exe"
if (-not (Test-Path $ngrokPath)) {
    Write-Host "    ✗ ngrok.exe not found at C:\ngrok\" -ForegroundColor Red
    Write-Host "    → Download from: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

# Start ngrok in a new window so user can see it
    Write-Host "    -> Opening ngrok in new window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\ngrok; .\ngrok.exe http 3000"

Write-Host ""
Write-Host "========================================"
Write-Host "✓ ngrok should now be starting!"
Write-Host "========================================"
Write-Host ""
Write-Host "Check the ngrok window for your HTTPS URL"
Write-Host "It will look like: https://xxxx-xxxx.ngrok.io"
Write-Host ""
Write-Host "If you see errors, the most common fixes are:"
Write-Host "1. Re-authenticate: .\setup-ngrok-authtoken.ps1"
Write-Host "2. Check your internet connection"
Write-Host "3. Verify your ngrok account is active"
Write-Host ""

