"use strict";

const {
  assert,
  dynamic,
  WAREHOUSE_DIR,
  expectJSONInvoke,
  ok,
} = require("./lib/common");

async function main() {
  const remote = process.env.DYNAMIC_NODE_EXAMPLE_REMOTE || "";
  if (!remote) {
    console.log("[skip] DYNAMIC_NODE_EXAMPLE_REMOTE is not set");
    return;
  }

  dynamic.toolchain.setOS(process.env.DYNAMIC_NODE_EXAMPLE_REMOTE_OS || "exampleos");
  dynamic.toolchain.setArch(process.env.DYNAMIC_NODE_EXAMPLE_REMOTE_ARCH || "examplearch");
  dynamic.toolchain.setCompiler(
    process.env.DYNAMIC_NODE_EXAMPLE_REMOTE_COMPILER || "node-example"
  );
  dynamic.toolchain.setVariant(
    process.env.DYNAMIC_NODE_EXAMPLE_REMOTE_VARIANT || "bundle"
  );

  const namespace = process.env.DYNAMIC_NODE_EXAMPLE_REMOTE_NAMESPACE || "demo";
  const pkg = process.env.DYNAMIC_NODE_EXAMPLE_REMOTE_PACKAGE || "remote";
  const version = process.env.DYNAMIC_NODE_EXAMPLE_REMOTE_VERSION || "v1";

  dynamic.useWarehouse(WAREHOUSE_DIR, remote);
  dynamic.useNamespace(namespace);

  const tunnel = await dynamic.getPackage(pkg, version);
  assert.equal(dynamic.isTunnelNode(tunnel), true);

  const response = await expectJSONInvoke(tunnel, "/remote", "request-body");
  assert.equal(response.route, "/remote");

  ok(`remote S3 package loaded from ${remote}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
