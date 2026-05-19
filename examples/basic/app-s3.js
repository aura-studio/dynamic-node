/**
 * example/basic/app-s3.js
 *
 * 完整示例 — 配置 S3 仓库，从远程拉取并加载插件。
 *
 * 前置条件：
 *   1. 已安装: npm install github:aura-studio/dynamic-node
 *   2. 已配置 AWS 凭证 (环境变量或 ~/.aws/credentials)
 *   3. S3 上已有 dynamic-node-cli 打包上传的 zip
 *
 * 运行：
 *   AWS_PROFILE=aws-3 node app-s3.js
 */

const {
  useWarehouse,
  useNamespace,
  useDefaultVersion,
  getPackage,
  closePackage,
  toolchain,
} = require("@aura-studio/dynamic-node");

// ============================================================
// 1. 配置仓库
// ============================================================
// 本地仓库路径（用于缓存下载的 zip + 解压内容）
const LOCAL_WAREHOUSE = "/tmp/dynamic-node-warehouse";
// S3 远程仓库地址
const REMOTE_WAREHOUSE = "s3://dynamic-loader-code-255491288557";

useWarehouse(LOCAL_WAREHOUSE, REMOTE_WAREHOUSE);

// ============================================================
// 2. 配置命名空间与默认版本
// ============================================================
// namespace: hotscripts
// defaultVersion: 当请求的版本不存在时，回退到此版本
useNamespace("hotscripts");
useDefaultVersion("default");

// ============================================================
// 3. 查看当前环境 toolchain
// ============================================================
console.log("toolchain:", toolchain.toString());
console.log("  os:", toolchain.osName);
console.log("  arch:", toolchain.arch);
console.log("  compiler:", toolchain.compiler);
console.log("  variant:", toolchain.variant);
console.log("");

// ============================================================
// 4. 从 S3 加载插件
// ============================================================
async function main() {
  console.log("=== Loading package from S3 ===");

  try {
    // getPackage 会触发:
    //   1) 检查本地缓存
    //   2) 如果没有, 从 S3 下载 zip
    //   3) 解压到本地仓库
    //   4) require() 加载模块
    //   5) 调用 tunnel.init()
    const tunnel = await getPackage("hello", "v1");

    console.log("tunnel meta:", tunnel.meta());

    // 调用插件功能
    const resp = await tunnel.invoke("/api/hello", JSON.stringify({ name: "Node" }));
    console.log("invoke response:", resp);

    // 关闭
    await closePackage("hello", "v1");
    console.log("=== Done ===");
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();