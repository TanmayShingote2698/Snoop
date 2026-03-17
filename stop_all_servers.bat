@echo off
echo ========================================
echo   Stopping All Servers...
echo ========================================

:: Kill Python processes (Flask servers)
taskkill /F /IM python.exe /T 2>nul
echo Stopped Python servers:
echo   - Test Server (Port 100)
echo   - Result Server (Port 200)
echo   - Auth Server (Port 300)
echo   - AI Monitor Server (Port 5001)

:: Kill Node processes (Backend server)
taskkill /F /IM node.exe /T 2>nul
echo Stopped Node.js server (Port 5000)

echo.
echo All servers stopped!
pause
