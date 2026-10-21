@echo off
title SDAS Android Standalone APK Builder (EAS Build)
echo ================================================================
echo SDAS Android Standalone APK Build Utility
echo ================================================================
echo.
echo Choose which app APK you want to build:
echo [1] Build Public Portal APK (com.sdas.publicportal)
echo [2] Build Operator Console APK (com.sdas.operatorconsole)
echo.
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" (
    echo.
    echo Building Public Portal Standalone APK...
    cd /d "%~dp0mobile_apps\public_app"
    call npx eas-cli build -p android --profile preview
) else if "%choice%"=="2" (
    echo.
    echo Building Operator Console Standalone APK...
    cd /d "%~dp0mobile_apps\operator_app"
    call npx eas-cli build -p android --profile preview
) else (
    echo Invalid choice. Exiting.
)

pause
