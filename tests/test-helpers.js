/**
 * test-helpers.js — Shared test helpers
 */

const { toolchain: globalToolchain } = require("../src/toolchain");

/** S3 bucket used for integration tests */
const TEST_S3_BUCKET = "dynamic-loader-code-255491288557";

/** Toolchain values matching the S3 path for integration tests */
const TEST_TOOLCHAIN = {
  os: "darwin15.7.3",
  arch: "amd64v1",
  compiler: "node25.8.0",
  variant: "bundle",
};

/** Package name matching the S3 path */
const TEST_PACKAGE_NAME = "hotscripts_hello_v1";
const TEST_NAMESPACE = "hotscripts";
const TEST_PACKAGE = "hello";
const TEST_VERSION = "v1";

/**
 * Override the global toolchain to match the S3 test data.
 * Must be called in beforeAll.
 */
function overrideToolchain() {
  globalToolchain.setOS(TEST_TOOLCHAIN.os);
  globalToolchain.setArch(TEST_TOOLCHAIN.arch);
  globalToolchain.setCompiler(TEST_TOOLCHAIN.compiler);
  globalToolchain.setVariant(TEST_TOOLCHAIN.variant);
}

// ---------------------------------------------------------------------------
// Bundle.js content generators
// ---------------------------------------------------------------------------

/**
 * Creates a bundle.js content string that exports a handler and version.
 */
function makeHandlerBundle(name = "test-module") {
  return `
const moduleName = "${name}";
exports.name = moduleName;
exports.VERSION = "1.0.0";
exports.handler = async (route, req) => {
  return JSON.stringify({ module: moduleName, route, req: JSON.parse(req) });
};
exports.register = (registry) => {
  registry.set("/" + moduleName, exports.handler);
};
`;
}

/**
 * Creates a bundle.js that exports multiple route handlers.
 */
function makeMultiRouteBundle(name, routes) {
  const routeHandlers = routes
    .map(
      (r) =>
        `  "${r}": async (req) => JSON.stringify({ module: "${name}", route: "${r}", req: JSON.parse(req) })`
    )
    .join(",\n");

  return `
exports.name = "${name}";
exports.routes = {
${routeHandlers}
};
exports.register = (registry) => {
  for (const [route, handler] of Object.entries(exports.routes)) {
    registry.set(route, handler);
  }
};
`;
}

/**
 * Creates a simple bundle.js with a greeting function.
 */
function makeSimpleBundle(greeting = "hello") {
  return `
exports.greet = (name) => greeting + ", " + name + "!";
const greeting = "${greeting}";
exports.greeting = greeting;
`;
}

/**
 * Creates a bundle.js that exports nothing useful (for testing).
 */
function makeEmptyBundle() {
  return `
// intentionally empty module
`;
}

module.exports = {
  TEST_S3_BUCKET,
  TEST_TOOLCHAIN,
  TEST_PACKAGE_NAME,
  TEST_NAMESPACE,
  TEST_PACKAGE,
  TEST_VERSION,
  overrideToolchain,
  makeHandlerBundle,
  makeMultiRouteBundle,
  makeSimpleBundle,
  makeEmptyBundle,
};
