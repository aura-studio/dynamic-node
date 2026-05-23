"use strict";

const {
  assert,
  dynamic,
  expectJSONInvoke,
  setToolchain,
  ok,
} = require("./lib/common");

function lowerTunnel(label) {
  return {
    init() {},
    async invoke(route, request) {
      return JSON.stringify({ label, route, request });
    },
    meta() {
      return JSON.stringify({ label });
    },
    close() {},
  };
}

function upperTunnel(label) {
  return {
    Init() {},
    async Invoke(route, request) {
      return JSON.stringify({ label, route, request, style: "upper" });
    },
    Meta() {
      return JSON.stringify({ label, style: "upper" });
    },
    Close() {},
  };
}

async function main() {
  setToolchain("bundle");
  dynamic.useNamespace("symbols");

  await dynamic.registerPackage("direct", "v1", { Tunnel: lowerTunnel("direct") });
  await dynamic.registerPackage("factory", "v1", { New: () => lowerTunnel("factory") });
  await dynamic.registerPackage("upper", "v1", upperTunnel("upper"));

  assert.equal(
    (await expectJSONInvoke(await dynamic.getPackage("direct", "v1"), "/x", "1")).label,
    "direct"
  );
  assert.equal(
    (await expectJSONInvoke(await dynamic.getPackage("factory", "v1"), "/x", "2")).label,
    "factory"
  );

  const upper = await dynamic.getPackage("upper", "v1");
  const upperResponse = await dynamic.callTunnelInvoke(upper, "/x", "3");
  assert.deepEqual(JSON.parse(upperResponse), {
    label: "upper",
    route: "/x",
    request: "3",
    style: "upper",
  });
  assert.deepEqual(JSON.parse(await dynamic.callTunnelMeta(upper)), {
    label: "upper",
    style: "upper",
  });

  ok("Tunnel, New, and Go-style upper-case methods are accepted");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
