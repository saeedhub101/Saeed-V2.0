param(
  [Parameter(Mandatory=$true)][ValidateSet("current","0","1","4","5","6")][string]$Suite
)

$ErrorActionPreference = "Stop"
$report = switch ($Suite) {
  "current" { Join-Path $PWD "dist\ci-e2e-current-acceptance.json"; break }
  "1" { Join-Path $PWD "dist\ci-e2e-performance-rest-pose.json"; break }
  "4" { Join-Path $PWD "dist\ci-e2e-glb-character-test.json"; break }
  default { Join-Path $PWD "dist\ci-e2e-suite-$Suite.json"; break }
}
$stdout = Join-Path $env:RUNNER_TEMP ("saeed-e2e-" + $Suite + ".stdout.log")
$stderr = Join-Path $env:RUNNER_TEMP ("saeed-e2e-" + $Suite + ".stderr.log")
$exe = Join-Path $PWD "dist\win-unpacked\Saeed AI.exe"
$required = switch ($Suite) {
  "current" { @("acceptance.app-startup","acceptance.authoritative-glb-visible","acceptance.repeat-load-preserves-visible-character","acceptance.available-bones-animate","acceptance.rest-pose-bone-position-save-reset","acceptance.rest-pose-process-restart"); break }
  "0" { @("startup.character-visible","startup.tray","startup.mic-off","startup.brain-off","tray.single-owner-and-menu","hide-saeed-keeps-tray","show-saeed-restores","idle-final"); break }
  "1" { @("performance.character-save-rest-pose","performance.open-character-controller","performance.all-tabs-functional","performance.control-real-bone","performance.procedural-motion-real-bone","performance.create-edit-delete-motion","performance.rig-auto-map","performance.all-registered-compatible-motions","performance.close","acceptance.rest-pose-process-restart"); break }
  "4" { @("acceptance.app-startup","acceptance.authoritative-glb-visible","acceptance.repeat-load-preserves-visible-character","acceptance.available-bones-animate","glbtest.authoritative-asset-and-visible-character","glbtest.full-load-pipeline","glbtest.generation-and-repeat-load","glb.current-character-loaded"); break }
  "5" { @("startup.mic-off","startup.brain-off","chat.open","chat.local-time","brain.intent-open-my-computer","brain.intent-api-escalation","chat.response-reaches-character-bubble","voice.chat-response-tts-chain","chat.ui-response-visible","voice.renderer-capabilities","voice.output-device-capability","voice.tts-local-output","voice.mic-device-capability","mute.text-still-visible","chat.close-keeps-brain-when-mic-on","mic-off-releases-brain-after-chat-closed"); break }
  "6" { @("windows.settings","windows.addons","windows.learning","windows.status","character.normalize-humanoid-rest-pose-window","character.studio-open-and-controls","startup.addons-window-opens","startup.learning-window-opens","startup.microphone-transcript-label-toggle-and-render","character.studio-editor-world-axis-rotation","character.studio-nested-axis-stability","character.studio-rest-pose-save-reset","character.studio-bone-rotation","character.studio-animation-any-bone-edit-play","character.studio-every-button-and-live-animation","character.studio-close-button","tray.single-owner-and-menu","hide-saeed-keeps-tray","show-saeed-restores","idle-final"); break }
}

function Write-Result([object]$Result) {
  $destination = $report
  if (Test-Path $report -PathType Leaf) { $destination = "$report.runner-failure.json" }
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
  $Result | ConvertTo-Json -Depth 30 | Set-Content $destination -Encoding UTF8
  Get-Content $destination -Raw | Write-Host
}

try {
  New-Item -ItemType Directory -Force -Path (Split-Path $report -Parent) | Out-Null
  Remove-Item $report -Force -ErrorAction SilentlyContinue
  Remove-Item "$report.startup.json" -Force -ErrorAction SilentlyContinue
  Remove-Item "$report.runner-failure.json" -Force -ErrorAction SilentlyContinue
  Remove-Item "$report.restart.json" -Force -ErrorAction SilentlyContinue
  Remove-Item "$report.restart.startup.json" -Force -ErrorAction SilentlyContinue
  if (!(Test-Path $exe -PathType Leaf)) {
    Write-Result ([ordered]@{suite=$Suite;pass=$false;error="Packaged EXE missing";requiredChecks=$required})
    exit 1
  }

  $env:SAEED_CI_E2E_SUITE = $Suite
  $env:SAEED_CI_E2E_RESTART_PHASE = "prepare"
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
  if ($Suite -notin @("current","1")) {
    Write-Host "PACKAGED_E2E_SUITE_$Suite=PASS"
    exit 0
  }

  # Relaunch the packaged EXE in a fresh process and verify that the saved bone
  # transform is restored from persistent character profile storage.
  $restartReport = "$report.restart.json"
  $restartStartup = "$report.restart.startup.json"
  $restartStdout = Join-Path $env:RUNNER_TEMP "saeed-e2e-restart.stdout.log"
  $restartStderr = Join-Path $env:RUNNER_TEMP "saeed-e2e-restart.stderr.log"
  $env:SAEED_CI_E2E_RESTART_PHASE = "verify"
  $env:SAEED_CI_E2E_REPORT = $restartReport
  $env:SAEED_CI_E2E_REPORT_STARTUP = $restartStartup
  $proc2 = Start-Process -FilePath $exe -ArgumentList "--ci-e2e --ci-e2e-suite=$Suite" -PassThru -RedirectStandardOutput $restartStdout -RedirectStandardError $restartStderr
  $restartStartupDeadline = (Get-Date).AddSeconds(120)
  $restartStartupReady = $false
  while (!$proc2.HasExited -and (Get-Date) -lt $restartStartupDeadline) {
    if (Test-Path $restartStartup) {
      try {
        $startup2 = Get-Content $restartStartup -Raw | ConvertFrom-Json
        if ($startup2.stage -eq "ci-e2e-start") { $restartStartupReady = $true; break }
        if ($startup2.stage -in @("startup-failed","uncaughtException")) { break }
      } catch {}
    }
    Start-Sleep -Seconds 2
  }
  if (!$restartStartupReady) {
    if (!$proc2.HasExited) { & taskkill.exe /PID $proc2.Id /T /F | Out-Null; $proc2.WaitForExit(10000) }
    if (Test-Path $restartStdout) { Get-Content $restartStdout -Raw | Write-Host }
    if (Test-Path $restartStderr) { Get-Content $restartStderr -Raw | Write-Host }
    Write-Result ([ordered]@{suite=$Suite;pass=$false;status="RESTART_STARTUP_FAILED";error="Second packaged process did not reach ci-e2e-start within 120 seconds";startupReport=$restartStartup;stdoutLog=$restartStdout;stderrLog=$restartStderr})
    exit 1
  }
  $restartDeadline = (Get-Date).AddMinutes(5)
  while (!$proc2.HasExited -and (Get-Date) -lt $restartDeadline) { Start-Sleep -Seconds 2 }
  if (!$proc2.HasExited) {
    & taskkill.exe /PID $proc2.Id /T /F | Out-Null
    $proc2.WaitForExit(10000)
    Write-Result ([ordered]@{suite=$Suite;pass=$false;status="RESTART_VERIFY_TIMEOUT";error="Rest-pose restart verification exceeded 5 minutes";stdoutLog=$restartStdout;stderrLog=$restartStderr})
    exit 1
  }
  if (Test-Path $restartStdout) { Get-Content $restartStdout -Raw | Write-Host }
  if (Test-Path $restartStderr) { Get-Content $restartStderr -Raw | Write-Host }
  if (!(Test-Path $restartReport -PathType Leaf)) {
    Write-Result ([ordered]@{suite=$Suite;pass=$false;status="RESTART_NO_REPORT";error="Second packaged process exited without a rest-pose verification report";exitCode=$proc2.ExitCode;stdoutLog=$restartStdout;stderrLog=$restartStderr})
    exit 1
  }
  $rr = Get-Content $restartReport -Raw | ConvertFrom-Json
  Get-Content $restartReport -Raw | Write-Host
  $restartCheck = $rr.checks.PSObject.Properties["acceptance.rest-pose-process-restart"]
  if ($rr.pass -ne $true -or !$restartCheck -or $restartCheck.Value.pass -ne $true) {
    Write-Host "FAILED_RESTART_ACCEPTANCE=acceptance.rest-pose-process-restart"
    exit 1
  }
  Write-Host "REST_POSE_PROCESS_RESTART=PASS"
  Write-Host "CURRENT_PRODUCT_ACCEPTANCE=PASS"
} catch {
  Write-Result ([ordered]@{suite=$Suite;pass=$false;status="ERROR";error=$_.Exception.Message})
  exit 1
}
