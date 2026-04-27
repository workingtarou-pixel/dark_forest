@echo off
title DARK FOREST - Game Server
echo ============================================
echo   DARK FOREST - Horror Game
echo ============================================
echo.
echo [1] ゲームサーバー + 開発サーバー両方起動
echo [2] ゲームサーバーのみ起動 (ポート8080)
echo [3] 開発サーバーのみ起動 (ポート3000)
echo [4] 本番ビルド (難読化付き)
echo.
set /p choice="選択してください (1-4): "

if "%choice%"=="1" goto both
if "%choice%"=="2" goto server
if "%choice%"=="3" goto dev
if "%choice%"=="4" goto build

:both
echo.
echo [起動] サーバーとゲームを同時に起動します...
start "DARK FOREST Server" cmd /k "cd /d %~dp0 && node server/server.js"
timeout /t 2 >nul
start "DARK FOREST Game" cmd /k "cd /d %~dp0 && npx vite --open"
echo.
echo ブラウザで http://localhost:3000 を開いてください
goto end

:server
echo.
echo [起動] WebSocketサーバーを起動中...
cd /d %~dp0
node server/server.js
goto end

:dev
echo.
echo [起動] 開発サーバーを起動中...
cd /d %~dp0
npx vite --open
goto end

:build
echo.
echo [ビルド] 本番用ビルド (難読化付き)...
cd /d %~dp0
call npm run build
echo.
echo ビルド完了！ dist/ フォルダに出力されました。
echo サーバー起動: node server/server.js
echo プレビュー: npx vite preview
pause
goto end

:end
