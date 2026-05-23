$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExamplesDir = Split-Path -Parent $ScriptDir
$RepoRoot = Split-Path -Parent $ExamplesDir

if (-not $env:DYNAMIC_NODE_EXAMPLE_WAREHOUSE) {
  $env:DYNAMIC_NODE_EXAMPLE_WAREHOUSE = Join-Path $ExamplesDir ".tmp\warehouse"
}

function Ensure-Dependencies {
  $nodeModules = Join-Path $RepoRoot "node_modules"
  if (-not (Test-Path $nodeModules)) {
    Push-Location $RepoRoot
    try {
      npm.cmd install
    } finally {
      Pop-Location
    }
  }
}

function Invoke-NodeCase {
  param([Parameter(Mandatory = $true)][string]$Name)
  node (Join-Path $ExamplesDir "cases\$Name")
  if ($LASTEXITCODE -ne 0) {
    throw "dynamic-node example case failed: $Name"
  }
}

function Write-ExampleContext {
  Write-Output "REPO_ROOT=$RepoRoot"
  Write-Output "EXAMPLES_DIR=$ExamplesDir"
  Write-Output "DYNAMIC_NODE_EXAMPLE_WAREHOUSE=$env:DYNAMIC_NODE_EXAMPLE_WAREHOUSE"
}
