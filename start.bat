@echo off
setlocal
title Macau JAE Exam Platform Launcher
cd /d "%~dp0"

echo ========================================================
echo       Macau JAE Exam Platform Launcher
echo ========================================================
echo.
echo Starting Backend API and Frontend Web App...
echo.

start "JAE Backend" cmd /c "%~dp0run_backend.bat"
start "JAE Frontend" cmd /c "%~dp0run_frontend.bat"

echo [SUCCESS]
echo  - Frontend Web: http://127.0.0.1:5173/
echo  - Quiz Room:    http://127.0.0.1:5173/quiz
echo  - API Docs:     http://127.0.0.1:8000/docs
echo.
echo Opening browser in 5 seconds...
timeout /t 5 >nul
start http://127.0.0.1:5173/
exit