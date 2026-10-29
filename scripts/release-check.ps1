# PowerShell-tegenhanger van scripts/release-check.sh voor de Windows-job van
# .github/workflows/release-verify.yml (issue #429). Dot-source dit bestand:
#   . scripts/release-check.ps1
# Record schrijft een regel in hetzelfde TSV-log dat `release-check.sh finish` leest.
# Test-Alive start een programma en registreert alleen OK als er echt een proces
# draait: een mislukte start (ook een niet-terminerende fout van Start-Process)
# is FOUT (review #438, ronde 2).

$script:ReleaseChecksLog = if ($env:RELEASE_CHECKS) { $env:RELEASE_CHECKS } else { Join-Path $env:RUNNER_TEMP 'release-checks.tsv' }

function Record([string]$Status, [string]$Name, [string]$Detail) {
  if ($Status -notin @('OK', 'FOUT', 'INFO')) { throw "onbekende status '$Status'" }
  $clean = { param($s) $t = ("$s" -replace "[`t`r`n|]", ' '); $t.Substring(0, [Math]::Min(240, $t.Length)) }
  Add-Content -Path $script:ReleaseChecksLog -Encoding utf8 -Value ("{0}`t{1}`t{2}" -f $Status, (& $clean $Name), (& $clean $Detail))
  Write-Host "[$Status] $Name — $Detail"
}

function Test-Alive([string]$Name, [string]$FilePath, [int]$Seconds = 20, [string[]]$ArgumentList = @()) {
  $proc = $null
  try {
    $params = @{ FilePath = $FilePath; PassThru = $true; ErrorAction = 'Stop' }
    if ($ArgumentList.Count -gt 0) { $params.ArgumentList = $ArgumentList }
    $proc = Start-Process @params
  } catch {
    Record 'FOUT' $Name "start mislukt: $($_.Exception.Message)"
    return
  }
  if ($null -eq $proc -or -not $proc.Id) {
    Record 'FOUT' $Name 'start gaf geen procesobject'
    return
  }
  Start-Sleep -Seconds $Seconds
  $proc.Refresh()
  if ($proc.HasExited) {
    Record 'FOUT' $Name "gestopt binnen $Seconds s met exit $($proc.ExitCode)"
    return
  }
  Record 'OK' $Name "pid $($proc.Id) leeft na $Seconds s"
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
