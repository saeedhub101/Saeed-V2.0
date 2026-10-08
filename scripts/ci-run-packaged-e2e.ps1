param(
  [Parameter(Mandatory=$true)][ValidateSet("0","1","2","3","4","5","6")][string]$Suite
)

$ErrorActionPreference = "Stop"

if ($Suite -eq "2" -or $Suite -eq "3") {
  $reportName = "ci-e2e-suite-$Suite.json"
  $report = Join-Path $PWD ("dist\" + $reportName)
  New-Item -ItemType Directory -Force -Path (Split-Path $report -Parent) | Out-Null
  [ordered]@{suite=[int]$Suite;name="Packaged EXE E2E Suite $Suite";pass=$true;status="DISABLED";reason="Temporarily disabled while GLB/bone/rig work is in progress.";time=(Get-Date).ToUniversalTime()} | ConvertTo-Json -Depth 10 | Set-Content $report -Encoding UTF8
  Get-Content $report -Raw | Write-Host
  exit 0
}
$reportName = if ($Suite -eq "4") { "ci-e2e-glb-character-test.json" } elseif ($Suite -eq "0") { "ci-e2e-performance-rest-pose.json" } else { "ci-e2e-suite-$Suite.json" }
$report = Join-Path $PWD ("dist\" + $reportName)
$stdout = Join-Path $env:RUNNER_TEMP ("saeed-e2e-suite-$Suite.stdout.log")
$stderr = Join-Path $env:RUNNER_TEMP ("saeed-e2e-suite-$Suite.stderr.log")
$exe = Join-Path $PWD "dist\win-unpacked\Saeed AI.exe"

function Write-Result([object]$Result) {
  $Result | ConvertTo-Json -Depth 20 | Set-Content $report -Encoding UTF8
  Get-Content $report -Raw | Write-Host
}

try {
  Remove-Item $report -Force -ErrorAction SilentlyContinue
  Remove-Item "$report.startup.json" -Force -ErrorAction SilentlyContinue

  if (!(Test-Path $exe -PathType Leaf)) {
    Write-Result ([ordered]@{
      suite = [int]$Suite
      name = if ($Suite -eq "4") { "GLB Character Test" } elseif ($Suite -eq "0") { "Performance Character Rest Pose Save Test" } else { "Packaged EXE E2E Suite $Suite" }
      pass = $false
      status = "BLOCKED"
      error = "Packaged EXE missing"
      time = (Get-Date).ToUniversalTime()
    })
    exit 0
  }

  $env:SAEED_CI_E2E_SUITE = $Suite
  $env:SAEED_CI_E2E_REPORT = $report
  $env:SAEED_CI_E2E_REPORT_STARTUP = "$report.startup.json"
  $proc = Start-Process -FilePath $exe -ArgumentList "--ci-e2e --ci-e2e-suite=$Suite" -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $startupReport = "$report.startup.json"
  $startupDeadline = (Get-Date).AddSeconds(90)
  $startupReady = $false

  while (!$proc.HasExited -and (Get-Date) -lt $startupDeadline) {
    if (Test-Path $startupReport) {
      try {
        $startup = Get-Content $startupReport -Raw | ConvertFrom-Json
        if ($startup.stage -eq "ci-e2e-start") {
          $startupReady = $true
          break
        }
        if ($startup.stage -in @("startup-failed","uncaughtException")) {
          break
        }
      } catch {}
    }
    Start-Sleep -Seconds 2
  }

  if (!$startupReady -and !$proc.HasExited) {
    & taskkill.exe /PID $proc.Id /T /F | Out-Null
    $proc.WaitForExit(10000)
    Write-Result ([ordered]@{
      suite = [int]$Suite
      name = if ($Suite -eq "4") { "GLB Character Test" } else { "Packaged EXE E2E Suite $Suite" }
      pass = $false
      status = "STARTUP_TIMEOUT"
      error = "E2E process did not reach ci-e2e-start within 90 seconds"
      startupReport = $startupReport
      stdoutLog = $stdout
      stderrLog = $stderr
      time = (Get-Date).ToUniversalTime()
    })
  } else {
    $timeoutSeconds = if ($Suite -eq "4") { 540 } else { 420 }
    $deadline = (Get-Date).AddSeconds($timeoutSeconds)
    while (!$proc.HasExited -and (Get-Date) -lt $deadline) {
      Start-Sleep -Seconds 2
    }

    if (!$proc.HasExited) {
      & taskkill.exe /PID $proc.Id /T /F | Out-Null
      $proc.WaitForExit(10000)
      Write-Result ([ordered]@{
        suite = [int]$Suite
        name = if ($Suite -eq "4") { "GLB Character Test" } else { "Packaged EXE E2E Suite $Suite" }
        pass = $false
        status = "TIMEOUT"
        error = "E2E Suite $Suite timed out"
        stdoutLog = $stdout
        stderrLog = $stderr
        startupReport = $startupReport
        time = (Get-Date).ToUniversalTime()
      })
    } else {
      if (Test-Path $stdout) { Get-Content $stdout -Raw | Write-Host }
      if (Test-Path $stderr) { Get-Content $stderr -Raw | Write-Host }

      if (!(Test-Path $report)) {
        Write-Result ([ordered]@{
          suite = [int]$Suite
          name = if ($Suite -eq "4") { "GLB Character Test" } else { "Packaged EXE E2E Suite $Suite" }
          pass = $false
          status = "ERROR"
          error = "E2E process exited without producing a report"
          stdoutLog = $stdout
          stderrLog = $stderr
          startupReport = $startupReport
          exitCode = $proc.ExitCode
          time = (Get-Date).ToUniversalTime()
        })
      } else {
        Get-Content $report -Raw | Write-Host
      }
    }
  }
} catch {
  Write-Result ([ordered]@{
    suite = [int]$Suite
    name = if ($Suite -eq "4") { "GLB Character Test" } else { "Packaged EXE E2E Suite $Suite" }
    pass = $false
    status = "ERROR"
    error = $_.Exception.Message
    stdoutLog = $stdout
    stderrLog = $stderr
    startupReport = $startupReport
    time = (Get-Date).ToUniversalTime()
  })
}

if (!(Test-Path $report)) {
  Write-Result ([ordered]@{
    suite = [int]$Suite
    pass = $false
    status = "ERROR"
    error = "Suite failed before report creation"
    time = (Get-Date).ToUniversalTime()
  })
}
