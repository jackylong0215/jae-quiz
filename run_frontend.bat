@echo off
setlocal enabledelayedexpansion
title JAE Frontend (Vite + React)
cd /d "%~dp0frontend"

echo ========================================================
echo    Starting Macau JAE Frontend (Vite + React)
echo ========================================================

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm not found in PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [Setup] Installing frontend dependencies (npm install)...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo [Running] Frontend web app is running at: http://127.0.0.1:5173/
echo.
call npm run dev -- --host 127.0.0.1 --port 5173
pause