@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 犇犇的车库 - 游戏启动器
if not exist "tools\serve-game.py" goto missing
if not exist "index.html" goto missing
for %%F in ("battle.html" "js\battle-engine.js" "js\battle-ai.js" "js\battle-data.js" "js\battle-store.js" "js\battle-scene.js" "vendor\three\three.module.js") do (
  if not exist "%%~F" (
    echo 缺少游戏文件：%%~F
    goto missing
  )
)
echo 当前版本：AI 全属性减 2，档次不高于玩家；每日三个场景各一次。

py -3 -c "import sys; sys.exit(sys.version_info.major != 3)" >nul 2>nul
if not errorlevel 1 goto pythonlauncher
python -c "import sys; sys.exit(sys.version_info.major != 3)" >nul 2>nul
if not errorlevel 1 goto pythonpath
echo 未检测到 Python 3，请安装 Python 3 后重新启动。
pause
exit /b 1

:pythonlauncher
echo 正在启动游戏，请保持此服务窗口开启。
echo 地址：http://127.0.0.1:8765/index.html?intro=full
py -3 -B "tools\serve-game.py"
goto result

:pythonpath
echo 正在启动游戏，请保持此服务窗口开启。
echo 地址：http://127.0.0.1:8765/index.html?intro=full
python -B "tools\serve-game.py"
goto result

:result
if errorlevel 1 goto failed
exit /b 0

:missing
echo 游戏文件不完整，请将启动文件保留在完整游戏文件夹中。
goto failed

:failed
echo 启动失败，请查看上方错误。不要直接打开 index.html。
pause
exit /b 1
