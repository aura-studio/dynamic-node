# dynamic-node

## 概述

`dynamic-node` 是一个 Node.js 运行时库，用于从 S3 远程仓库动态加载插件包。

## 核心原则

**dynamic-node 不关心也不要求任何特定导出格式。** bundle 想导出什么就导出什么。

## 使用方式

### 配置仓库

```js
const { useWarehouse, useNamespace, getPackage } = require("@aura-studio/dynamic-node");

useWarehouse("/opt/warehouse", "s3://my-bucket");
useNamespace("myorg");
```

### 加载 bundle

```js
const mod = await getPackage("hello", "v1");
// mod 就是 bundle.js 的 module.exports，原样返回，无任何包装
```

### 加载多个 bundle

```js
const modA = await getPackage("service-a", "v1");
const modB = await getPackage("service-b", "v2");
// 互不冲突，各自独立
```

重复加载同一个 `pkg + version`，后加载的覆盖前者。

### bundle.js 示例

bundle.js 可以导出任意内容，取决于上层框架的需求。例如导出一个 `(req, res) => {}` 函数：

```js
// bundle.js
module.exports = async (req, res) => {
  res.statusCode = 200;
  res.end(JSON.stringify({ message: "hello" }));
};
```

加载后直接调用：

```js
const handler = await getPackage("hello", "v1");
// handler 就是 async (req, res) => { ... }
```

也可以导出对象：

```js
// bundle.js
exports.basePath = "/api/hello";

exports.handler = async (event, context) => {
  return { statusCode: 200, body: { message: "ok" } };
};
```

加载后按需使用：

```js
const mod = await getPackage("hello", "v1");
console.log(mod.basePath); // "/api/hello"
```

## API

| 函数 | 说明 |
|---|---|
| `useWarehouse(local, remote)` | 配置本地仓库路径和远程 S3 地址 |
| `useNamespace(namespace)` | 设置包命名空间 |
| `useDefaultVersion(version)` | 设置默认版本，指定版本找不到时回退 |
| `registerPackage(pkg, version, mod)` | 静态注册模块，不走 warehouse |
| `getPackage(pkg, version)` | 获取或懒加载模块，返回 `module.exports` |
| `closePackage(pkg, version)` | 从内存缓存中移除 |

### 辅助导出

| 导出 | 说明 |
|---|---|
| `toolchain` | OS/Arch/Compiler 检测，支持 `setOS()` 等覆盖 |
| `PackageNotExistError` | S3 上找不到包时抛出的错误 |
| `isPackageNotExist(err)` | 判断错误是否为 `PackageNotExistError` |

## 多包共存

- 每个包由 `(namespace, pkg, version)` 唯一标识
- 多个包可同时加载，互不干扰
- 关闭一个包不影响其他包
- 相同 key 重复加载，后者覆盖前者