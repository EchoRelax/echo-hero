$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
Push-Location $project
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
    $buildTime = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(4))
    $name = 'EchoHunt-Playtest-' + $buildTime.ToString('yyyy-MM-dd-HHmmss')
    $package = Join-Path $project "releases/$name"
    New-Item -ItemType Directory -Path "$package/game" -Force | Out-Null
    Copy-Item -Path 'dist/*' -Destination "$package/game" -Recurse
    Copy-Item -Path 'tools/playtest/*' -Destination $package
    $buildVersion = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
    @(
        "Build: $name"
        "Game version: $buildVersion"
        "Built (UTC+04:00): $($buildTime.ToString('yyyy-MM-dd HH:mm:ss zzz'))"
        'Platform: Windows 10/11, local browser build'
        'Start: extract the archive, then run Play.cmd'
    ) | Set-Content -LiteralPath (Join-Path $package 'BUILD.txt') -Encoding UTF8
    $archive = "$package.zip"
    Compress-Archive -LiteralPath $package -DestinationPath $archive -CompressionLevel Optimal
    Get-Item -LiteralPath $archive | Select-Object FullName, Length
} finally {
    Pop-Location
}
