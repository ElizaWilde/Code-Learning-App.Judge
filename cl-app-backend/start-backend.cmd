@echo off
setlocal

set "NODE24=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE24%" (
  echo Node 24 runtime not found at "%NODE24%".
  echo Install Node.js 24.x or adjust this script.
  exit /b 1
)

if "%CODE_LEARNING_APP_DATABASE_PATH%"=="" (
  if not "%LOCALAPPDATA%"=="" (
    set "CODE_LEARNING_APP_DATABASE_PATH=%LOCALAPPDATA%\CodeLearningApp\app.db"
  )
)

if "%PORT%"=="" (
  set "PORT=8080"
)

pushd "%~dp0"
"%NODE24%" dist\server.js
set "EXIT_CODE=%ERRORLEVEL%"
popd

exit /b %EXIT_CODE%
