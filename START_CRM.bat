@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title KazIOR CRM - Local launcher
pushd "%~dp0"
if errorlevel 1 goto directory_error
if not exist "index.html" goto files_missing
if not exist "server\launch.py" goto files_missing
set "KAZIOR_START_SCRIPT=server\launch.py"
set "KAZIOR_START_ARGS=--mode auto"
if /i "%~1"=="import-v14" set "KAZIOR_START_SCRIPT=server\import_v14.py"
if /i "%~1"=="import-v14" set "KAZIOR_START_ARGS="
if /i "%~1"=="server" set "KAZIOR_START_ARGS=--host 0.0.0.0 --no-browser"
if /i "%~1"=="configure" set "KAZIOR_START_SCRIPT=server\maintenance.py"
if /i "%~1"=="configure" set "KAZIOR_START_ARGS=configure"
if /i "%~1"=="restore" set "KAZIOR_START_SCRIPT=server\maintenance.py"
if /i "%~1"=="restore" set "KAZIOR_START_ARGS=restore"
if /i "%~1"=="backup" set "KAZIOR_START_SCRIPT=server\maintenance.py"
if /i "%~1"=="backup" set "KAZIOR_START_ARGS=backup"
if /i "%~1"=="reset-password" set "KAZIOR_START_SCRIPT=server\maintenance.py"
if /i "%~1"=="reset-password" set "KAZIOR_START_ARGS=reset-password"
echo.
echo КазНИИОиР CRM — автоматический запуск
echo.
call :find_python
if not errorlevel 1 goto run_crm
echo Python 3.10 или новее не найден.
where winget.exe >nul 2>nul
if errorlevel 1 goto manual_install
echo Можно установить Python 3.13 для текущего пользователя через WinGet.
choice /c IN /n /m "I — установить Python, N — выйти: "
if errorlevel 2 goto finish
winget install --id Python.Python.3.13 --exact --source winget --scope user
if errorlevel 1 goto install_error
call :find_python
if not errorlevel 1 goto run_crm
echo Python установлен. Закройте это окно и снова запустите START_CRM.bat.
goto wait_finish

:run_crm
"%KAZIOR_PYTHON%" %KAZIOR_PY_ARGS% -X utf8 -u "%KAZIOR_START_SCRIPT%" %KAZIOR_START_ARGS%
set "KAZIOR_EXIT=%errorlevel%"
if "%KAZIOR_EXIT%"=="0" goto wait_finish
echo.
echo Запуск не завершён. Причина указана выше.
goto wait_finish

:manual_install
echo На компьютере также не найден WinGet.
echo Сейчас откроется официальный сайт Python.
echo Установите Python 3.10 или новее и повторите запуск BAT-файла.
start "" "https://www.python.org/downloads/windows/"
goto wait_finish

:install_error
echo.
echo WinGet не смог установить Python. Сообщение об ошибке показано выше.
echo Официальная загрузка: https://www.python.org/downloads/windows/
goto wait_finish

:files_missing
echo Распакуйте ВЕСЬ архив, затем запускайте START_CRM.bat из папки CRM.
echo Рядом должны находиться index.html и папка server.
goto wait_finish

:directory_error
echo Не удалось открыть папку CRM. Перенесите распакованный проект в доступную папку.
pause
exit /b 1

:wait_finish
echo.
pause
:finish
popd
exit /b

:find_python
set "KAZIOR_PYTHON="
set "KAZIOR_PY_ARGS="
py -3 -c "import sys,sqlite3,ssl,http.server,webbrowser;sys.exit(sys.version_info[:2] < (3,10))" >nul 2>nul
if errorlevel 1 goto find_python_command
set "KAZIOR_PYTHON=py"
set "KAZIOR_PY_ARGS=-3"
exit /b 0
:find_python_command
python -c "import sys,sqlite3,ssl,http.server,webbrowser;sys.exit(sys.version_info[:2] < (3,10))" >nul 2>nul
if errorlevel 1 goto find_python3_command
set "KAZIOR_PYTHON=python"
exit /b 0
:find_python3_command
python3 -c "import sys,sqlite3,ssl,http.server,webbrowser;sys.exit(sys.version_info[:2] < (3,10))" >nul 2>nul
if errorlevel 1 goto find_python_folders
set "KAZIOR_PYTHON=python3"
exit /b 0
:find_python_folders
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*" "%ProgramFiles%\Python3*" "%LOCALAPPDATA%\Python\pythoncore-*") do call :try_python_path "%%~fD\python.exe"
if defined KAZIOR_PYTHON exit /b 0
exit /b 1
:try_python_path
if defined KAZIOR_PYTHON exit /b 0
if not exist "%~1" exit /b 1
"%~1" -c "import sys,sqlite3,ssl,http.server,webbrowser;sys.exit(sys.version_info[:2] < (3,10))" >nul 2>nul
if errorlevel 1 exit /b 1
set "KAZIOR_PYTHON=%~1"
exit /b 0
