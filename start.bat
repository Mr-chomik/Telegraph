@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo  Telegraph - Telegram digital newspaper (demo)
echo ============================================

REM --- 1. Node.js ---------------------------------------------------------
node -v >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js >= 20 is required. Install it first.
  pause
  exit /b 1
)

REM --- 2. Docker daemon ----------------------------------------------------
docker info >nul 2>&1
if errorlevel 1 (
  echo [INFO] Docker daemon is not running, starting Docker Desktop...
  if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  ) else if exist "C:\Program Files\Docker\Docker\Docker Desktop (Windows).exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop (Windows).exe"
  )
  set /a tries=0
  :waitdocker
  set /a tries+=1
  docker info >nul 2>&1
  if not errorlevel 1 goto dockerready
  if !tries! geq 40 (
    echo [ERROR] Docker daemon did not start. Launch Docker Desktop manually.
    pause
    exit /b 1
  )
  timeout /t 3 /nobreak >nul
  goto waitdocker
)
:dockerready
echo [OK] Docker daemon is ready.

REM --- 3. Database container -----------------------------------------------
echo [INFO] Starting PostgreSQL...
docker compose up -d db >nul
set /a tries=0
:waitdb
set /a tries+=1
docker compose exec -T db pg_isready >nul 2>&1
if not errorlevel 1 goto dbready
if !tries! geq 40 (
  echo [ERROR] PostgreSQL did not become ready.
  pause
  exit /b 1
)
timeout /t 3 /nobreak >nul
goto waitdb
:dbready
echo [OK] PostgreSQL is ready.

REM --- 4. Dependencies ------------------------------------------------------
if not exist node_modules (
  echo [INFO] Installing dependencies - first run only...
  call npm install
  if errorlevel 1 ( echo [ERROR] npm install failed. & pause & exit /b 1 )
)

REM --- 5. Optional fresh reset ----------------------------------------------
if /i "%~1"=="fresh" (
  echo [INFO] Resetting database schema - fresh run...
  docker compose exec -T db psql -U telegraph -d telegraph -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >nul
)

REM --- 6. Migrations + seed + editorial jobs --------------------------------
echo [INFO] Applying migrations...
call npm -w @telegraph/db run db:deploy >nul
if errorlevel 1 ( echo [ERROR] Migrations failed. & pause & exit /b 1 )

echo [INFO] Seeding demo data...
call npm run db:seed:demo
if errorlevel 1 ( echo [ERROR] Seeding failed. & pause & exit /b 1 )

echo [INFO] Generating today's edition (process + generateEdition)...
call npx tsx e2e/setup-jobs.ts
if errorlevel 1 ( echo [WARN] Edition job had issues; the app will still start. )

REM --- 7. Launch apps --------------------------------------------------------
echo [INFO] Starting web + worker...
start "Telegraph Web" cmd /k "npm run dev:web"
start "Telegraph Worker" cmd /k "npm run dev:worker"

echo.
echo ============================================
echo  Demo:  http://localhost:3000
echo  Login: demo@telegraph.app  /  demo1234
echo  (close the two windows to stop the apps)
echo ============================================
timeout /t 6 /nobreak >nul
start http://localhost:3000
exit /b 0
