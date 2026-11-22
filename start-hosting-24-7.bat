@echo off
chcp 65001 >nul
title Karat Retail - Production Manager (PM2 24/7)
echo ========================================================
echo   KARAT RETAIL - QUAN LY PRODUCTION SERVER 24/7 (PM2)
echo ========================================================
echo.
echo [1/3] Dang dong goi Frontend Web (Production Build)...
cd /d "%~dp0Frontend_Web"
call npm run build

echo.
echo [2/3] Dang khoi dong / cap nhat dich vu PM2 Daemon...
cd /d "%~dp0"
call pm2 startOrReload ecosystem.config.cjs --only "karat-retail-server,karat-cloudflare-tunnel"
call pm2 save

echo.
echo [3/3] Trang thai he thong & Duong link Public HTTPS:
call pm2 status
echo.
call pm2 logs karat-cloudflare-tunnel --lines 25 --nostream | findstr "trycloudflare.com"
echo.
echo --------------------------------------------------------
echo - Local URL:  http://localhost:3000
echo - Go lenh "pm2 monit" de mo Dashboard theo doi CPU/RAM/Logs
echo - Go lenh "pm2 logs" de xem log truc tiep
echo --------------------------------------------------------
pause
