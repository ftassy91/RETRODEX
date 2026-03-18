@echo off
cd /d "%~dp0frontend"
echo Starting RetroDex frontend on port 8080...
python -m http.server 8080
