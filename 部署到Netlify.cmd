@echo off
chcp 65001 >nul
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 20 或更新版本。
  pause
  exit /b 1
)
if not exist ".netlify\state.json" (
  echo 首次部署需要登录 Netlify，并选择现有站点 incomparable-yeot-02251a。
  call npx --yes netlify-cli link
  if errorlevel 1 (
    echo 站点绑定未完成。
    pause
    exit /b 1
  )
)
echo 正在构建并发布到已绑定的 Netlify 站点……
call npx --yes netlify-cli deploy --prod --build
if errorlevel 1 (
  echo 部署失败，请查看上方提示。
  pause
  exit /b 1
)
echo 部署完成。
pause
