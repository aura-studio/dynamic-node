"use strict";

const {
  assert,
  dynamic,
  setToolchain,
  ok,
} = require("./lib/common");

async function main() {
  setToolchain("bundle");

  assert.throws(
    () => dynamic.useWarehouse("", "s3://bucket"),
    /invalid warehouse configuration/
  );
  assert.throws(
    () => dynamic.useNamespace("InvalidNamespace"),
    /invalid package namespace/
  );
  assert.throws(
    () => dynamic.useDefaultVersion("BadVersion"),
    /invalid default package version/
  );
  await assert.rejects(
    () => dynamic.registerPackage("bad_name", "v1", {}),
    /invalid package name/
  );
  await assert.rejects(
    () => dynamic.getPackage("valid", "BadVersion"),
    /invalid package version/
  );
  await assert.rejects(
    () => dynamic.registerPackage("valid", "v1", {}),
    /symbol is not a Tunnel/
  );

  ok("validation errors are raised for invalid inputs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
