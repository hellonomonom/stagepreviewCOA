# ngrok Diagnostic Script
Write-Host "========================================"
Write-Host "ngrok Diagnostic Tool"
Write-Host "========================================"
Write-Host ""

# Check 1: ngrok executable
Write-Host "[1/5] Checking ngrok executable..."
if (Test-Path "C:\ngrok\ngrok.exe") {
    Write-Host "    ✓ Found: C:\ngrok\ngrok.exe" -ForegroundColor Green
    $ngrokPath = "C:\ngrok\ngrok.exe"
} else {
    Write-Host "    ✗ ngrok.exe not found at C:\ngrok\" -ForegroundColor Red
    Write-Host "    -> Download from: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

# Check 2: ngrok version
Write-Host "[2/5] Checking ngrok version..."
try {
    $version = & $ngrokPath version 2>&1
    Write-Host "    ✓ $version" -ForegroundColor Green
} catch {
    Write-Host "    ✗ Error running ngrok: $_" -ForegroundColor Red
    exit 1
}

# Check 3: Configuration file
Write-Host "[3/5] Checking configuration..."
$configPath = "$env:LOCALAPPDATA\ngrok\ngrok.yml"
if (Test-Path $configPath) {
    Write-Host "    ✓ Config file exists: $configPath" -ForegroundColor Green
    try {
        $configCheck = & $ngrokPath config check 2>&1
        Write-Host "    $configCheck" -ForegroundColor Green
    } catch {
        Write-Host "    ✗ Config check failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "    ✗ Config file not found" -ForegroundColor Red
    Write-Host "    -> Run: .\setup-ngrok-authtoken.ps1" -ForegroundColor Yellow
}

# Check 4: Port 3000
Write-Host "[4/5] Checking if port 3000 is in use..."
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    Write-Host "    ✓ Port 3000 is active (dev server running)" -ForegroundColor Green
} else {
    Write-Host "    ✗ Port 3000 is not in use" -ForegroundColor Red
    Write-Host "    -> Start dev server: npm run dev:all" -ForegroundColor Yellow
}

# Check 5: Test ngrok connection
Write-Host "[5/5] Testing ngrok connection..."
Write-Host "    Attempting to start ngrok (will stop after 5 seconds)..." -ForegroundColor Yellow
Write-Host ""

try {
    # Start ngrok in background
    $job = Start-Job -ScriptBlock {
        Set-Location C:\ngrok
        & .\ngrok.exe http 3000 2>&1
    }
    
    Start-Sleep -Seconds 5
    
    # Get output
    $output = Receive-Job -Job $job
    Stop-Job -Job $job
    Remove-Job -Job $job
    
    if ($output -match "ERR_NGROK_\d+|error|Error|failed|Failed") {
        Write-Host "    ✗ ngrok error detected:" -ForegroundColor Red
        $output | Where-Object { $_ -match "ERR|error|Error|failed|Failed" } | ForEach-Object {
            Write-Host "       $_" -ForegroundColor Red
        }
        
        # Check for common errors
        if ($output -match "ERR_NGROK_108|authtoken|auth") {
            Write-Host ""
            Write-Host "    -> Authtoken issue detected!" -ForegroundColor Yellow
            Write-Host "    -> Solution: Re-authenticate with:" -ForegroundColor Yellow
            Write-Host "       .\setup-ngrok-authtoken.ps1" -ForegroundColor Cyan
        }
        
        if ($output -match "ERR_NGROK_3200|session|tunnel") {
            Write-Host ""
            Write-Host "    -> Connection issue detected!" -ForegroundColor Yellow
            Write-Host "    -> Solution: Check internet connection and try again" -ForegroundColor Yellow
        }
        
        if ($output -match "ERR_NGROK_105|rate limit|limit") {
            Write-Host ""
            Write-Host "    -> Rate limit detected!" -ForegroundColor Yellow
            Write-Host "    -> Solution: Wait a few minutes or upgrade ngrok plan" -ForegroundColor Yellow
        }
    } elseif ($output -match "Forwarding|Session Status.*online") {
        Write-Host "    ✓ ngrok started successfully!" -ForegroundColor Green
        $url = ($output | Select-String -Pattern "https://.*\.ngrok\.(io|app|dev)").Matches.Value
        if ($url) {
            Write-Host "    -> Your URL: $url" -ForegroundColor Cyan
        }
    } else {
        Write-Host "    ? Could not determine status from output" -ForegroundColor Yellow
        Write-Host "    Output: $($output -join "`n")"
    }
} catch {
    Write-Host "    ✗ Error testing ngrok: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================"
Write-Host "Diagnostic Complete"
Write-Host "========================================"
Write-Host ""
Write-Host "If ngrok is not working, try:"
Write-Host "1. Re-authenticate: .\setup-ngrok-authtoken.ps1"
Write-Host "2. Check internet connection"
Write-Host '3. Restart ngrok: cd C:\ngrok; .\ngrok.exe http 3000'
Write-Host ""

