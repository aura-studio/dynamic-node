# dynamic-node examples

These examples verify that `@aura-studio/dynamic-node` can load artifacts built
by `dynamic-node-cli`. The scripts are JavaScript entrypoints so the same
commands work on Windows, macOS, and Linux.

The target projects are:

- `sample-app`: exports a direct Tunnel.
- `service-app`: calls `service.new(app)` and exports that Tunnel.
- `wire-app`: uses the same `app` with both `http.createServer(app)` and `wire.new(app)`.

The build matrix is:

```text
sample-app  x bundle -> bundle
sample-app  x full   -> full
service-app x bundle -> service-bundle
service-app x full   -> service-full
wire-app    x bundle -> wire-bundle
wire-app    x full   -> wire-full
```

`dynamic-node-cli` builds the zip artifacts. `dynamic-node` then loads them from
the local warehouse or from S3.

The service and wire steps start temporary `http.createServer(...)` instances
and print the response bodies for all four wrapper modes:

```text
HTTP service-bundle response: ...
HTTP service-full response: ...
HTTP wire-bundle response: ...
HTTP wire-full response: ...
```

## Quick Local Run

From the repository root:

```bash
npm run test:examples
```

Manual steps:

```bash
node examples/scripts/00-clean.js
node examples/scripts/01-smoke.js
node examples/scripts/02-build-all.js
node examples/scripts/03-local.js
node examples/scripts/04-service.js
node examples/scripts/05-wire.js
node examples/scripts/06-default-version.js
node examples/scripts/07-validation-errors.js
```

## S3-Compatible Docker Run

The S3 flow can run without a real AWS bucket by starting MinIO:

```bash
npm run test:examples:s3:docker
```

The script starts `minio/minio:latest`, creates a bucket, asks
`dynamic-node-cli` to push artifacts, removes the local warehouse, then verifies
that `dynamic-node` downloads, extracts, and loads all six artifacts.

Useful overrides:

```bash
set DYNAMIC_NODE_TEST_ID=manual
set DYNAMIC_NODE_TEST_S3_IMAGE=minio/minio:latest
set DYNAMIC_NODE_TEST_KEEP_DOCKER=1
```

On bash shells use `export` instead of `set`.

## Real S3 Run

```bash
export AWS_PROFILE=aws-3
export AWS_REGION=us-west-1
export DYNAMIC_NODE_TEST_ID="$(date -u +%Y%m%dT%H%M%SZ)"
export DYNAMIC_NODE_TEST_REMOTE="s3://your-bucket/dynamic-node-test/${DYNAMIC_NODE_TEST_ID}"
npm run test:examples:s3
```

The S3 script removes the remote prefix at the end unless
`DYNAMIC_NODE_TEST_KEEP_REMOTE=1` is set.

## Web Runner

```bash
npm run examples:web
```

Open the printed `http://127.0.0.1:<port>` URL and run the steps from the page.

## Paths

Defaults:

```text
DYNAMIC_NODE_CLI_ROOT=../dynamic-node-cli
DYNAMIC_NODE_TEST_WAREHOUSE=examples/warehouse
DYNAMIC_NODE_TEST_CONFIG=examples/dynamic-node-cli.yaml
DYNAMIC_NODE_TEST_ID=manual
DYNAMIC_NODE_TEST_REMOTE=s3://dynamic-node-test/manual
```

Generated files are ignored by git:

```text
examples/dynamic-node-cli.yaml
examples/warehouse/
examples/.npm-cache/
examples/*/node_modules/
examples/*/package-lock.json
```
