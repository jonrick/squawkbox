Clear-Host
Write-Host "                                                                       "
Write-Host "   _____                            __   ____            " -ForegroundColor Cyan
Write-Host "  / ___/____ ___  ______ __      __/ /__/ __ )____  _  __" -ForegroundColor Cyan
Write-Host "  \__ \/ __ `/ / / / __ `/ | /| / / //_/ __  / __ \| |/_/" -ForegroundColor Cyan
Write-Host " ___/ / /_/ / /_/ / /_/ /| |/ |/ / ,< / /_/ / /_/ />  <  " -ForegroundColor Cyan
Write-Host "/____/\__, /\__,_/\__,_/ |__/|__/_/|_/_____/\____/_/|_|  " -ForegroundColor Cyan
Write-Host "        /_/                                              " -ForegroundColor Cyan
Write-Host "                                                                       "
Write-Host "      ---  T O T A L   S Y S T E M   A C T I V A T I O N  ---          " -ForegroundColor Gray
Write-Host "                                                                       "

# 1. Kill existing node processes
Write-Host "[!] CLEANUP: Stopping existing Node processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
}

# 2. Backend Setup
Write-Host "[>] BACKEND: Initializing API Gateway & Database..." -ForegroundColor Magenta
Set-Location -Path "$PSScriptRoot\backend"
npx prisma generate
npx prisma db push
Start-Process powershell -ArgumentList "npm run dev" -WorkingDirectory "$PSScriptRoot\backend" -WindowStyle Normal

# 3. Frontend Setup
Write-Host "[>] FRONTEND: Launching Dashboard Interface..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "npm run dev" -WorkingDirectory "$PSScriptRoot\frontend" -WindowStyle Normal

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host " SUCCESS: SquawkBox is now powering up!                        " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  DASHBOARD:  http://localhost:3000" -ForegroundColor White
Write-Host "  API GATEWAY: http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host " Check the newly opened terminal windows for real-time logs." -ForegroundColor Gray
Write-Host ""
