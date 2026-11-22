@echo off
chcp 65001 >nul
title Karat Retail - Production Hosting 24/7 (https://karats.studio)
echo ====================================================================
echo   KARAT RETAIL - PRODUCTION HOSTING 24/7 (https://karats.studio)
echo ====================================================================
echo.
echo [1/3] Dang dong goi Frontend Web (Production Build)...
cd /d "%~dp0Frontend_Web"
call npm run build

echo.
echo [2/3] Dang khoi dong Full-stack Server (Port 3000)...
cd /d "%~dp0Backend"
start "Karat Retail Backend + Web Server (Port 3000)" cmd /k "node src/server.js"
timeout /t 2 /nobreak >nul

echo.
echo [3/3] Dang ket noi Ten mien Chinh thuc https://karats.studio ...
echo --------------------------------------------------------------------
echo - Website chinh thuc: https://karats.studio
echo - Website www:        https://www.karats.studio
echo - Localhost:          http://localhost:3000
echo --------------------------------------------------------------------
cloudflared.exe tunnel run karat-retail
pause
