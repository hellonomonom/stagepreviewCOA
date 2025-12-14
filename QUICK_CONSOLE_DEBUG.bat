@echo off
REM Quick script to enable Chrome remote debugging for Quest 3
REM Make sure Quest 3 is connected via USB and Developer Mode is enabled

echo Checking for ADB...
where adb >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: ADB not found in PATH
    echo.
    echo Please either:
    echo 1. Install Android Platform Tools and add to PATH
    echo    Download: https://developer.android.com/tools/releases/platform-tools
    echo.
    echo 2. Or place this script in the platform-tools folder
    echo.
    pause
    exit /b 1
)

echo.
echo Connecting to Quest 3...
adb devices

echo.
echo Forwarding Chrome DevTools port...
adb forward tcp:9222 localabstract:chrome_devtools_remote

if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS! Port forwarding active.
    echo.
    echo Now:
    echo 1. Open Chrome on your PC
    echo 2. Go to: chrome://inspect/#devices
    echo 3. Find your Quest browser tab and click "inspect"
    echo.
) else (
    echo.
    echo ERROR: Port forwarding failed
    echo.
    echo Make sure:
    echo - Quest 3 is connected via USB
    echo - Developer Mode is enabled in Quest settings
    echo - Quest browser is open (can be in background)
    echo.
)

pause











