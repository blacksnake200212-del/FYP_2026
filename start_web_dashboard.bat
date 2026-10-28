@echo off
title SDAS - Smart Dam Live Web Dashboard
color 0b
echo ========================================================
echo   SMART DAM ALERTING SYSTEM (SDAS) - WEB DASHBOARD
echo   Real-Time Hardware Sensor Diagnostics (Zero Mock Data)
echo ========================================================
echo.
echo Initializing SDAS Telemetry Web Server...
cd /d "%~dp0"
node web_dashboard\server.js
pause
