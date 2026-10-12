@echo off
title Reception Invitation
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it with:   winget install OpenJS.NodeJS.LTS
  pause
  exit /b 1
)
echo Starting the invitation... a browser tab will open.
echo Keep this window open while you watch. Press Ctrl+C to stop.
node tools\serve.mjs
pause
