@echo off
echo ==========================================
echo   DesaWisata Nusantara - Development
echo ==========================================
echo.
echo Starting Backend with Hot Reload (port 5200)...
echo Starting Frontend Dev Server (port 5173)...
echo.

REM Start backend with hot reload in background
start "DesaWisata Backend (Hot Reload)" cmd /c "cd backend\DesaWisataApi && dotnet watch --urls=http://localhost:5200"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend dev server in background
start "DesaWisata Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo ==========================================
echo   Servers are starting...
echo   Backend:  http://localhost:5200
echo   Frontend: http://localhost:5173
echo   Swagger:  http://localhost:5200/swagger
echo ==========================================
echo.
echo Press any key to exit this window...
pause >nul
