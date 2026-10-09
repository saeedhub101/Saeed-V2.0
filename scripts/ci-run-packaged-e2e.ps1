param(
  [Parameter(Mandatory=$true)][ValidateSet("current")][string]$Suite
)

$ErrorActionPreference = "Stop"
$report = Join-Path $PWD "dist\ci-e2e-current-acceptance.json"
$stdout = Join-Path $env:RUNNER_TEMP "saeed-e2e-current.stdout.log"
$stderr = Join-Path $env:RUNNER_TEMP "saeed-e2e-current.stderr.log"
$exe = Join-Path $PWD "dist\win-unpacked\Saeed AI.exe"
$required = @(
  "acceptance.app-startup",
  "acceptance.authoritative-glb-visible",
  "acceptance.repeat-load-preserves-visible-character",
  "acceptance.available-bones-animate"
)

function Write-Result([object]$Result) {
  New-Item -ItemType Directory -Force -Path (Split-Path $report -Parent) | Out-Null
  $Result | ConvertTo-Json -Depth 30 | Set-Content $report -Encoding UTF8
  Get-Content $report -Raw | Write-Host
}

try {
  New-Item -ItemType Directory -Force -Path (Split-Path $report -Parent) | Out-Null
  Remove-Item $report -Force -ErrorAction SilentlyContinue
  Remove-Item "$report.startup.json" -Force -ErrorAction SilentlyContinue
  if (!(Test-Path $exe -PathType Leaf)) {
    Write-Result ([ordered]@{suite=$Suite;pass=$false;error="Packaged EXE missing";requiredChecks=$required})
    exit 1
  }

  $env:SAEED_CI_E2E_SUITE = $Suite
  $env:SAEED_CI_E2E_REPORT = $report
  $env:SAEED_CI_E2E_REPORT_STARTUP = "$report.startup.json"
  $proc = Start-Process -FilePath $exe -ArgumentList "--ci-e2e --ci-e2e-suite=$Suite" -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $startupReport = "$report.startup.json"
  $startupDeadline = (Get-Date).AddSeconds(120)
  $startupReady = $false
  while (!$proc.HasExited -and (Get-Date) -lt $startupDeadline) {
    if (Test-Path $startupReport) {
      try {
        $startup = Get-Content $startupReport -Raw | ConvertFrom-Json
        if ($startup.stage -eq "ci-e2e-start") { $startupReady = $true; break }
        if ($startup.stage -in @("startup-failed","uncaughtException")) { break }
      } catch {}
    }
    Start-Sleep -Seconds 2
  }
  if (!$startupReady) {
    if (!$proc.HasExited) { & taskkill.exe /PID $proc.Id /T /F | Out-Null; $proc.WaitForExit(10000) }
    if (Test-Path $stdout) { Get-Content $stdout -Raw | Write-Host }
    if (Test-Path $stderr) { Get-Content $stderr -Raw | Write-Host }
    Write-Result ([ordered]@{suite=$Suite;pass=$false;status="STARTUP_FAILED";error="Packaged app did not reach ci-e2e-start within 120 seconds";startupReport=$startupReport;stdoutLog=$stdout;stderrLog=$stderr})
    exit 1
  }

  $deadline = (Get-Date).AddMinutes(12)
  while (!$proc.HasExited -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
  if (!$proc.HasExited) {
    & taskkill.exe /PID $proc.Id /T /F | Out-Null
    $proc.WaitForExit(10000)
    Write-Result ([ordered]@{suite=$Suite;pass=$false;status="TIMEOUT";error="Current product acceptance suite exceeded 12 minutes";stdoutLog=$stdout;stderrLog=$stderr})
    exit 1
  }
  if (Test-Path $stdout) { Get-Content $stdout -Raw | Write-Host }
  if (Test-Path $stderr) { Get-Content $stderr -Raw | Write-Host }
  if (!(Test-Path $report -PathType Leaf)) {
    Write-Result ([ordered]@{suite=$Suite;pass=$false;status="NO_REPORT";error="Packaged app exited without an acceptance report";exitCode=$proc.ExitCode;stdoutLog=$stdout;stderrLog=$stderr})
    exit 1
  }

  $r = Get-Content $report -Raw | ConvertFrom-Json
  Get-Content $report -Raw | Write-Host
  $missing = @($required | Where-Object { $null -eq $r.checks.PSObject.Properties[$_] })
  $failed = @($required | Where-Object { $id=$_; $p=$r.checks.PSObject.Properties[$id]; -not $p -or $p.Value.pass -ne $true })
  if ($missing.Count -gt 0 -or $failed.Count -gt 0 -or $r.pass -ne $true) {
    Write-Host "MISSING_ACCEPTANCE_CHECKS=$($missing -join ',')"
    Write-Host "FAILED_ACCEPTANCE_CHECKS=$($failed -join ',')"
    exit 1
  }
  Write-Host "CURRENT_PRODUCT_ACCEPTANCE=PASS"
} catch {
  Write-Result ([ordered]@{suite=$Suite;pass=$false;status="ERROR";error=$_.Exception.Message})
  exit 1
}
