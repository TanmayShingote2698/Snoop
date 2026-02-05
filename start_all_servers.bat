@echo off
echo ========================================
echo   Snoop System
echo   Starting All Servers...
echo ========================================
echo.

:: Set the project root directory
set PROJECT_ROOT=%~dp0

:: Start Test Server (Port 100)
echo [1/4] Starting Test Server on Port 100...
start "Test Server - Port 100" cmd /k "cd /d %PROJECT_ROOT%src\TestServer && python server.py"
timeout /t 2 /nobreak >nul

:: Start Result Server (Port 200)
echo [2/4] Starting Result Server on Port 200...
start "Result Server - Port 200" cmd /k "cd /d %PROJECT_ROOT%src\ResultServer && python server.py"
timeout /t 2 /nobreak >nul

:: Start Auth Server (Port 300)
echo [3/4] Starting Auth Server on Port 300...
start "Auth Server - Port 300" cmd /k "cd /d %PROJECT_ROOT%src\AuthServer && python server.py"
timeout /t 2 /nobreak >nul

:: Start Backend Server (Port 5000)
echo [4/4] Starting Main Backend Server on Port 5000...
start "Backend Server - Port 5000" cmd /k "cd /d %PROJECT_ROOT%src\BackendServer && npm run dev"

echo.
echo ========================================
echo   All Servers Started Successfully!
echo ========================================
echo.
echo   Test Server:     http://localhost:100
echo   Result Server:   http://localhost:200
echo   Auth Server:     http://localhost:300
echo   Web Application: http://localhost:5000
echo.
echo   Press any key to open the application...
pause >nul
start http://localhost:5000
