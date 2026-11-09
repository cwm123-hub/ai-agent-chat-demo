@echo off
chcp 936 >nul
setlocal
cd /d "%~dp0"

set GH_USER=cwm123-hub
set GH_REPO=ai-agent-chat-demo

where git >nul 2>nul
if errorlevel 1 (
  echo [x] 没有检测到 Git，请先安装：https://git-scm.com/download/win
  pause
  exit /b 1
)

echo ==========================================
echo   发布到 GitHub：%GH_USER%/%GH_REPO%
echo ==========================================
echo.

if not exist ".git" (
  git init
  git branch -M main
)

echo [1/3] 暂存并提交代码...
git add .
git commit -m "feat: AI Agent 对话助手（Vue3 + DeepSeek，SSE + Function Calling）"

echo.
echo [2/3] 配置远程仓库...
git remote remove origin >nul 2>nul
git remote add origin https://github.com/%GH_USER%/%GH_REPO%.git

echo.
echo [3/3] 推送（首次会弹出登录窗口，点 "Sign in with your browser"）...
git push -u origin main
if errorlevel 1 (
  echo.
  echo [x] 推送失败，常见原因：
  echo     1. GitHub 上还没有创建名为 %GH_REPO% 的仓库
  echo     2. 没在弹出的窗口里完成登录
  pause
  exit /b 1
)

echo.
echo [ok] 代码已推送。
echo.
echo 接下来手动两步：
echo   1. 打开 https://github.com/%GH_USER%/%GH_REPO%/settings/pages
echo   2. Source 选 "GitHub Actions"，等 1 分钟
echo.
echo 项目链接：https://%GH_USER%.github.io/%GH_REPO%/
echo.
pause
