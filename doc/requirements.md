# dynamic-node — 需求规格说明

## 1. 项目概述

`dynamic-node` 是 `github.com/aura-studio/dynamic`（Go 运行时库）的 Node.js 对标版本。它是一个纯 TypeScript 运行时库，发布到 npm，在 Node.js 项目中被 `import`/`require` 使用。

**核心目的**：从 S3 远程仓库拉取并加载由 `github.com/aura-studio/dynamic-node-cli` 打包上传的 Node.js 插件 zip 包。

## 2. 功能需求

### 2.1 仓库管理（Warehouse）

- R1.1 支持配置本地仓库路径（`local`）和远程 S3 仓库地址（`remote`）
- R1.2 本地仓库为空时，自动从 S3 远程仓库同步文件
- R1.3 本地仓库已有文件时，跳过远程同步
- R1.4 本地文件存在但大小为零时，视为无效，重新从远程下载
- R1.5 S3 下载使用原子写入（tmp 文件 + rename），防止部分写入损坏

### 2.2 远程下载（Remote）

- R2.1 支持 `s3://` 协议的远程仓库 URL
- R2.2 S3 Key 构造规则：`<os>_<arch>_<compiler>_<variant>/<namespace>_<package>_<version>/libnode_<namespace>_<package>_<version>.zip`
- R2.3 下载完成后，自动解压 zip 到本地仓库对应目录
- R2.4 解压后保留原始 zip 文件（兼容 `dynamic-node-cli clean` 命令）

### 2.3 本地仓库（Local）

- R3.1 支持检查本地仓库中指定包是否已存在（解压后的入口文件）
- R3.2 bundle variant：检查 `<local>/<toolchain>/<name>/bundle.js` 是否存在
- R3.3 full variant：检查 `<local>/<toolchain>/<name>/index.js` 或 `package.json` 是否存在
- R3.4 通过 `require()` 加载本地模块，返回符合 `Tunnel` 接口的实例
- R3.5 `require()` 前清除缓存（`delete require.cache`），确保获取最新版本

### 2.4 包管理中心（Package Center）

- R4.1 支持命名空间（namespace）管理：`useNamespace()`
- R4.2 支持默认版本（defaultVersion）：`useDefaultVersion()`
- R4.3 三级缓存：内存 Map → TunnelCenter 已加载隧道 → Warehouse 本地/远程
- R4.4 版本解析：先查指定版本 → 再查默认版本 → 两者都不存在则报错
- R4.5 支持静态注册包（不经过 Warehouse，直接注入 Tunnel）

### 2.5 Tunnel 接口

- R5.1 定义统一的 `Tunnel` 接口：
  - `meta(): string` — 返回隧道元信息
  - `init(): Promise<void>` — 初始化
  - `invoke(route: string, req: string): Promise<string>` — 调用插件功能
  - `close(): Promise<void>` — 关闭清理
- R5.2 提供 `Template` 默认空实现，方便用户继承

### 2.6 环境检测（Toolchain）

- R6.1 自动检测当前运行环境的 os、arch、compiler（Node.js 版本）
- R6.2 支持通过环境变量覆盖：`DYNAMIC_OS`、`DYNAMIC_ARCH`、`DYNAMIC_COMPILER`、`DYNAMIC_VARIANT`
- R6.3 拼装工具链字符串：`<os>_<arch>_<compiler>_<variant>`
- R6.4 variant 默认值为 `"bundle"`

### 2.7 输入校验（Allowed）

- R7.1 校验 keyword（namespace/package/version）：仅允许 `[A-Za-z0-9._-]`
- R7.2 校验本地路径：必须是合法文件系统路径
- R7.3 校验远程 URL：必须是合法 URL 格式

## 3. 非功能需求

- N1. 所有依赖来自 npm 公共注册表，不使用私有仓库
- N2. TypeScript 编写，提供 `.d.ts` 类型定义
- N3. 支持 Node.js 18, 20, 22 LTS
- N4. 异步 I/O 操作使用 `Promise` 风格
- N5. 遵循 `github.com/aura-studio/dynamic` 的架构模式（模块划分、缓存层级、错误处理）

## 4. 范围边界

### 包含

- 仓库管理（本地 + S3 远程）
- 包拉取 + 解压 + 模块加载
- 命名空间 + 版本管理
- 运行时 Toolchain 检测
- 程序化 API

### 不包含

- YAML 配置文件解析（属于上层 lambda 工程）
- CLI 命令（属于 `dynamic-node-cli`）
- 构建/打包功能（属于 `dynamic-node-cli`）
- HTTP/SQS/Event 等 Lambda 触发器处理（属于上层 lambda 工程）
- 配置文件的自动发现与加载（属于上层 lambda 工程）