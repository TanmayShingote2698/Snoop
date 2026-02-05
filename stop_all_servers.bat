@echo off
echo ========================================
echo   Stopping All Servers...
echo ========================================

:: Kill Python processes (Flask servers)
taskkill /F /IM python.exe /T 2>nul
echo Stopped Python servers (Test, Result, Auth)

:: Kill Node processes (Backend server)
taskkill /F /IM node.exe /T 2>nul
echo Stopped Node.js server (Backend)

echo.
echo All servers stopped!
pause
