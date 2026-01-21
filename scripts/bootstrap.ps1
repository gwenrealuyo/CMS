$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot

$compose = @("docker", "compose")
try {
  & $compose[0] $compose[1] "version" *> $null
} catch {
  $compose = @("docker-compose")
}

if (-not (Get-Command $compose[0] -ErrorAction SilentlyContinue)) {
  Write-Host "Docker not found. Install Docker Desktop to run Postgres via docker-compose."
  exit 1
}

if ($compose.Length -gt 1) {
  & $compose[0] $compose[1] "up" "-d" "db"
} else {
  & $compose[0] "up" "-d" "db"
}

Set-Location "$RootDir/backend"

if (-not (Test-Path ".env")) {
  Copy-Item "env.example" ".env"
}

python -m venv .venv
& ".\.venv\Scripts\Activate.ps1"
pip install -r requirements.txt
python manage.py migrate

Set-Location "$RootDir/frontend"
npm install

Write-Host "Bootstrap complete."
Write-Host "Backend: cd backend; .\\.venv\\Scripts\\Activate.ps1; python manage.py runserver"
Write-Host "Frontend: cd frontend; npm run dev"
