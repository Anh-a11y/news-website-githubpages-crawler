@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay Node.js.
  echo Hay cai Node.js ban 18 tro len, sau do mo lai file nay.
  echo Tai tu: https://nodejs.org/
  pause
  exit /b 1
)
start "Tin Tuc 24H Server" /D "%~dp0" cmd /k "node server.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
echo Da mo website. Giu cua so Server mo khi su dung crawler.
pause
