@echo off
title DARK FOREST - Quick Start
cd /d %~dp0
echo ============================================
echo   DARK FOREST - クイックスタート
echo ============================================
echo.
echo WebSocketサーバーを起動中...
start "DARK FOREST Server" cmd /c "cd /d %~dp0 && node server/server.js"
timeout /t 2 >nul
echo ゲームサーバーを起動中...
start "DARK FOREST Game" cmd /c "cd /d %~dp0 && npx vite --open"
echo.
echo ============================================
echo   起動完了！
echo   ブラウザで http://localhost:3000 を開いてね
echo ============================================
echo.
pause
