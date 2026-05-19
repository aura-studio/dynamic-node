# dynamic-node — Requirements Specification

## 1. Project Overview

`dynamic-node` is a TypeScript runtime library for dynamically loading plugin packages
in Node.js. It downloads packages from S3, caches them locally, and loads them via `require()`.

Loaded packages are raw JS modules — there is no Tunnel abstraction. Each module
independently exports whatever it needs and the host framework decides how to use it.

**Core purpose**: Load plugin packages (bundled JS files) from local disk or S3 remote
warehouse, supporting multiple independently loaded packages that coexist without conflict.

## 2. Functional Requirements

### 2.1 Warehouse Management

- R1.1 Support configuring local warehouse path (`local`) and remote S3 warehouse URL (`remote`)
- R1.2 Auto-sync from S3 when local warehouse is empty
- R1.3 Skip remote sync when local file exists
- R1.4 Treat zero-byte local files as invalid, re-download from remote
- R1.5 Use atomic write (tmp file + rename) for S3 downloads

### 2.2 Remote Download

- R2.1 Support `s3://` protocol for remote warehouse URL
- R2.2 S3 Key construction: `<os>_<arch>_<compiler>_<variant>/<namespace>_<package>_<version>/libnode_<namespace>_<package>_<version>.zip`
- R2.3 Auto-extract zip to local warehouse directory after download
- R2.4 Retain original zip file after extraction

### 2.3 Local Warehouse

- R3.1 Check whether a package exists locally (extracted entry files)
- R3.2 Bundle variant: check `<local>/<toolchain>/<name>/bundle.js`
- R3.3 Full variant: check `<local>/<toolchain>/<name>/index.js` or `package.json`
- R3.4 Load local module via `require()`, return raw `module.exports`
- R3.5 Clear `require.cache` before loading to ensure fresh module

### 2.4 Package Center

- R4.1 Support namespace management: `useNamespace()`
- R4.2 Support default version fallback: `useDefaultVersion()`
- R4.3 Two-level cache: memory Map -> Warehouse (local/remote)
- R4.4 Version resolution: exact version first -> default version fallback -> error
- R4.5 Support static package registration (bypass warehouse)
- R4.6 Support multiple packages loaded simultaneously without conflict
- R4.7 Later registration of same pkg+version overwrites earlier one

### 2.5 Module Loading

- R5.1 Loaded modules are raw `module.exports` — no interface constraint
- R5.2 Each module independently registers with the host framework
- R5.3 Multiple modules coexist without interfering with each other

### 2.6 Environment Detection (Toolchain)

- R6.1 Auto-detect OS, arch, compiler (Node.js version)
- R6.2 Support override via env vars: `DYNAMIC_OS`, `DYNAMIC_ARCH`, `DYNAMIC_COMPILER`, `DYNAMIC_VARIANT`
- R6.3 Assemble toolchain string: `<os>_<arch>_<compiler>_<variant>`
- R6.4 Default variant: `"bundle"`

### 2.7 Input Validation

- R7.1 Validate keyword (namespace/package/version): lowercase alphanumeric + hyphen
- R7.2 Validate local path: valid filesystem path
- R7.3 Validate remote URL: valid URL format

## 3. Non-Functional Requirements

- N1. All dependencies from npm public registry
- N2. TypeScript with `.d.ts` type definitions
- N3. Support Node.js 18, 20, 22 LTS
- N4. Async I/O using `Promise` style
- N5. Module-level singletons for global state

## 4. Scope

### Included

- Warehouse management (local + S3 remote)
- Package download + extraction + module loading
- Namespace + version management
- Runtime toolchain detection
- Programmatic API

### Excluded

- YAML configuration parsing (belongs to host framework)
- CLI commands (belongs to `dynamic-node-cli`)
- Build/packaging (belongs to `dynamic-node-cli`)
- HTTP/SQS/Event trigger handling (belongs to host framework)
- Route registration/dispatch logic (each module handles its own)
