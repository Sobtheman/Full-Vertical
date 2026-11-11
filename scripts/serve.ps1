# Tiny local preview server. Uses only what Windows already has (no Node needed).
# Serves the project folder, falling back to public/ (same layout Vite uses).
param([int]$Port = 5173)

$root = Split-Path -Parent $PSScriptRoot
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'
  '.webp' = 'image/webp'; '.jpg' = 'image/jpeg'; '.woff2' = 'font/woff2'; '.ico' = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Full Vertical preview: http://localhost:$Port"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $file = $null
    foreach ($base in $root, (Join-Path $root 'public')) {
      $candidate = [IO.Path]::GetFullPath((Join-Path $base $rel))
      # Never serve anything outside the project folder.
      if ($candidate.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { $file = $candidate; break }
    }
    if ($file) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $ctx.Response.Headers['Cache-Control'] = 'no-store'
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
  } catch {
    $ctx.Response.StatusCode = 500
  } finally {
    $ctx.Response.Close()
  }
}
