# dynamic-node API

## Import

```js
const dynamic = require("@aura-studio/dynamic-node");
```

## Public API

### `useWarehouse(local, remote)`

Configures the local warehouse and optional remote warehouse.

```js
dynamic.useWarehouse("/opt/warehouse", "s3://my-bucket");
dynamic.useWarehouse("/opt/warehouse", "s3://my-bucket/prefix");
```

Rules follow Go `dynamic`:

- `useWarehouse("", "")`: no-op.
- `useWarehouse(local, "")`: local-only warehouse.
- `useWarehouse(local, remote)`: local warehouse with remote sync.
- `useWarehouse("", remote)`: invalid.

S3-compatible endpoints are supported through `AWS_ENDPOINT_URL`,
`AWS_ENDPOINT_URL_S3`, or `DYNAMIC_NODE_S3_ENDPOINT`. Set
`AWS_S3_FORCE_PATH_STYLE=1` or `DYNAMIC_NODE_S3_FORCE_PATH_STYLE=1` when the
endpoint requires path-style addressing.

### `useNamespace(namespace)`

Sets the current package namespace. The namespace must match:

```text
^[a-z0-9][a-z0-9-]*$
```

### `useDefaultVersion(version)`

Sets the fallback version used when the requested version is missing.

### `registerPackage(pkg, version, tunnel)`

Registers a static Tunnel instance without using the warehouse.

```js
dynamic.registerPackage("greeter", "v1", {
  init() {},
  async invoke(route, request) {
    return "hello";
  },
  meta() {
    return JSON.stringify({ name: "greeter" });
  },
  close() {},
});
```

### `getPackage(pkg, version)`

Returns a Tunnel instance. Resolution order mirrors Go `dynamic`:

1. PackageCenter cache for requested version.
2. TunnelCenter / Warehouse load for requested version.
3. PackageCenter cache for default version.
4. TunnelCenter / Warehouse load for default version.
5. Throw if neither version exists.

`getTunnel(pkg, version)` is an alias.

### `closePackage(pkg, version)`

Closes the cached Tunnel and removes the PackageCenter entry.

## Warehouse Package Exports

The Go loader looks for plugin symbols named `Tunnel` or `New`. The Node loader
uses the same convention:

```js
exports.Tunnel = service.new(app);
```

or:

```js
exports.New = () => wire.new(app);
```

The exported value must implement either lower-case methods:

```js
init();
invoke(route, request);
meta();
close();
```

or Go-style upper-case methods:

```js
Init();
Invoke(route, request);
Meta();
Close();
```

## Additional Exports

- `Template`, `Tunnel`, `TunnelNode`
- `isTunnelNode(value)`
- `assertTunnelNode(value)`
- `callTunnelInit(tunnel)`
- `callTunnelInvoke(tunnel, route, request)`
- `callTunnelMeta(tunnel)`
- `callTunnelClose(tunnel)`
- `TunnelCenter`, `tunnelCenter`
- `PackageCenter`, `packageCenter`
- `Dynamic`, `DynamicIndex`
- `NAMESPACE_DEFAULT`, `VERSION_DEFAULT`, `VERSION_LATEST`
- `toolchain`
- `allowed`, `AllowedType`
- `PackageNotExistError`, `isPackageNotExist(err)`

## Differences From Go

Node cannot exactly replicate Go `plugin.Open` and symbol lookup. The Node
version uses CommonJS `require()` and resolves `exports.Tunnel` / `exports.New`.

Node also cannot fully unload a module graph. `dynamic-node` clears the top-level
entry from `require.cache` before local loads, but dependencies required by the
package may remain cached by Node.

Examples include a Docker MinIO S3-compatible flow:

```sh
npm run test:examples:s3:docker
```
