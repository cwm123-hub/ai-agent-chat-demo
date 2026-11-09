@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM 纯前端 Demo：不连后端、不需要 Key，用于截图 / 录屏 / 静态托管预览
if not exist node_modules (
  echo 正在安装依赖...
  call npm install --no-audit --no-fund
)

echo 构建 Demo 版...
call npm run build:demo
if errorlevel 1 (
  echo 构建失败
  pause
  exit /b 1
)

echo 预览地址 http://127.0.0.1:5178
start "" http://127.0.0.1:5178
call npm run serve:dist
