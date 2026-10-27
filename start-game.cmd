@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 犇犇的车库 - 游戏启动器

if not exist "%~dp0tools\serve-game.py" (
  echo 找不到 tools\serve-game.py，请保持启动文件位于项目根目录。
  pause
  exit /b 1
)

set "GAME_PY="
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; sys.exit(0 if sys.version_info.major == 3 else 1)" >nul 2>nul
  if not errorlevel 1 set "GAME_PY=py -3"
)
if defined GAME_PY goto launch
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; sys.exit(0 if sys.version_info.major == 3 else 1)" >nul 2>nul
  if not errorlevel 1 set "GAME_PY=python"
)
if not defined GAME_PY (
  echo 未找到可用的 Python 3，请安装后重新双击此文件。
  pause
  exit /b 1
)

:launch
echo 正在启动犇犇的车库：完整片头 - AI 无限氮气 - 1 秒预判
echo 每日三个场景各可挑战 1 次。游玩时请保持服务窗口开启。
%GAME_PY% -B "%~dp0tools\serve-game.py"
set "GAME_EXIT=%ERRORLEVEL%"
if not "%GAME_EXIT%"=="0" (
  echo 启动失败，请查看上方提示。
  pause
)
exit /b %GAME_EXIT%
