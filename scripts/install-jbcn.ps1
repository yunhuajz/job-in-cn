$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$commandDirectory = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'npm'
$commandPath = Join-Path $commandDirectory 'JBCN.cmd'
$launcherPath = Join-Path $projectDirectory 'scripts\jbcn.cjs'
if (-not (Test-Path -LiteralPath $launcherPath)) { throw 'JBCN launcher is missing.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22 or newer is required.' }
$shim = "@echo off`r`nnode `"$launcherPath`" %*`r`n"
if (Test-Path -LiteralPath $commandPath) {
    $existing = Get-Content -LiteralPath $commandPath -Raw
    if ($existing -ne $shim) { throw "A different JBCN command already exists: $commandPath" }
}
New-Item -ItemType Directory -Path $commandDirectory -Force | Out-Null
Set-Content -LiteralPath $commandPath -Value $shim -Encoding ascii -NoNewline
$userSearchPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$machineSearchPath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
if (($userSearchPath -split ';') -notcontains $commandDirectory -and ($machineSearchPath -split ';') -notcontains $commandDirectory) {
    [Environment]::SetEnvironmentVariable('Path', ($userSearchPath.TrimEnd(';') + ';' + $commandDirectory), 'User')
}
Write-Output "Installed JBCN: $commandPath"
