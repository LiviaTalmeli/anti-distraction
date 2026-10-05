@echo off
chcp 65001 > nul
title Anti-Distraction - Publicar no GitHub
cls
echo =====================================================================
echo          Anti-Distraction - Assistente de Publicação no GitHub
echo =====================================================================
echo.
echo Verificando se o Git está instalado no seu computador...
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [AVISO] O Git não foi encontrado no seu PATH do sistema.
    echo.
    echo Você tem duas formas super fáceis de colocar este projeto no GitHub:
    echo.
    echo 1. VIA NAVEGADOR (Sem instalar nada):
    echo    a. Acesse https://github.com/new e crie um novo repositório chamado 'anti-distraction'
    echo    b. Na página que abrir, clique em 'uploading an existing file'
    echo    c. Arraste todos os arquivos desta pasta para lá e clique em 'Commit changes'!
    echo.
    echo 2. INSTALAR O GIT:
    echo    Instale pelo site oficial: https://git-scm.com/download/win
    echo    Ou abra o PowerShell e digite: winget install --id Git.Git -e --source winget
    echo.
    pause
    exit /b
)

echo [OK] Git encontrado!
echo.
echo Inicializando repositório Git local...
git init
git add .
git commit -m "feat: Anti-Distraction - App e Extensão com transcrição e alertas por palavras-chave"
git branch -M main

echo.
echo =====================================================================
echo Agora, crie um repositório vazio no seu GitHub: https://github.com/new
echo.
set /p REPO_URL="Cole aqui a URL do seu repositório GitHub (ex: https://github.com/seu-usuario/anti-distraction.git): "

if "%REPO_URL%"=="" (
    echo Nenhuma URL informada. O repositório local está pronto e comitado!
    echo Para enviar manualmente depois, use:
    echo git remote add origin SUA_URL
    echo git push -u origin main
) else (
    git remote remove origin 2>nul
    git remote add origin %REPO_URL%
    echo Enviando arquivos para o GitHub...
    git push -u origin main
    echo.
    echo [SUCESSO] Seu app e extensão já estão no GitHub!
)

echo.
pause
