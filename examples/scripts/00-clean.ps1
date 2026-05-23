. "$PSScriptRoot\common.ps1"

Remove-Item -LiteralPath (Join-Path $ExamplesDir ".tmp") -Recurse -Force -ErrorAction SilentlyContinue

Write-Output "cleaned dynamic-node example artifacts"
