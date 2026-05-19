/**
 * example/basic/app-toolchain.js
 *
 * 示例 — 手动设置 toolchain 以匹配特定的 S3 路径。
 *
 * 当你的运行环境与 S3 上的 toolchain 路径不一致时,
 * 可以通过 setter 或环境变量覆盖 toolchain 值。
 */

const {
  useWarehouse,
  useNamespace,
  getPackage,
  toolchain,
} = require("@aura-studio/dynamic-node");

// 覆盖 toolchain 为 S3 上的路径
toolchain.setOS("darwin15.7.3");
toolchain.setArch("amd64v1");
toolchain.setCompiler("node25.8.0");
toolchain.setVariant("bundle");

console.log("overridden toolchain:", toolchain.toString());

// 配置仓库
useWarehouse("/tmp/dynamic-node-warehouse", "s3://dynamic-loader-code-255491288557");
useNamespace("hotscripts");

async function main() {
  console.log("=== Loading with custom toolchain ===");
  try {
    const tunnel = await getPackage("hello", "v1");
    console.log("tunnel meta:", tunnel.meta());
  } catch (err) {
    console.error("Error (expected if bundle doesn't export Tunnel):", err.message);
    console.log("S3 download + extraction was successful!");
  }
}

main();