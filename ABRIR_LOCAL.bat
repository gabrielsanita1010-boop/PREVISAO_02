@echo off
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080
  python -m http.server 8080
) else (
  echo Python nao encontrado - abrindo o index.html direto no navegador.
  start "" index.html
)
