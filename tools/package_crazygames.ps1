$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
Push-Location $project
try {
    & npm.cmd run build:crazygames
    if ($LASTEXITCODE -ne 0) { throw 'CrazyGames build failed' }
    $buildTime = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(4))
    $name = 'EchoHunt-CrazyGames-' + $buildTime.ToString('yyyy-MM-dd-HHmmss')
    New-Item -ItemType Directory -Path 'releases' -Force | Out-Null
    $archive = Join-Path $project "releases/$name.zip"
    # CrazyGames expects index.html directly at the archive root, without the Windows launcher.
    Compress-Archive -Path 'dist-crazygames/*' -DestinationPath $archive -CompressionLevel Optimal
    Get-Item -LiteralPath $archive | Select-Object FullName, Length
} finally {
    Pop-Location
}
