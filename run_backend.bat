@echo off
cd /d "%~dp0backend"
echo Starting RetroDex backend on port 3000...
node src\server.js
