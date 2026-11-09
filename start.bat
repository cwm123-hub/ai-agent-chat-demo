@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [x] 没有检测到 Node.js，请先安装：https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/2] 首次运行，正在安装依赖...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [x] 依赖安装失败，检查网络后重试
    pause
    exit /b 1
  )
)

if not exist .env (
  echo [i] 没有 .env，将以 Mock 模式启动（不需要 API Key，可直接演示）
)

echo [2/2] 启动开发服务器 http://localhost:5173 ...
start "" http://localhost:5173
call npm run dev
