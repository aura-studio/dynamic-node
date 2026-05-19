# dynamic-node — 设计文档

## 1. 设计目标

完整对标 `github.com/aura-studio/dynamic`（Go 库）的架构，以 TypeScript 实现 Node.js 运行时环境下的动态插件加载能力。

## 2. 项目结构

```
dynamic-node/
├── package.json
├── tsconfig.json
├── .gitignore
├── .npmignore
├── src/
│   ├── index.ts               # 主入口，导出公共 API
│   ├── api.ts                  # 顶层函数：useWarehouse / getPackage / ...
│   ├── warehouse.ts            # Warehouse：编排 Local + Remote
│   ├── local.ts                # 本地仓库：检查、解压、require() 加载
│   ├── remote.ts               # S3 远程下载 + 原子写入
│   ├── package-center.ts       # DynamicCenter：命名空间 + 版本管理 + 内存缓存
│   ├── tunnel-center.ts        # TunnelCenter：已加载 Tunnel 注册表 + 懒加载
│   ├── tunnel.ts               # Tunnel 接口 + Template 默认实现
│   ├── toolchain.ts            # Toolchain 单例：os_arch_compiler_variant 拼装
│   └── allowed.ts              # 输入校验：isKeyword / isPath / isURL
├── test/
│   ├── api.test.ts
│   ├── warehouse.test.ts
│   ├── local.test.ts
│   ├── remote.test.ts
│   ├── toolchain.test.ts
│   └── package-center.test.ts
├── doc/
│   ├── requirements.md
│   └── design.md
└── README.md
```

## 3. 模块与对标关系

| Node 模块 | Go 对标文件 | 职责 |
|---|---|---|
| `tunnel.ts` | `tunnel.go` | `Tunnel` 接口 + `Template` + `TunnelCenter`（单例，管理已加载隧道） |
| `toolchain.ts` | `toolchain.go` + `env.go` | OS/Arch/Compiler/Variant 检测，拼装 toolchain 字符串 |
| `allowed.ts` | `allowed.go` | 输入校验：keyword（namespace/package/version）、path、URL |
| `local.ts` | `local.go` | 本地文件存在性检查、zip 解压、`require()` 加载模块 |
| `remote.ts` | `remote.go` | `Remote` 接口 + `S3Remote` 实现（下载、原子写入、解压） |
| `warehouse.ts` | `warehouse.go` | `Warehouse`：本地优先，远程兜底 |
| `package-center.ts` | `package.go` | `DynamicCenter`（单例）：命名空间、默认版本、版本解析 |
| `api.ts` | `api.go` | 对外公共 API（`useWarehouse` / `getPackage` / ...） |

## 4. 核心架构

### 4.1 三级缓存模型

```
getPackage(pkg, version)
  │
  ├─ Level 1: DynamicCenter.dynamics (Map<index, Tunnel>)
  │   内存级缓存，命中后直接返回
  │
  ├─ Level 2: TunnelCenter.tunnels (Map<name, Tunnel>)
  │   已初始化的 Tunnel 实例，命中后回写 Level 1
  │
  └─ Level 3: Warehouse.Load(name)
       │
       ├─ Local.Exists(name) → 检查本地目录
       │   ├─ bundle variant: 检查 bundle.js
       │   └─ full variant:   检查 index.js / package.json
       │
       ├─ Local.Load(name)
       │   ├─ require() 加载模块
       │   ├─ 获取 Tunnel 实例
       │   └─ Tunnel.init()
       │
       └─ Remote.Sync(name) [当 Local.Exists 返回 false]
           ├─ S3 GetObject 下载 libnode_<name>.zip
           ├─ 原子写入（tmp + rename）
           └─ adm-zip 解压到本地目录
               → 回到 Local.Exists / Local.Load
```

### 4.2 Toolchain 检测

**优先级**（与 Go `toolchain.go` 一致）：
1. 代码显式注入（Go 用 `-ldflags`，Node 用 setter 函数）
2. 环境变量（`DYNAMIC_OS` / `DYNAMIC_ARCH` / `DYNAMIC_COMPILER` / `DYNAMIC_VARIANT`）
3. 运行时自动检测

**OS 检测**：
- Linux: 读取 `/etc/os-release` 获取 `ID` + `VERSION_ID`（如 `ubuntu24.04`）
- macOS/Darwin: 执行 `sw_vers -productVersion` 获取版本号（如 `darwin15.4`）
- Windows: 通过 `os.version()` 获取版本号

**Arch 检测**：
- `os.arch()` 映射：`x64` → `amd64`，`arm64` → `arm64`

**Compiler 检测**：
- `process.version` 去除前缀 `v`，添加 `node` 前缀（如 `node22.11.0`）

**Variant 检测**：
- 默认值 `"bundle"`（Go 版默认 `"generic"`）

**Toolchain 字符串格式**：
```
<os>_<arch>_<compiler>_<variant>
例如: ubuntu24.04_amd64_node22.11.0_bundle
```

### 4.3 S3 路径构造

```
S3 Key = <toolchain>/<name>/libnode_<name>.zip

其中:
  toolchain = os_arch_compiler_variant
  name      = namespace_package_version

完整示例:
  ubuntu24.04_amd64_node22.11.0_bundle/scp_myapp_v1/libnode_scp_myapp_v1.zip
```

对应 `dynamic-node-cli` 上传时的路径规则（`doc/cli.md:96-98`）。

### 4.4 模块加载机制

**bundle variant**：
```
<local>/<toolchain>/<name>/
  ├── bundle.js                  ← require() 入口
  └── libnode_<name>.zip         ← 原始 zip（保留，用于 clean cache 判定）
```

**full variant**：
```
<local>/<toolchain>/<name>/
  ├── package.json               ← require() 识别入口
  ├── index.js
  ├── node_modules/
  │   └── ...
  └── libnode_<name>.zip         ← 原始 zip
```

```typescript
// local.ts — load 方法
async load(name: string): Promise<Tunnel> {
  const dir = path.join(this.localPath, toolchain.toString(), name);
  const entryFile = toolchain.variant === "bundle"
    ? path.join(dir, "bundle.js")
    : dir; // Node 自动解析 package.json#main

  // 清除 require 缓存
  delete require.cache[require.resolve(entryFile)];
  const mod = require(entryFile);

  // 支持两种导出模式（对标 Go plugin 包的 Tunnel 变量 / New 函数）
  // 模式1: module.exports.Tunnel = new MyTunnel()
  // 模式2: module.exports.New = () => new MyTunnel()
  return mod.Tunnel ?? mod.New?.();
}
```

### 4.5 单例模式

Go 版使用包级变量 + `sync.Once` 实现单例。Node 版使用模块级闭包变量：

```typescript
// 每个模块都有对应的模块级单例实例

// toolchain.ts
export const toolchain = new Toolchain();  // 懒初始化

// warehouse.ts
let _warehouse: Warehouse | null = null;
export function getWarehouse(): Warehouse {
  if (!_warehouse) throw new Error("dynamic: warehouse not initialized");
  return _warehouse;
}

// package-center.ts
const packageCenter = new DynamicCenter();

// tunnel-center.ts
const tunnelCenter = new TunnelCenter();
```

### 4.6 错误处理

- S3 对象不存在：抛出 `TunnelNotExist` 错误（对标 Go `ErrTunnelNotExits`）
- 输入校验失败：抛出 `Error` 并附带描述信息
- 模块加载失败：抛出原始 `Error`
- 网络/文件 I/O 错误：抛出错误，不吞没

## 5. 公共 API

```typescript
// === 仓库配置 ===
// local: 本地仓库路径（必须）
// remote: 远程仓库 URL，支持 s3:// 协议（可选）
useWarehouse(local: string, remote: string): void;

// === 包配置 ===
useNamespace(namespace: string): void;
useDefaultVersion(version: string): void;

// === 包管理 ===
registerPackage(pkg: string, version: string, tunnel: Tunnel): void;
getPackage(pkg: string, version: string): Promise<Tunnel>;
closePackage(pkg: string, version: string): void;

// === Tunnel 接口 ===
interface Tunnel {
  meta(): string;
  init(): Promise<void>;
  invoke(route: string, req: string): Promise<string>;
  close(): Promise<void>;
}

// === Template 默认实现 ===
class Template implements Tunnel {
  meta(): string { return ""; }
  async init(): Promise<void> {}
  async invoke(route: string, req: string): Promise<string> { return ""; }
  async close(): Promise<void> {}
}
```

## 6. 依赖

| npm 包 | 版本 | 用途 |
|---|---|---|
| `@aws-sdk/client-s3` | `^3.x` | S3 文件下载 |
| `adm-zip` | `^0.5.x` | Zip 解压 |
| `typescript` | `^5.x` | 编译（dev） |
| `@types/node` | `^20.x` | Node 类型（dev） |
| `@types/adm-zip` | `^0.5.x` | adm-zip 类型（dev） |
| `vitest` | `^1.x` | 测试（dev） |

## 7. 与 Go 版的核心差异

| 维度 | Go `dynamic/` | Node.js `dynamic-node` |
|---|---|---|
| 插件格式 | `libgo_*.so` + `libcgo_*.so` | `libnode_*.zip`（单文件） |
| 加载机制 | `plugin.Open()` + `Lookup("Tunnel")` | `require()` + `mod.Tunnel` 或 `mod.New()` |
| CGO 桥接 | 需要（libcgo.so 导出 C 函数） | 不需要 |
| 解压步骤 | 不需要（.so 直接加载） | 需要（zip → 目录 → require） |
| I/O 模型 | 同步 | 异步（Promise） |
| variant 含义 | 构建参数标识（generic） | 构建方式标识（bundle / full） |
| 架构检测 | `go env GOARCH/GOAMD64`（支持 amd64v1/v2/v3/v4） | `os.arch()`（仅 amd64/arm64） |
| 默认 variant | `"generic"` | `"bundle"` |

## 8. 关于 lambda-node.yaml 的说明

虽然 `dynamic-node` 本身不含配置解析代码，但上层 lambda 工程使用此库时，建议使用 `lambda-node.yaml` 而非复用 `lambda.yaml`。理由：

| 决策点 | 原因 |
|---|---|
| **值与语义不同** | `lambda.yaml` 中 `compiler: go1.25.5` / `variant: generic` 是 Go 语义；Node 需要 `compiler: node22.11.0` / `variant: bundle`。同一文件无法同时满足两种语义 |
| **Go/Node 共存** | 一个项目可能同时有 Go Lambda 和 Node Lambda（如 `scp-lambda` 的多个子模块），两个独立配置文件互不干扰 |
| **字段结构兼容** | `dynamic:` 段的 YAML 结构（`environment.toolchain.*`、`environment.warehouse.*`、`package.*`）完全一致，解析代码可 100% 复用 — 只需检查 compiler 前缀区分运行时 |
| **向后兼容** | 上层工程仍可回退读取 `lambda.yaml`，老项目无需改名 |

`lambda-node.yaml` 示例（`dynamic:` 段，由上层工程使用）：

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