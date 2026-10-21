@echo off
title SDAS Public Flood Advisory App (Expo SDK 57)
cd /d "%~dp0mobile_apps\public_app"
echo ===================================================
echo Starting SDAS Public Portal App...
echo Scan the QR Code using Expo Go on your Android phone!
echo ===================================================
call npx expo start
pause
