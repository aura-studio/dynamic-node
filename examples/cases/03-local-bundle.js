"use strict";

const {
  assert,
  dynamic,
  WAREHOUSE_DIR,
  createBundlePackage,
  bundleTunnelSource,
  expectJSONInvoke,
  ok,
} = require("./lib/common");

async function main() {
  createBundlePackage("demo", "bundle-app", "v1", bundleTunnelSource("bundle-app"));

  dynamic.useWarehouse(WAREHOUSE_DIR, "");
  dynamic.useNamespace("demo");

  const tunnel = await dynamic.getPackage("bundle-app", "v1");
  const response = await expectJSONInvoke(tunnel, "/bundle", "request-body");
  assert.equal(response.label, "bundle-app");
  assert.equal(response.variant, "bundle");
  assert.equal(response.initialized, true);
  assert.equal(response.route, "/bundle");
  assert.equal(response.request, "request-body");

  assert.deepEqual(JSON.parse(await tunnel.meta()), {
    label: "bundle-app",
    variant: "bundle",
  });

  ok("local bundle variant loads exports.Tunnel");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
