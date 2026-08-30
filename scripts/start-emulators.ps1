$projectRoot = Split-Path -Parent $PSScriptRoot
$java = Get-ChildItem -Path (Join-Path $projectRoot '.tools\temurin-jre') -Filter 'java.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $java) {
  throw 'Java portátil não encontrado em .tools\\temurin-jre. Execute a preparação do ambiente local novamente.'
}

$env:Path = (Split-Path -Parent $java.FullName) + ';' + $env:Path
& (Join-Path $projectRoot 'node_modules\.bin\firebase.cmd') emulators:start --project bud-finance-local --only auth,firestore
