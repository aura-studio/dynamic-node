# dynamic-node examples

These examples are manual verification scripts for `@aura-studio/dynamic-node`.
They mirror the step-by-step style used by `dynamic-node-cli/examples`.

Run one step at a time on PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File examples/scripts/01-smoke.ps1
powershell -ExecutionPolicy Bypass -File examples/scripts/02-static-register.ps1
powershell -ExecutionPolicy Bypass -File examples/scripts/03-local-bundle.ps1
```

Run one step at a time on bash:

```sh
bash examples/scripts/01-smoke.sh
bash examples/scripts/02-static-register.sh
bash examples/scripts/03-local-bundle.sh
```

Run all local checks:

```powershell
powershell -ExecutionPolicy Bypass -File examples/scripts/99-run-all-local.ps1
```

```sh
bash examples/scripts/99-run-all-local.sh
```

Run the optional S3 check after preparing a remote package that exports
`Tunnel` or `New`:

```sh
DYNAMIC_NODE_EXAMPLE_REMOTE=s3://your-bucket \
DYNAMIC_NODE_EXAMPLE_REMOTE_NAMESPACE=demo \
DYNAMIC_NODE_EXAMPLE_REMOTE_PACKAGE=remote \
DYNAMIC_NODE_EXAMPLE_REMOTE_VERSION=v1 \
bash examples/scripts/08-remote-s3.sh
```

PowerShell:

```powershell
$env:DYNAMIC_NODE_EXAMPLE_REMOTE = "s3://your-bucket"
$env:DYNAMIC_NODE_EXAMPLE_REMOTE_NAMESPACE = "demo"
$env:DYNAMIC_NODE_EXAMPLE_REMOTE_PACKAGE = "remote"
$env:DYNAMIC_NODE_EXAMPLE_REMOTE_VERSION = "v1"
powershell -ExecutionPolicy Bypass -File examples/scripts/08-remote-s3.ps1
```

## Script Index

| Script | Purpose |
|---|---|
| `00-clean.sh` / `00-clean.ps1` | Remove generated example files. |
| `01-smoke.sh` / `01-smoke.ps1` | Check public exports, toolchain overrides, and Template behavior. |
| `02-static-register.sh` / `02-static-register.ps1` | Verify `registerPackage`, `getPackage`, `invoke`, `meta`, and `closePackage`. |
| `03-local-bundle.sh` / `03-local-bundle.ps1` | Verify local warehouse loading for `bundle` variant with `exports.Tunnel`. |
| `04-local-full.sh` / `04-local-full.ps1` | Verify local warehouse loading for `full` variant with `exports.New`. |
| `05-namespace-default-version.sh` / `05-namespace-default-version.ps1` | Verify namespace isolation and default-version fallback. |
| `06-validation-errors.sh` / `06-validation-errors.ps1` | Verify validation errors for invalid warehouse, namespace, package, and version values. |
| `07-tunnel-symbols.sh` / `07-tunnel-symbols.ps1` | Verify `Tunnel`, `New`, and upper-case Go-style Tunnel methods. |
| `08-remote-s3.sh` / `08-remote-s3.ps1` | Optional real S3 sync/load check. |
| `99-run-all-local.sh` / `99-run-all-local.ps1` | Run all local scripts. |
| `99-run-all-with-s3.sh` / `99-run-all-with-s3.ps1` | Run local scripts and the optional S3 script. |

## Generated Files

Examples write generated warehouse packages under:

```text
examples/.tmp/warehouse
```

Override it with:

```sh
DYNAMIC_NODE_EXAMPLE_WAREHOUSE=/tmp/dynamic-node-example bash examples/scripts/03-local-bundle.sh
```

## Package Contract

Every dynamically loaded package must export one of:

```js
exports.Tunnel = {
  init() {},
  async invoke(route, request) {},
  meta() { return ""; },
  close() {},
};
```

or:

```js
exports.New = () => ({
  init() {},
  async invoke(route, request) {},
  meta() { return ""; },
  close() {},
});
```

Upper-case Go-style methods (`Init`, `Invoke`, `Meta`, `Close`) are also
accepted.
