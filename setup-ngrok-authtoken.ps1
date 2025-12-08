# ngrok Authtoken Setup Helper
Write-Host "========================================"
Write-Host "ngrok Authtoken Configuration"
Write-Host "========================================"
Write-Host ""

$authtoken = Read-Host "Enter your ngrok authtoken (get it from https://dashboard.ngrok.com/get-started/your-authtoken)"

if ($authtoken) {
    Write-Host ""
    Write-Host "Configuring ngrok..."
    cd C:\ngrok
    .\ngrok.exe config add-authtoken $authtoken
    
    Write-Host ""
    Write-Host "========================================"
    Write-Host "Configuration complete!"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Now you can start ngrok with:"
    Write-Host "  cd C:\ngrok"
    Write-Host "  .\ngrok.exe http 3000"
    Write-Host ""
} else {
    Write-Host "No authtoken entered. Exiting."
}

Write-Host ""
pause




