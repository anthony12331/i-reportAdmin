@echo off
title KioskWatchdog
set "EXIT_FLAG=%TEMP%\.exit_kiosk"
set "APP_DIR=%~dp0client"

echo Kiosk Watchdog Started...
cd /d "%APP_DIR%"

:LOOP
:: If exit flag exists, clean it up and exit watchdog
if exist "%EXIT_FLAG%" (
    echo Exit flag detected. Stopping Watchdog.
    del "%EXIT_FLAG%"
    exit /b 0
)

echo [Kiosk] Launching application...
call npm run electron:start

:: When Electron closes (whether by crash, Task Manager, or normal exit), 
:: the script resumes here and instantly loops back to restart it.
goto LOOP
