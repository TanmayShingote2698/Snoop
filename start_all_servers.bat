@echo off
echo ========================================
echo   Snoop System
echo   Starting All Servers...
echo ========================================
echo.

:: Set the project root directory
set PROJECT_ROOT=%~dp0

:: Start Test Server (Port 100)
echo [1/5] Starting Test Server on Port 100...
start "Test Server - Port 100" cmd /k "cd /d %PROJECT_ROOT%src\TestServer && python server.py"
timeout /t 2 /nobreak >nul

:: Start Result Server (Port 200)
echo [2/5] Starting Result Server on Port 200...
start "Result Server - Port 200" cmd /k "cd /d %PROJECT_ROOT%src\ResultServer && python server.py"
timeout /t 2 /nobreak >nul

:: Start Auth Server (Port 300)
echo [3/5] Starting Auth Server on Port 300...
start "Auth Server - Port 300" cmd /k "cd /d %PROJECT_ROOT%src\AuthServer && python server.py"
timeout /t 2 /nobreak >nul

:: Start AI Monitor Server (Port 5001)
echo [4/5] Starting AI Monitor Server on Port 5001...
start "AI Monitor Server - Port 5001" cmd /k "cd /d %PROJECT_ROOT%src\AIMonitor && python server.py"
timeout /t 2 /nobreak >nul

:: Start Backend Server (Port 5000)
echo [5/5] Starting Main Backend Server on Port 5000...
start "Backend Server - Port 5000" cmd /k "cd /d %PROJECT_ROOT%src\BackendServer && npm run dev"

echo.
echo ========================================
echo   All Servers Started Successfully!
echo ========================================
echo.
echo   Test Server:        http://localhost:100
echo   Result Server:      http://localhost:200
echo   Auth Server:        http://localhost:300
echo   AI Monitor Server:  http://localhost:5001
echo   Web Application:    http://localhost:5000
echo.
echo   Press any key to open the application...
pause >nul
start http://localhost:5000
