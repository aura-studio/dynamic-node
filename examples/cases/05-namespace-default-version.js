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
  createBundlePackage("team-a", "service", "stable", bundleTunnelSource("team-a-stable"));
  createBundlePackage("team-a", "service", "v2", bundleTunnelSource("team-a-v2"));
  createBundlePackage("team-b", "service", "stable", bundleTunnelSource("team-b-stable"));

  dynamic.useWarehouse(WAREHOUSE_DIR, "");
  dynamic.useDefaultVersion("stable");

  dynamic.useNamespace("team-a");
  const fallback = await dynamic.getPackage("service", "missing");
  const exact = await dynamic.getPackage("service", "v2");

  assert.equal((await expectJSONInvoke(fallback, "/fallback", "")).label, "team-a-stable");
  assert.equal((await expectJSONInvoke(exact, "/exact", "")).label, "team-a-v2");

  dynamic.useNamespace("team-b");
  const otherNamespace = await dynamic.getPackage("service", "missing");
  assert.equal(
    (await expectJSONInvoke(otherNamespace, "/fallback", "")).label,
    "team-b-stable"
  );

  ok("namespace isolation and default-version fallback work");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
