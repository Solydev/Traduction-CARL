@echo off
setlocal
chcp 65001 >nul
rem Aucun Node.js, npm ou navigateur Windows n'est installé par ce lanceur.
wsl.exe -d Ubuntu-24.04 --cd "%~dp0." -- bash ./lancer-wsl.sh
pause
