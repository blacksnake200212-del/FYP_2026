@echo off
title SDAS Operator Console App (Expo SDK 57)
cd /d "%~dp0mobile_apps\operator_app"
echo ===================================================
echo Starting SDAS Operator Console App...
echo Scan the QR Code using Expo Go on your Android phone!
echo ===================================================
call npx expo start
pause
