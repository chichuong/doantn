@echo off
chcp 65001 >nul
title Karat Retail - Deploy Code & Database len Cloud Azure (https://karats.studio)
echo ====================================================================
echo   KARAT RETAIL - CAP NHAT CODE (FE + BE) LEN CLOUD (karats.studio)
echo ====================================================================
echo.

set /p COMMIT_MSG="Nhap ghi chu thay doi (Enter de dung mac dinh): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=chore: update code from local machine

echo.
echo [1/3] Dang kiem tra & build thu Frontend Web...
cd /d "%~dp0Frontend_Web"
call npm run build
if %errorlevel% neq 0 (
    echo [Loi] Build Frontend that bai! Vui long kiem tra lai code.
    pause
    exit /b 1
)

echo.
echo [2/3] Dang day code moi len GitHub (chichuong/doantn)...
cd /d "%~dp0"
git add .
git commit -m "%COMMIT_MSG%"
git push origin main

echo.
echo [3/3] Dang cap nhat & khoi dong lai Docker tren May chu Azure (172.128.32.14)...
python -c "import paramiko, sys; ssh = paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy()); ssh.connect('172.128.32.14', username='karatadmin', password='KaratRetail@2026!', timeout=20); stdin, stdout, stderr = ssh.exec_command('sudo bash -c \"cd /opt/karat-retail && git fetch origin main && git reset --hard origin/main && docker compose up -d --build mssql app && docker ps\"', get_pty=True); [sys.stdout.write(line) for line in iter(stdout.readline, '')]; ssh.close()"

echo.
echo ====================================================================
echo   HOAN TAT! Website https://karats.studio da duoc cap nhat!
echo ====================================================================
pause
