@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "CARL_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "CARL_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%CARL_NODE%" if not "%CARL_NODE%"=="node" goto missing
echo.
echo CARL - Traduction des écrans d'accueil V1.3.0
echo 1. Audit des six langues, sans modifier les données
echo 2. Corriger les six langues et sauvegarder
echo 3. Quitter
echo Les profils standard sont ignorés automatiquement.
choice /c 123 /n /m "Votre choix : "
if errorlevel 3 exit /b 0
if errorlevel 2 goto apply
"%CARL_NODE%" carl.cjs --audit --ask-start-profile
goto end
:apply
"%CARL_NODE%" carl.cjs --apply --ask-start-profile
goto end
:missing
echo Node.js est introuvable. Installez Node.js LTS depuis https://nodejs.org/
:end
pause
