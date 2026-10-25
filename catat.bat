@echo off
rem Membuka Catat: menyalakan server lokal lalu membuka browser.
cd /d "%~dp0"
set PORT=3210

rem Bila Catat sudah berjalan, cukup buka browser.
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:%PORT%/api/sehat).StatusCode } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 (
  start "" http://127.0.0.1:%PORT%/
  exit /b
)

if not exist ".next\BUILD_ID" (
  echo Catat belum disiapkan. Menjalankan npm run setup...
  call npm run setup || (pause & exit /b 1)
)

start "Catat" /min cmd /c "npx next start -H 127.0.0.1 -p %PORT%"

rem Tunggu server siap (maks. 30 detik), lalu buka browser.
for /l %%i in (1,1,30) do (
  powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:%PORT%/api/sehat).StatusCode } catch { exit 1 }" >nul 2>&1 && goto buka
  timeout /t 1 /nobreak >nul
)
:buka
start "" http://127.0.0.1:%PORT%/
