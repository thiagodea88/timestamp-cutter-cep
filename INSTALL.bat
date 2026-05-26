@echo off
setlocal EnableDelayedExpansion
title Timestamp Cutter CEP - Installer

echo ============================================================
echo  Timestamp Cutter CEP - Installer
echo ============================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator.
    echo.
    echo Right-click INSTALL.bat and choose "Run as administrator".
    pause
    exit /b 1
)

echo [1/3] Enabling PlayerDebugMode...

for %%V in (8 9 10 11 12 13 14) do (
    reg add "HKCU\Software\Adobe\CSXS.%%V" /v "PlayerDebugMode" /t REG_SZ /d "1" /f >nul 2>&1
    if !errorLevel! equ 0 (
        echo    CSXS.%%V OK
    ) else (
        echo    CSXS.%%V failed
    )
)

echo.
echo [2/3] Installing extension...

set "INSTALL_DIR=C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\TimestampCutterCEP"
set "SCRIPT_DIR=%~dp0"

echo    Target: %INSTALL_DIR%

if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%"
)

xcopy "%SCRIPT_DIR%." "%INSTALL_DIR%\" /E /I /H /Y /Q
if %errorLevel% neq 0 (
    echo ERROR: Could not copy files. Check permissions.
    pause
    exit /b 1
)

echo.
echo [3/3] Installation complete.
echo.
echo Open Adobe Premiere Pro and go to:
echo Window ^> Extensions ^> Timestamp Cutter
echo.
pause
