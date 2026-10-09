param(
  [Parameter(Mandatory=$true)][ValidateSet("current")][string]$Suite
)
$ErrorActionPreference = "Stop"
$exe = Join-Path $PWD "dist\win-unpacked\Saeed AI.exe"
$state = Join-Path $env:RUNNER_TEMP "saeed-character-persistence-state.json"
$stdoutBase = Join-Path $env:RUNNER_TEMP "saeed-persistence"
if (!(Test-Path $exe -PathType Leaf)) { throw "Packaged EXE missing: $exe" }
Remove-Item $state -Force -ErrorAction SilentlyContinue

function Invoke-PersistencePhase([string]$Phase) {
  $report = Join-Path $PWD "dist\ci-e2e-persistence-$Phase.json"
  $startup = "$report.startup.json"
  $stdout = "$stdoutBase-$Phase.stdout.log"
  $stderr = "$stdoutBase-$Phase.stderr.log"
  Remove-Item $report,$startup,$stdout,$stderr -Force -ErrorAction SilentlyContinue
  $env:SAEED_CI_E2E_REPORT = $report
  $env:SAEED_CI_PERSISTENCE_STATE = $state
  $proc = Start-Process -FilePath $exe -ArgumentList @("--ci-e2e","--ci-e2e-persistence=$Phase") -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $deadline = (Get-Date).AddSeconds(120)
  $ready = $false
  while (!$proc.HasExited -and (Get-Date) -lt $deadline) {
    if (Test-Path $startup) {
      try {
        $s = Get-Content $startup -Raw | ConvertFrom-Json
        if ($s.stage -eq "ci-e2e-persistence-start" -and $s.phase -eq $Phase) { $ready = $true; break }
      } catch {}
    }
    Start-Sleep -Seconds 2
  }
  if (!$ready) {
    if (!$proc.HasExited) { & taskkill.exe /PID $proc.Id /T /F | Out-Null; $proc.WaitForExit(10000) }
    throw "Persistence phase $Phase failed to start. stdout=$stdout stderr=$stderr"
  }
  $deadline = (Get-Date).AddMinutes(3)
  while (!$proc.HasExited -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
  if (!$proc.HasExited) {
    & taskkill.exe /PID $proc.Id /T /F | Out-Null
    $proc.WaitForExit(10000)
    throw "Persistence phase $Phase exceeded 3 minutes"
  }
  if (Test-Path $stdout) { Get-Content $stdout -Raw | Write-Host }
  if (Test-Path $stderr) { Get-Content $stderr -Raw | Write-Host }
  if (!(Test-Path $report -PathType Leaf)) { throw "Persistence phase $Phase produced no report" }
  $r = Get-Content $report -Raw | ConvertFrom-Json
  Get-Content $report -Raw | Write-Host
  if ($r.pass -ne $true) { throw "Persistence phase $Phase failed; inspect $report" }
  Write-Host "CHARACTER_PERSISTENCE_PHASE_$($Phase.ToUpper())=PASS"
}
try {
  Invoke-PersistencePhase "prepare"
  if (!(Test-Path $state -PathType Leaf)) { throw "Prepare phase did not create the state marker." }
  Invoke-PersistencePhase "verify"
  if (Test-Path $state) { throw "Verify phase did not remove its temporary state marker." }
  Write-Host "CHARACTER_PERSISTENCE_FULL_RESTART=PASS"
} finally {
  Remove-Item $state -Force -ErrorAction SilentlyContinue
}
