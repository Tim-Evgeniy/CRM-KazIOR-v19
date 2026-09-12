@echo off
chcp 65001 >nul
cd /d "%~dp0"
where docker >nul 2>nul
if errorlevel 1 (
 echo Установите и запустите Docker Desktop. Затем повторите.
 pause
 exit /b 1
)
docker compose -f server\eds-compose.yml up -d
if errorlevel 1 (
 echo Не удалось запустить NCANode. Проверьте Docker и доступ к Интернету.
 pause
 exit /b 1
)
echo NCANode запускается на http://127.0.0.1:14579
echo В CRM: Интеграции - ЭЦП - NCANode - Включить проверку - Сохранить.
echo На компьютере подписанта нужно запустить NCALayer.
pause
