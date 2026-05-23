. "$PSScriptRoot\common.ps1"

& "$PSScriptRoot\00-clean.ps1"
& "$PSScriptRoot\01-smoke.ps1"
& "$PSScriptRoot\02-static-register.ps1"
& "$PSScriptRoot\03-local-bundle.ps1"
& "$PSScriptRoot\04-local-full.ps1"
& "$PSScriptRoot\05-namespace-default-version.ps1"
& "$PSScriptRoot\06-validation-errors.ps1"
& "$PSScriptRoot\07-tunnel-symbols.ps1"

Write-Output "all local dynamic-node example checks passed"
