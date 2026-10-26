@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if not errorlevel 1 (
  python tools\serve-game.py
) else (
  py -3 tools\serve-game.py
)
if errorlevel 1 pause
