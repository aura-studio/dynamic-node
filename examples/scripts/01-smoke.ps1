. "$PSScriptRoot\common.ps1"

Ensure-Dependencies
Invoke-NodeCase "01-smoke.js"
