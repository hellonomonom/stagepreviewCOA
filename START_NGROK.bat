@echo off
echo Starting ngrok...
echo.
echo Make sure your dev server is running first!
echo (npm run dev in another terminal)
echo.
pause
echo.
cd C:\ngrok
ngrok.exe http 3000
pause

