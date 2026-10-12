@echo off
title Render Reception Invitation Video
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it with:   winget install OpenJS.NodeJS.LTS
  pause
  exit /b 1
)
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo FFmpeg is not installed. Install it with:   winget install Gyan.FFmpeg
  echo Then close this window and run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\puppeteer-core" (
  echo Installing the renderer - one time only...
  call npm install
)
echo.
echo Rendering the vertical 1080x1920 video. This takes about 5 minutes.
call node render\render.mjs --format=vertical
echo.
set /p H=Also render the horizontal 1920x1080 version? (y/n)
if /i "%H%"=="y" call node render\render.mjs --format=horizontal
echo.
echo Finished. The videos are in the "output" folder.
start "" "%~dp0output"
pause
