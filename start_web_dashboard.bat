@echo off
title SDAS - Smart Dam Live Web Dashboard
color 0b
echo ========================================================
echo   SMART DAM ALERTING SYSTEM (SDAS) - WEB DASHBOARD
echo   Real-Time Hardware Sensor Diagnostics (Zero Mock Data)
echo ========================================================
echo.
echo Starting local web server on port 3000...
cd /d "%~dp0"
start "" http://localhost:3000
node web_dashboard\server.js
pause
