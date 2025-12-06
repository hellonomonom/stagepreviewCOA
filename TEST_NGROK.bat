@echo off
echo ========================================
echo Testing ngrok Setup
echo ========================================
echo.

echo [1/4] Checking if dev server is running on port 3000...
netstat -ano | findstr :3000 >nul
if %errorlevel% == 0 (
    echo    ✓ Port 3000 is in use (dev server likely running)
) else (
    echo    ✗ Port 3000 is not in use
    echo    → Start dev server: npm run dev
)
echo.

echo [2/4] Looking for ngrok.exe...
if exist "C:\ngrok\ngrok.exe" (
    echo    ✓ Found ngrok at: C:\ngrok\ngrok.exe
    set NGROK_PATH=C:\ngrok\ngrok.exe
) else if exist "%USERPROFILE%\Downloads\ngrok.exe" (
    echo    ✓ Found ngrok in Downloads
    set NGROK_PATH=%USERPROFILE%\Downloads\ngrok.exe
) else if exist "%USERPROFILE%\Downloads\ngrok-v3-windows-amd64\ngrok.exe" (
    echo    ✓ Found ngrok in Downloads folder
    set NGROK_PATH=%USERPROFILE%\Downloads\ngrok-v3-windows-amd64\ngrok.exe
) else (
    echo    ✗ ngrok.exe not found
    echo    → Download from: https://ngrok.com/download
    echo    → Extract to C:\ngrok\ folder
    pause
    exit /b 1
)
echo.

echo [3/4] Checking ngrok version...
"%NGROK_PATH%" version
if %errorlevel% == 0 (
    echo    ✓ ngrok is working
) else (
    echo    ✗ ngrok error - check if file is valid
    pause
    exit /b 1
)
echo.

echo [4/4] Ready to start ngrok!
echo.
echo To start ngrok, run:
echo    "%NGROK_PATH%" http 3000
echo.
echo Or use this command:
echo    cd /d C:\ngrok
echo    ngrok.exe http 3000
echo.
echo Press any key to exit...
pause >nul



