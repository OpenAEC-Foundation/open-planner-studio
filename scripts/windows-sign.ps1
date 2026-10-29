# Authenticode met Azure Artifact Signing (voorheen Trusted Signing), voor de
# Windows-releasebuild (issue #429). Twee standen:
#
#   pwsh scripts/windows-sign.ps1 -Setup
#       Haalt de officiële Microsoft-signeerclient (NuGet Microsoft.ArtifactSigning.Client,
#       vaste versie, SHA512 gecontroleerd), zoekt signtool.exe en schrijft een
#       Tauri-config-override naar $env:RUNNER_TEMP/tauri.windows-sign.conf.json met
#       bundle.windows.signCommand. Zet OPS_SIGN_CONFIG in $env:GITHUB_ENV.
#       Alleen release.yml en windows-sign-check.yml roepen dit aan; ci.yml,
#       tauri:dev en lokale builds tekenen dus niet en hebben geen credentials nodig.
#
#   pwsh scripts/windows-sign.ps1 <bestand>
#       Tekent één bestand. Tauri roept dit via signCommand aan voor het programma,
#       de NSIS-uninstaller en de installer. Tijdstempel: RFC 3161, SHA256,
#       http://timestamp.acs.microsoft.com.
#
# Omgeving (GitHub-secrets): AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
# (EnvironmentCredential van de dlib), AZURE_ENDPOINT,
# AZURE_TRUSTED_SIGNING_ACCOUNT_NAME, AZURE_CERTIFICATE_PROFILE_NAME.
[CmdletBinding()]
param(
  [switch]$Setup,
  [Parameter(Position = 0)][string]$File
)
$ErrorActionPreference = 'Stop'

$ClientVersion = '1.0.146'
# SHA512 (base64) uit de NuGet-catalogus van microsoft.artifactsigning.client 1.0.146.
$ClientSha512 = '/G0hG/VDIS6psW23b5t1V/ORIgn0PVAOtGj9w+hkPmAuI4pempfwlW50E2GtHscnz9+5Qz3hbC4mcb7ej2Yn1A=='
$TimestampUrl = 'http://timestamp.acs.microsoft.com'

function Require-Env($name) {
  $v = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($v)) { throw "omgevingsvariabele $name ontbreekt" }
  return $v
}

if ($Setup) {
  $root = Join-Path (Require-Env 'RUNNER_TEMP') 'artifact-signing'
  New-Item -ItemType Directory -Force -Path $root | Out-Null

  $pkg = Join-Path $root "client.$ClientVersion.nupkg"
  Invoke-WebRequest -UseBasicParsing -OutFile $pkg `
    -Uri "https://api.nuget.org/v3-flatcontainer/microsoft.artifactsigning.client/$ClientVersion/microsoft.artifactsigning.client.$ClientVersion.nupkg"
  $sha = [Convert]::ToBase64String([Security.Cryptography.SHA512]::Create().ComputeHash([IO.File]::ReadAllBytes($pkg)))
  if ($sha -ne $ClientSha512) { throw "SHA512 van de signeerclient klopt niet: $sha" }
  $lib = Join-Path $root 'lib'
  Expand-Archive -Path $pkg -DestinationPath $lib -Force
  $dlib = Join-Path $lib 'bin/x64/Azure.CodeSigning.Dlib.dll'
  if (-not (Test-Path $dlib)) { throw "Azure.CodeSigning.Dlib.dll ontbreekt in het pakket" }

  $signtool = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe' |
    Where-Object { $_.Directory.Parent.Name -match '^\d+\.\d+\.\d+\.\d+$' } |
    Sort-Object { [version]($_.Directory.Parent.Name) } -Descending | Select-Object -First 1
  if ($null -eq $signtool) { throw "signtool.exe (x64) niet gevonden" }

  # Alleen EnvironmentCredential: geen stille terugval op een andere login.
  $metadata = [ordered]@{
    Endpoint               = Require-Env 'AZURE_ENDPOINT'
    CodeSigningAccountName = Require-Env 'AZURE_TRUSTED_SIGNING_ACCOUNT_NAME'
    CertificateProfileName = Require-Env 'AZURE_CERTIFICATE_PROFILE_NAME'
    ExcludeCredentials     = @(
      'ManagedIdentityCredential', 'WorkloadIdentityCredential', 'SharedTokenCacheCredential',
      'VisualStudioCredential', 'VisualStudioCodeCredential', 'AzureCliCredential',
      'AzurePowerShellCredential', 'AzureDeveloperCliCredential', 'InteractiveBrowserCredential')
  }
  $metadataPath = Join-Path $root 'metadata.json'
  $metadata | ConvertTo-Json | Set-Content -Path $metadataPath -Encoding utf8

  $self = (Resolve-Path $PSCommandPath).Path
  $config = @{
    bundle = @{
      windows = @{
        signCommand = @{
          cmd  = 'pwsh'
          args = @('-NoProfile', '-NonInteractive', '-File', $self, '%1')
        }
      }
    }
  }
  $configPath = Join-Path (Require-Env 'RUNNER_TEMP') 'tauri.windows-sign.conf.json'
  $config | ConvertTo-Json -Depth 6 | Set-Content -Path $configPath -Encoding utf8

  Add-Content -Path (Require-Env 'GITHUB_ENV') -Encoding utf8 -Value @(
    "OPS_SIGN_DLIB=$dlib",
    "OPS_SIGN_METADATA=$metadataPath",
    "OPS_SIGNTOOL=$($signtool.FullName)",
    "OPS_SIGN_CONFIG=$configPath")
  Write-Host "signeerclient ${ClientVersion}: $dlib"
  Write-Host "signtool: $($signtool.FullName)"
  Write-Host "Tauri-config-override: $configPath"
  Get-Content $configPath | Write-Host
  exit 0
}

if ([string]::IsNullOrWhiteSpace($File)) { throw "gebruik: windows-sign.ps1 -Setup | windows-sign.ps1 <bestand>" }
if (-not (Test-Path -LiteralPath $File)) { throw "bestand bestaat niet: $File" }
$signtoolPath = Require-Env 'OPS_SIGNTOOL'
$dlibPath = Require-Env 'OPS_SIGN_DLIB'
$metadataFile = Require-Env 'OPS_SIGN_METADATA'

# De tijdstempeldienst faalt af en toe kort; drie pogingen.
for ($attempt = 1; $attempt -le 3; $attempt++) {
  & $signtoolPath sign /v /fd SHA256 /tr $TimestampUrl /td SHA256 /dlib $dlibPath /dmdf $metadataFile $File
  if ($LASTEXITCODE -eq 0) {
    Write-Host "getekend: $File"
    exit 0
  }
  Write-Warning "signtool exit $LASTEXITCODE (poging $attempt van 3): $File"
  Start-Sleep -Seconds (5 * $attempt)
}
throw "tekenen mislukt na 3 pogingen: $File"
