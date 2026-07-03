@echo off
echo Building Image Grabber...
call pnpm run build
if %errorlevel% neq 0 (
  echo Build failed!
  pause
  exit /b 1
)
echo.
echo Starting server on http://localhost:3000
echo Press Ctrl+C to stop.
echo.
node start.mjs %*