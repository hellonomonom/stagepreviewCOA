# Start ngrok for port 3000
Write-Host "Starting ngrok for port 3000..."
Write-Host ""
Write-Host "Make sure your dev server is running first!"
Write-Host "(npm run dev)"
Write-Host ""

Start-Sleep -Seconds 2

cd C:\ngrok
.\ngrok.exe http 3000

