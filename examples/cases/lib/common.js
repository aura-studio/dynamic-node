"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const AdmZip = require("adm-zip");
const dynamic = require("../../../src");

const EXAMPLES_DIR = path.resolve(__dirname, "../..");
const TMP_DIR = path.join(EXAMPLES_DIR, ".tmp");
const WAREHOUSE_DIR =
  process.env.DYNAMIC_NODE_EXAMPLE_WAREHOUSE ||
  path.join(TMP_DIR, "warehouse");

const TOOLCHAIN = {
  os: process.env.DYNAMIC_NODE_EXAMPLE_OS || "exampleos",
  arch: process.env.DYNAMIC_NODE_EXAMPLE_ARCH || "examplearch",
  compiler: process.env.DYNAMIC_NODE_EXAMPLE_COMPILER || "node-example",
};

function setToolchain(variant) {
  dynamic.toolchain.setOS(TOOLCHAIN.os);
  dynamic.toolchain.setArch(TOOLCHAIN.arch);
  dynamic.toolchain.setCompiler(TOOLCHAIN.compiler);
  dynamic.toolchain.setVariant(variant);
}

function packageName(namespace, pkg, version) {
  return `${namespace}_${pkg}_${version}`;
}

function packageDir(namespace, pkg, version) {
  return path.join(
    WAREHOUSE_DIR,
    dynamic.toolchain.toString(),
    packageName(namespace, pkg, version)
  );
}

function writeFiles(root, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

function writeZip(root, name, files) {
  const zip = new AdmZip();
  for (const [relativePath, content] of Object.entries(files)) {
    zip.addFile(relativePath.replace(/\\/g, "/"), Buffer.from(content, "utf8"));
  }
  zip.writeZip(path.join(root, `libnode_${name}.zip`));
}

function createBundlePackage(namespace, pkg, version, content) {
  setToolchain("bundle");
  const name = packageName(namespace, pkg, version);
  const dir = packageDir(namespace, pkg, version);
  fs.mkdirSync(dir, { recursive: true });
  const files = { "bundle.js": content };
  writeFiles(dir, files);
  writeZip(dir, name, files);
  return { name, dir };
}

function createFullPackage(namespace, pkg, version, files) {
  setToolchain("full");
  const name = packageName(namespace, pkg, version);
  const dir = packageDir(namespace, pkg, version);
  fs.mkdirSync(dir, { recursive: true });
  writeFiles(dir, files);
  writeZip(dir, name, files);
  return { name, dir };
}

function bundleTunnelSource(label) {
  return `
exports.Tunnel = {
  initialized: false,
  closed: false,
  init() {
    this.initialized = true;
  },
  async invoke(route, request) {
    return JSON.stringify({
      label: "${label}",
      variant: "bundle",
      initialized: this.initialized,
      route,
      request
    });
  },
  meta() {
    return JSON.stringify({ label: "${label}", variant: "bundle" });
  },
  close() {
    this.closed = true;
  }
};
`;
}

function fullPackageFiles(label) {
  return {
    "package.json": JSON.stringify({
      name: `dynamic-node-example-${label}`,
      version: "1.0.0",
      main: "index.js",
      type: "commonjs",
    }, null, 2),
    "lib/message.js": `module.exports = () => "${label}";\n`,
    "index.js": `
const message = require("./lib/message");

exports.New = () => ({
  initialized: false,
  closed: false,
  init() {
    this.initialized = true;
  },
  async invoke(route, request) {
    return JSON.stringify({
      label: message(),
      variant: "full",
      initialized: this.initialized,
      route,
      request
    });
  },
  meta() {
    return JSON.stringify({ label: message(), variant: "full" });
  },
  close() {
    this.closed = true;
  }
});
`,
  };
}

async function expectJSONInvoke(tunnel, route, request) {
  const response = await tunnel.invoke(route, request);
  return JSON.parse(response);
}

function cleanTmp() {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

function ok(message) {
  console.log(`[ok] ${message}`);
}

module.exports = {
  assert,
  dynamic,
  EXAMPLES_DIR,
  TMP_DIR,
  WAREHOUSE_DIR,
  setToolchain,
  packageName,
  createBundlePackage,
  createFullPackage,
  bundleTunnelSource,
  fullPackageFiles,
  expectJSONInvoke,
  cleanTmp,
  ok,
};
