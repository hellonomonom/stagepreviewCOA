# ngrok Installation Helper Script
Write-Host "========================================"
Write-Host "ngrok Installation Helper"
Write-Host "========================================"
Write-Host ""

# Check if ngrok already exists
if (Test-Path "C:\ngrok\ngrok.exe") {
    Write-Host "✓ ngrok is already installed at C:\ngrok\ngrok.exe"
    Write-Host ""
    Write-Host "To start ngrok, run:"
    Write-Host "  cd C:\ngrok"
    Write-Host "  .\ngrok.exe http 3000"
    Write-Host ""
    exit
}

Write-Host "ngrok is not installed yet."
Write-Host ""
Write-Host "To install ngrok:"
Write-Host "1. Download from: https://ngrok.com/download"
Write-Host "2. Extract to: C:\ngrok\"
Write-Host "3. Sign up at: https://dashboard.ngrok.com/signup"
Write-Host "4. Configure authtoken: .\ngrok.exe config add-authtoken YOUR_TOKEN"
Write-Host ""
Write-Host "Opening download page..."
Start-Process "https://ngrok.com/download"

Write-Host ""
Write-Host "After downloading and extracting, run this script again to verify installation."
Write-Host ""
pause

