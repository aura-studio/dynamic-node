/**
 * example/basic/app-s3.js
 *
 * Full example — configure S3 warehouse, download and load plugins remotely.
 *
 * Prerequisites:
 *   1. Installed: npm install github:aura-studio/dynamic-node
 *   2. AWS credentials configured (env vars or ~/.aws/credentials)
 *   3. Package zip uploaded to S3 via dynamic-node-cli
 *
 * Run:
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
// 1. Configure warehouse
// ============================================================
const LOCAL_WAREHOUSE = "/tmp/dynamic-node-warehouse";
const REMOTE_WAREHOUSE = "s3://dynamic-loader-code-255491288557";

useWarehouse(LOCAL_WAREHOUSE, REMOTE_WAREHOUSE);

// ============================================================
// 2. Configure namespace and default version
// ============================================================
useNamespace("hotscripts");
useDefaultVersion("default");

// ============================================================
// 3. Inspect current toolchain
// ============================================================
console.log("toolchain:", toolchain.toString());
console.log("  os:", toolchain.osName);
console.log("  arch:", toolchain.arch);
console.log("  compiler:", toolchain.compiler);
console.log("  variant:", toolchain.variant);
console.log("");

// ============================================================
// 4. Load plugin from S3
// ============================================================
async function main() {
  console.log("=== Loading package from S3 ===");

  try {
    // getPackage will:
    //   1) Check local cache
    //   2) If not found, download zip from S3
    //   3) Extract to local warehouse
    //   4) require() the module
    const mod = await getPackage("hello", "v1");

    console.log("module loaded:", mod);
    console.log("module keys:", Object.keys(mod));

    // Use whatever the module exports
    if (typeof mod.handler === "function") {
      const resp = await mod.handler("/api/hello", JSON.stringify({ name: "Node" }));
      console.log("handler response:", resp);
    }

    // Close
    await closePackage("hello", "v1");
    console.log("=== Done ===");
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
