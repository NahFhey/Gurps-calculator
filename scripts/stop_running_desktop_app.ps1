$ErrorActionPreference = "Stop"

$processes = Get-Process -Name "GURPS VTT" -ErrorAction SilentlyContinue

if (-not $processes) {
  Write-Output "No running GURPS VTT process found."
  exit 0
}

$processes | Stop-Process -Force

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Milliseconds 500
  $stillRunning = Get-Process -Name "GURPS VTT" -ErrorAction SilentlyContinue
  if (-not $stillRunning) {
    Write-Output "Stopped running GURPS VTT process."
    exit 0
  }
}

throw "GURPS VTT is still running after waiting for shutdown."
