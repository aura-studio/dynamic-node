"use strict";

const {
  assert,
  dynamic,
  setToolchain,
  ok,
} = require("./lib/common");

async function main() {
  setToolchain("bundle");

  assert.equal(typeof dynamic.useWarehouse, "function");
  assert.equal(typeof dynamic.useNamespace, "function");
  assert.equal(typeof dynamic.useDefaultVersion, "function");
  assert.equal(typeof dynamic.registerPackage, "function");
  assert.equal(typeof dynamic.getPackage, "function");
  assert.equal(typeof dynamic.closePackage, "function");
  assert.equal(typeof dynamic.getTunnel, "function");
  assert.equal(typeof dynamic.Template, "function");
  assert.equal(typeof dynamic.TunnelCenter, "function");
  assert.equal(typeof dynamic.PackageCenter, "function");

  assert.equal(
    dynamic.toolchain.toString(),
    "exampleos_examplearch_node-example_bundle"
  );

  const template = new dynamic.Template();
  assert.equal(dynamic.isTunnelNode(template), true);
  assert.equal(await template.invoke("/smoke", "request"), "");
  assert.equal(await template.meta(), "");

  ok("public API exports and Template tunnel are available");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
