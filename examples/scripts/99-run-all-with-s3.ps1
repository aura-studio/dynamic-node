. "$PSScriptRoot\common.ps1"

& "$PSScriptRoot\99-run-all-local.ps1"
& "$PSScriptRoot\08-remote-s3.ps1"

Write-Output "all dynamic-node example checks passed"
