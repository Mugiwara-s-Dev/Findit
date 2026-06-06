@echo off
setlocal

cd /d "%~dp0frontend"

set "NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1"

echo Starting FindIt frontend on localhost:3000...
npm.cmd run dev

endlocal
