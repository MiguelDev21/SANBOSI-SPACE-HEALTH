@echo off
rem SANBOSI - doble clic en Windows: instala lo necesario (la primera vez), arranca la estacion
rem y los relojes simulados, y abre el panel y el reloj en el navegador.
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title SANBOSI

set "PY="
py -3 --version >nul 2>nul && set "PY=py -3"
if not defined PY ( python --version >nul 2>nul && set "PY=python" )
if not defined PY (
  echo.
  echo  No se encontro Python en este computador.
  echo  Instala Python 3.11, 3.12 o 3.13 desde https://www.python.org/downloads/
  echo  y marca la casilla "Add python.exe to PATH" durante la instalacion.
  echo  Luego vuelve a hacer doble clic en este archivo.
  start "" https://www.python.org/downloads/
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo  Creando entorno de Python ^(solo la primera vez^)...
  %PY% -m venv .venv
)
set "VPY=%~dp0.venv\Scripts\python.exe"
echo  Instalando dependencias ^(la primera vez tarda unos minutos^)...
"%VPY%" -m pip install -q --upgrade pip
"%VPY%" -m pip install -q -r requirements.txt
if errorlevel 1 (
  echo  No se pudieron instalar las dependencias. Revisa la conexion a internet y vuelve a intentarlo.
  pause
  exit /b 1
)

rem Si quedo una estacion anterior en el puerto 8700, se cierra
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8700" ^| findstr "LISTENING"') do taskkill /PID %%p /F >nul 2>nul

echo  Iniciando estacion SANBOSI en http://localhost:8700 ...
start "SANBOSI Estacion" /min "%VPY%" -m station.app
timeout /t 5 /nobreak >nul
echo  Iniciando relojes simulados...
start "SANBOSI Relojes" /min "%VPY%" watch\simulator.py --station http://localhost:8700
timeout /t 4 /nobreak >nul

start "" http://localhost:8700/
start "" http://localhost:8700/watch

echo.
echo   Todo arriba
echo     Panel de la estacion   http://localhost:8700
echo     Reloj del astronauta   http://localhost:8700/watch
echo     Vista Tierra           http://localhost:8700/?ver=earth
echo.
echo   Usa Chrome o Edge para la voz ^("Hola Sanbosi"^).
echo   Para apagar todo, presiona una tecla en esta ventana.
pause >nul
taskkill /FI "WINDOWTITLE eq SANBOSI Estacion*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq SANBOSI Relojes*" /T /F >nul 2>nul
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8700" ^| findstr "LISTENING"') do taskkill /PID %%p /F >nul 2>nul
endlocal
