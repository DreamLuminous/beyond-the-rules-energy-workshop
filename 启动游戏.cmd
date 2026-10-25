@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "RULES_NODE="
for %%N in (node.exe) do set "RULES_NODE=%%~$PATH:N"
if not defined RULES_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "RULES_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined RULES_NODE (
  echo 请先安装 Node.js 20 或更新版本，再启动游戏。
  pause
  exit /b 1
)
"%RULES_NODE%" start-game.cjs
if errorlevel 1 pause
