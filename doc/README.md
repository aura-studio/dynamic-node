# dynamic-node

`dynamic-node` is the Node.js counterpart of Go `dynamic`.

It loads versioned packages from a local/S3 warehouse and resolves them to a
Tunnel-like object. The public runtime shape is intentionally close to Go:

- `useWarehouse(local, remote)`
- `useNamespace(namespace)`
- `useDefaultVersion(version)`
- `registerPackage(pkg, version, tunnel)`
- `getPackage(pkg, version)`
- `closePackage(pkg, version)`

See [API reference](./api.md) for details.

## Package Contract

Warehouse packages should export one of these symbols:

```js
exports.Tunnel = service.new(app);
```

or:

```js
exports.New = () => wire.new(app);
```

The returned object must implement the Tunnel methods:

```js
{
  init() {},
  invoke(route, request) {},
  meta() {},
  close() {}
}
```

Upper-case Go-style method names (`Init`, `Invoke`, `Meta`, `Close`) are also
accepted.

## Warehouse Layout

`dynamic-node-cli` builds packages into:

```text
<warehouse>/<os>_<arch>_<compiler>_<variant>/<namespace>_<package>_<version>/libnode_<name>.zip
```

For the `bundle` variant, the extracted package must contain `bundle.js`.
For non-bundle variants, Node resolves the extracted directory with normal
`index.js` / `package.json#main` rules.

## Notes

Node cannot replicate Go `plugin.Open` exactly. The Node implementation uses
`require()` for CommonJS packages and clears the top-level require cache entry
before each local load. This is not a full unload of nested dependencies.

S3 integration tests are real remote tests and are disabled by default. Enable
them with:

```sh
DYNAMIC_NODE_RUN_S3_TESTS=1 npm test
```
