/**
 * example/basic/app-toolchain.js
 *
 * Example — manually set toolchain to match a specific S3 path.
 *
 * When your runtime environment doesn't match the S3 toolchain path,
 * you can override toolchain values via setters or env vars.
 */

const {
  useWarehouse,
  useNamespace,
  getPackage,
  toolchain,
} = require("@aura-studio/dynamic-node");

// Override toolchain to match the S3 path
toolchain.setOS("darwin15.7.3");
toolchain.setArch("amd64v1");
toolchain.setCompiler("node25.8.0");
toolchain.setVariant("bundle");

console.log("overridden toolchain:", toolchain.toString());

// Configure warehouse
useWarehouse("/tmp/dynamic-node-warehouse", "s3://dynamic-loader-code-255491288557");
useNamespace("hotscripts");

async function main() {
  console.log("=== Loading with custom toolchain ===");
  try {
    const mod = await getPackage("hello", "v1");
    console.log("module loaded successfully");
    console.log("module keys:", Object.keys(mod));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
