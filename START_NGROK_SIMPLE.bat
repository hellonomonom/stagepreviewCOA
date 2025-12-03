@echo off
echo Starting ngrok for port 3000...
echo.

REM Try different common locations for ngrok
if exist "C:\ngrok\ngrok.exe" (
    cd /d C:\ngrok
    echo Using: C:\ngrok\ngrok.exe
    ngrok.exe http 3000
) else if exist "%USERPROFILE%\Downloads\ngrok.exe" (
    cd /d "%USERPROFILE%\Downloads"
    echo Using: %USERPROFILE%\Downloads\ngrok.exe
    ngrok.exe http 3000
) else if exist "%USERPROFILE%\Downloads\ngrok-v3-windows-amd64\ngrok.exe" (
    cd /d "%USERPROFILE%\Downloads\ngrok-v3-windows-amd64"
    echo Using: ngrok.exe from Downloads
    ngrok.exe http 3000
) else (
    echo.
    echo ERROR: ngrok.exe not found!
    echo.
    echo Please download ngrok from: https://ngrok.com/download
    echo Extract to: C:\ngrok\
    echo.
    echo Then run this script again.
    echo.
    pause
    exit /b 1
)

