@echo off
set "ROOT=%~dp0backend"
set "NPMCLI=C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"

powershell -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force" >nul 2>&1

cd /d "%ROOT%"

if not exist node_modules (
    echo Installation des dependances...
    node "%NPMCLI%" install
    if errorlevel 1 (
        echo Tentative avec npm direct...
        npm install
    )
)

if not exist node_modules (
    echo ECHEC: node_modules toujours absent.
    echo Ouvrir PowerShell en administrateur et taper:
    echo   Set-ExecutionPolicy RemoteSigned
    echo   puis relancer ce script.
    pause
    exit /b 1
)

if not exist .env (
    echo PORT=3000 > .env
    echo USE_SQLITE=true >> .env
)

start /min cmd /c "ping -n 6 127.0.0.1 >nul && start http://localhost:3000/home.html"
echo Demarrage sur http://localhost:3000
node src\server.js
pause
