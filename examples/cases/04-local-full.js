"use strict";

const {
  assert,
  dynamic,
  WAREHOUSE_DIR,
  createFullPackage,
  fullPackageFiles,
  expectJSONInvoke,
  ok,
} = require("./lib/common");

async function main() {
  createFullPackage("demo", "full-app", "v1", fullPackageFiles("full-app"));

  dynamic.useWarehouse(WAREHOUSE_DIR, "");
  dynamic.useNamespace("demo");

  const tunnel = await dynamic.getPackage("full-app", "v1");
  const response = await expectJSONInvoke(tunnel, "/full", "request-body");
  assert.equal(response.label, "full-app");
  assert.equal(response.variant, "full");
  assert.equal(response.initialized, true);
  assert.equal(response.route, "/full");
  assert.equal(response.request, "request-body");

  assert.deepEqual(JSON.parse(await tunnel.meta()), {
    label: "full-app",
    variant: "full",
  });

  ok("local full variant loads package.json#main and exports.New");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
