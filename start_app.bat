@echo off
chcp 65001 > nul
title Iniciar Anti-Distraction
cls
echo =======================================================
echo          Iniciando Anti-Distraction Sentinel
echo =======================================================
echo.
echo Abrindo o Anti-Distraction no seu navegador padrão...
start "" "http://localhost:8000" 2>nul
if %errorlevel% neq 0 (
    start "" "index.html"
)

echo.
echo Tentando iniciar servidor local com Python para melhor compatibilidade com microfone/áudio...
python -m http.server 8000 2>nul
if %errorlevel% neq 0 (
    echo Servidor Python não disponível, abrindo diretamente index.html...
    start "" "index.html"
)
pause
