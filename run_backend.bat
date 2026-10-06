@echo off
setlocal enabledelayedexpansion
title JAE Backend (FastAPI)
cd /d "%~dp0backend"

echo ========================================================
echo    Starting Macau JAE Backend API (FastAPI)
echo ========================================================

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python not found in PATH!
    echo Please install Python 3.10 - 3.13 and add to PATH.
    pause
    exit /b 1
)

if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else if exist "..\..\jae-backend\venv_local\Scripts\activate.bat" (
    call ..\..\jae-backend\venv_local\Scripts\activate.bat
) else (
    echo [Setup] Creating Python virtual environment (venv)...
    python -m venv venv
    if !errorlevel! equ 0 (
        call venv\Scripts\activate.bat
    )
)

python -c "import fastapi, uvicorn, openai, pymupdf, json_repair" >nul 2>nul
if %errorlevel% neq 0 (
    echo [Setup] Installing backend dependencies...
    pip install -r requirements.txt
)

echo.
echo [Running] Backend is running at: http://127.0.0.1:8000
echo [Docs]    Swagger API docs at:   http://127.0.0.1:8000/docs
echo.
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause