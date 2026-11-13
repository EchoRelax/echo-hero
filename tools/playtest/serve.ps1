$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'game'))
$port = 8787
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
$mime = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'; '.svg' = 'image/svg+xml'
    '.glb' = 'model/gltf-binary'; '.wav' = 'audio/wav'; '.png' = 'image/png'
    '.json' = 'application/json'; '.ico' = 'image/x-icon'
    '.woff2' = 'font/woff2'; '.txt' = 'text/plain; charset=utf-8'
}
try {
    $listener.Start()
    Write-Host "Echo Hunt: http://127.0.0.1:$port"
    Write-Host 'Keep this window open while playing. Close it to stop the game server.'
    Start-Process "http://127.0.0.1:$port"
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $client.ReceiveTimeout = 5000
            $client.SendTimeout = 15000
            $stream = $client.GetStream()
            $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
            $line = $reader.ReadLine()
            if (-not $line) { continue }
            $parts = $line.Split(' ')
            while ($reader.ReadLine()) {}
            $status = '200 OK'
            $type = 'text/plain; charset=utf-8'
            $body = [byte[]]@()
            if ($parts[0] -notin @('GET', 'HEAD')) {
                $status = '405 Method Not Allowed'
            } else {
                $urlPath = [Uri]::UnescapeDataString(($parts[1] -split '\?', 2)[0]).TrimStart('/')
                if (-not $urlPath) { $urlPath = 'index.html' }
                $file = [IO.Path]::GetFullPath((Join-Path $root $urlPath))
                if (-not $file.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
                    $status = '403 Forbidden'
                } elseif (-not [IO.File]::Exists($file)) {
                    $status = '404 Not Found'
                } else {
                    $body = [IO.File]::ReadAllBytes($file)
                    $type = $mime[[IO.Path]::GetExtension($file).ToLowerInvariant()]
                    if (-not $type) { $type = 'application/octet-stream' }
                }
            }
            $header = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n")
            $stream.Write($header, 0, $header.Length)
            if ($parts[0] -ne 'HEAD' -and $body.Length) { $stream.Write($body, 0, $body.Length) }
        } catch {
            Write-Host "Request ended: $($_.Exception.Message)"
        } finally {
            $client.Dispose()
        }
    }
} finally {
    $listener.Stop()
}
