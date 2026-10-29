@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Installez Node.js LTS depuis https://nodejs.org/ puis relancez ce fichier.
  pause
  exit /b 1
)
call npm install
if errorlevel 1 goto failed
echo Installation terminée. Le programme utilisera Google Chrome.
echo Si Chrome est absent, lancez : npx playwright install chromium
pause
exit /b 0
:failed
echo Installation impossible. Consultez le message ci-dessus.
pause
exit /b 1
