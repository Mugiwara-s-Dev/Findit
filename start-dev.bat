@echo off
setlocal

cd /d "%~dp0"

echo Starting PostgreSQL container...
docker compose up -d

echo.
echo Open a new terminal and run:
echo   start-backend.bat
echo.
echo Open another terminal and run:
echo   start-frontend.bat

endlocal
