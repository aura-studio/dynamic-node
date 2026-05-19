# examples

This directory contains usage examples for `@aura-studio/dynamic-node`.

## GitHub 引用方式

在 `package.json` 中使用 GitHub 引用安装：

```json
{
  "dependencies": {
    "@aura-studio/dynamic-node": "github:aura-studio/dynamic-node"
  }
}
```

```bash
npm install
```

版本锁定方式：

```json
{
  "dependencies": {
    "@aura-studio/dynamic-node": "github:aura-studio/dynamic-node#v0.1.0"
  }
}
```

## 示例

### [`basic/`](basic/)

| 文件 | 说明 |
|---|---|
| `app.js` | 最简示例 — 静态注册 Tunnel，不走仓库 |
| `app-s3.js` | 完整示例 — 配置 S3 仓库，远程拉取插件 |
| `app-toolchain.js` | 手动覆盖 toolchain 以匹配 S3 路径 |

### [`lambda-node/`](lambda-node/)

| 文件 | 说明 |
|---|---|
| `bootstrap.js` | Lambda 启动入口 — 解析 `lambda-node.yaml`，初始化 dynamic-node，预加载包 |
| `lambda-node.yaml` | 配置文件 — 字段结构与 `lambda.yaml` 一致，`compiler`/`variant` 使用 Node.js 语义 |

### YAML → API 映射

```yaml
# lambda-node.yaml
dynamic:
  environment:
    toolchain:           # → toolchain.setOS/setArch/setCompiler/setVariant
      os: darwin15.7.3
      arch: amd64v1
      compiler: node25.8.0
      variant: bundle
    warehouse:           # → useWarehouse(local, remote)
      local: /tmp/warehouse
      remote: s3://bucket
  package:
    namespace: myteam    # → useNamespace("myteam")
    defaultVersion: v1   # → useDefaultVersion("v1")
    preload:             # → getPackage("hello", "v1")
      - package: hello
        version: v1
```

### 环境变量覆盖

```bash
DYNAMIC_OS=ubuntu24.04 \
DYNAMIC_ARCH=amd64 \
DYNAMIC_COMPILER=node22.11.0 \
DYNAMIC_VARIANT=bundle \
AWS_PROFILE=aws-3 \
  node app-s3.js
```

### S3 路径说明

```
s3://<bucket>/<os>_<arch>_<compiler>_<variant>/<namespace>_<package>_<version>/libnode_<namespace>_<package>_<version>.zip

例:
  s3://dynamic-loader-code-255491288557/darwin15.7.3_amd64v1_node25.8.0_bundle/hotscripts_hello_v1/libnode_hotscripts_hello_v1.zip
```

此路径由 `dynamic-node-cli` 打包上传时生成，`dynamic-node` 运行时按相同规则构造 Key 进行下载。