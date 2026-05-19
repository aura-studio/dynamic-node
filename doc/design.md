# dynamic-node — Design Document

## 1. Design Goals

Provide a TypeScript library for dynamically loading plugin packages at runtime in Node.js.
Packages are loaded as raw JS modules — no Tunnel abstraction. Each package independently
exports whatever it needs (handlers, routes, classes, etc.) and registers with the host
framework on its own.

Key changes from the previous design:
- **No Tunnel interface** — loaded modules are plain `module.exports`, the caller decides how to use them
- **Multi-package coexistence** — multiple packages can be loaded simultaneously without conflict
- **Later load wins** — if the same pkg+version is loaded again, the new module overwrites the old one

## 2. Project Structure

```
dynamic-node/
├── package.json
├── tsconfig.json
├── .gitignore
├── .npmignore
├── src/
│   ├── index.ts               # Main entry, exports public API
│   ├── api.ts                  # Top-level functions: useWarehouse / getPackage / ...
│   ├── warehouse.ts            # Warehouse: orchestrates Local + Remote
│   ├── local.ts                # Local warehouse: check, extract, require() load
│   ├── remote.ts               # S3 remote download + atomic write
│   ├── package-center.ts       # PackageCenter: namespace + version management + memory cache
│   ├── toolchain.ts            # Toolchain singleton: os_arch_compiler_variant assembly
│   └── allowed.ts              # Input validation: isKeyword / isPath / isURL
├── tests/
│   ├── api.test.ts
│   ├── warehouse.test.ts
│   ├── local.test.ts
│   ├── remote.test.ts
│   ├── toolchain.test.ts
│   ├── package-center.test.ts
│   └── allowed.test.ts
├── doc/
│   ├── requirements.md
│   └── design.md
└── examples/
    ├── basic/
    └── lambda-node/
```

## 3. Module Responsibilities

| Node Module | Responsibility |
|---|---|
| `api.ts` | Public API: `useWarehouse` / `getPackage` / `closePackage` / `registerPackage` |
| `package-center.ts` | `PackageCenter` singleton: namespace, default version, memory cache |
| `warehouse.ts` | `Warehouse`: local-first strategy, remote fallback |
| `local.ts` | Local file existence check, zip extraction, `require()` module load |
| `remote.ts` | `Remote` interface + `S3Remote` implementation (download, atomic write) |
| `toolchain.ts` | OS/Arch/Compiler/Variant detection, toolchain string assembly |
| `allowed.ts` | Input validation: keyword, path, URL |

## 4. Core Architecture

### 4.1 Two-Level Cache Model

```
getPackage(pkg, version)
  │
  ├─ Level 1: PackageCenter.packages (Map<key, module>)
  │   In-memory cache, return immediately on hit
  │
  └─ Level 2: Warehouse.load(name)
       │
       ├─ Local.exists(name) → check local directory
       │   ├─ bundle variant: check bundle.js
       │   └─ full variant:   check index.js / package.json
       │
       ├─ Local.load(name)
       │   ├─ require() loads the module
       │   └─ Returns raw module.exports (any)
       │
       └─ Remote.sync(name) [when Local.exists returns false]
           ├─ S3 GetObject downloads libnode_<name>.zip
           ├─ Atomic write (tmp + rename)
           └─ adm-zip extracts to local directory
               → back to Local.exists / Local.load
```

### 4.2 Multi-Package Loading

Multiple packages can be loaded simultaneously. Each is identified by a
composite key: `(namespace, pkg, version)`.

- Packages are independently cached and retrieved
- Closing one package does not affect others
- If the same key is registered/loaded again, the new module overwrites the old one
- Each loaded module is responsible for its own registration with the host framework

### 4.3 Toolchain Detection

**Priority** (same as before):
1. Programmatic setter (setOS / setArch / setCompiler / setVariant)
2. Environment variables (DYNAMIC_OS / DYNAMIC_ARCH / DYNAMIC_COMPILER / DYNAMIC_VARIANT)
3. Runtime auto-detection

**Toolchain string format**:
```
<os>_<arch>_<compiler>_<variant>
e.g.: ubuntu24.04_amd64_node22.11.0_bundle
```

### 4.4 S3 Path Construction

```
S3 Key = <toolchain>/<name>/libnode_<name>.zip

Where:
  toolchain = os_arch_compiler_variant
  name      = namespace_package_version

Full example:
  ubuntu24.04_amd64_node22.11.0_bundle/scp_myapp_v1/libnode_scp_myapp_v1.zip
```

### 4.5 Module Loading Mechanism

**bundle variant**:
```
<local>/<toolchain>/<name>/
  ├── bundle.js                  ← require() entry point
  └── libnode_<name>.zip         ← original zip (retained)
```

**full variant**:
```
<local>/<toolchain>/<name>/
  ├── package.json               ← require() resolves entry
  ├── index.js
  ├── node_modules/
  │   └── ...
  └── libnode_<name>.zip         ← original zip
```

```typescript
// local.ts — load method
async load(name: string): Promise<any> {
  const dir = path.join(this.localPath, toolchain.toString(), name);
  const entryFile = toolchain.variant === "bundle"
    ? path.join(dir, "bundle.js")
    : dir; // Node resolves package.json#main automatically

  // Clear require cache
  delete require.cache[require.resolve(entryFile)];
  const mod = require(entryFile);

  // Return raw module.exports — no Tunnel constraint
  return mod;
}
```

### 4.6 Singleton Pattern

Module-level singleton variables:

```typescript
// toolchain.ts
export const toolchain = new Toolchain();

// warehouse.ts
export const warehouse = new Warehouse();

// package-center.ts
export const packageCenter = new PackageCenter();
```

### 4.7 Error Handling

- S3 object not found: throws `TunnelNotExistError`
- Input validation failure: throws `Error` with description
- Module load failure: throws original `Error`
- Network/file I/O errors: thrown as-is

## 5. Public API

```typescript
// === Warehouse Configuration ===
useWarehouse(local: string, remote: string): void;

// === Package Configuration ===
useNamespace(namespace: string): void;
useDefaultVersion(version: string): void;

// === Package Management ===
registerPackage(pkg: string, version: string, mod: any): Promise<void>;
getPackage(pkg: string, version: string): Promise<any>;
closePackage(pkg: string, version: string): Promise<void>;
```

## 6. Dependencies

| npm Package | Version | Usage |
|---|---|---|
| `@aws-sdk/client-s3` | `^3.x` | S3 file download |
| `adm-zip` | `^0.5.x` | Zip extraction |
| `typescript` | `^5.x` | Compilation (dev) |
| `@types/node` | `^20.x` | Node types (dev) |
| `@types/adm-zip` | `^0.5.x` | adm-zip types (dev) |
| `vitest` | `^1.x` | Testing (dev) |

## 7. Usage Pattern

Each dynamically loaded module is a self-contained JS file that exports
whatever the host framework needs:

```javascript
// bundle.js — example of a dynamically loaded module
exports.name = "my-service";
exports.VERSION = "1.0.0";

exports.routes = {
  "/api/hello": async (req) => {
    return JSON.stringify({ message: "Hello!" });
  },
  "/api/status": async () => {
    return JSON.stringify({ status: "ok" });
  },
};

// Self-registration function
exports.register = (registry) => {
  for (const [route, handler] of Object.entries(exports.routes)) {
    registry.set(route, handler);
  }
};
```

The host framework loads and wires packages:

```javascript
const { useWarehouse, useNamespace, getPackage } = require("@aura-studio/dynamic-node");

useWarehouse("/opt/warehouse", "s3://my-bucket");
useNamespace("myorg");

// Load multiple packages — each independently registers its handlers
const routeRegistry = new Map();

const modA = await getPackage("service-a", "v1");
modA.register(routeRegistry);

const modB = await getPackage("service-b", "v1");
modB.register(routeRegistry);

// Dispatch requests through the registry
const handler = routeRegistry.get("/api/hello");
const response = await handler(requestBody);
```

## 8. lambda-node.yaml Reference

```yaml
dynamic:
  environment:
    toolchain:
      os: ubuntu24.04
      arch: amd64
      compiler: node22.11.0
      variant: bundle
    warehouse:
      local: /opt/warehouse
      remote: s3://mirroring-lambda
  package:
    namespace: scp
    defaultVersion: default
    preload:
      - package: myapp
        version: v1
```
