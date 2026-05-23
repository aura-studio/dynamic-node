"use strict";

const {
  assert,
  dynamic,
  expectJSONInvoke,
  setToolchain,
  ok,
} = require("./lib/common");

async function main() {
  setToolchain("bundle");
  dynamic.useNamespace("manual");

  const calls = [];
  const tunnel = {
    init() {
      calls.push("init");
    },
    async invoke(route, request) {
      return JSON.stringify({ route, request, calls: [...calls] });
    },
    meta() {
      return JSON.stringify({ name: "static", version: "v1" });
    },
    close() {
      calls.push("close");
    },
  };

  await dynamic.registerPackage("static", "v1", tunnel);
  const loaded = await dynamic.getPackage("static", "v1");
  assert.equal(loaded, tunnel);

  const response = await expectJSONInvoke(loaded, "/hello", "payload");
  assert.deepEqual(response, {
    route: "/hello",
    request: "payload",
    calls: ["init"],
  });

  assert.deepEqual(JSON.parse(await loaded.meta()), {
    name: "static",
    version: "v1",
  });

  await dynamic.closePackage("static", "v1");
  assert.deepEqual(calls, ["init", "close"]);

  ok("static register/get/invoke/meta/close lifecycle works");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
