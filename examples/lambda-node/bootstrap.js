/**
 * example/lambda-node/bootstrap.js
 *
 * Lambda bootstrap — reads lambda-node.yaml, initializes dynamic-node.
 *
 * This example demonstrates how the host framework:
 *   1) Parses lambda-node.yaml configuration
 *   2) Maps YAML config to dynamic-node API calls
 *   3) Preloads packages (each independently registers its own handlers)
 *   4) Handles Lambda events by dispatching to registered handlers
 *
 * Usage:
 *   node bootstrap.js
 *
 * Or override toolchain via env:
 *   DYNAMIC_OS=ubuntu24.04 DYNAMIC_ARCH=amd64 DYNAMIC_COMPILER=node22.11.0 DYNAMIC_VARIANT=bundle node bootstrap.js
 */

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const {
  useWarehouse,
  useNamespace,
  useDefaultVersion,
  getPackage,
  registerPackage,
  toolchain,
} = require("@aura-studio/dynamic-node");

// ============================================================
// Global route registry — each module registers its own routes here
// ============================================================
const routeRegistry = new Map();

// ============================================================
// 1. Parse configuration
// ============================================================
const configPath = path.join(__dirname, "lambda-node.yaml");
const rawYaml = fs.readFileSync(configPath, "utf-8");
const config = YAML.parse(rawYaml);

console.log("=== lambda-node.yaml ===");
console.log(JSON.stringify(config, null, 2));
console.log("");

// ============================================================
// 2. Map YAML -> dynamic-node API
// ============================================================
const dyncfg = config.dynamic;

// 2a. Toolchain
const tc = dyncfg.environment.toolchain;
if (tc.os) toolchain.setOS(tc.os);
if (tc.arch) toolchain.setArch(tc.arch);
if (tc.compiler) toolchain.setCompiler(tc.compiler);
if (tc.variant) toolchain.setVariant(tc.variant);

console.log("toolchain:", toolchain.toString());

// 2b. Warehouse
const wh = dyncfg.environment.warehouse;
useWarehouse(wh.local, wh.remote || "");
console.log("warehouse:", wh.local, wh.remote ? `-> ${wh.remote}` : "(local only)");

// 2c. Package namespace + default version
const pkgCfg = dyncfg.package;
useNamespace(pkgCfg.namespace || "default");
useDefaultVersion(pkgCfg.defaultVersion || "default");
console.log("namespace:", pkgCfg.namespace, "defaultVersion:", pkgCfg.defaultVersion);
console.log("");

// ============================================================
// 3. Built-in modules (static registration, no S3)
// ============================================================
const pingModule = {
  name: "builtin-ping",
  register(registry) {
    registry.set("/ping", async () => {
      return JSON.stringify({ pong: true, timestamp: new Date().toISOString() });
    });
  },
};

registerPackage("ping", "v1", pingModule);
pingModule.register(routeRegistry);
console.log("[init] registered builtin ping@v1");

// ============================================================
// 4. Preload packages from warehouse (S3)
// Each package self-registers its handlers into the global registry.
// ============================================================
async function preloadPackages(packages) {
  for (const entry of packages) {
    try {
      const mod = await getPackage(entry.package, entry.version);
      console.log(`[init] preloaded ${entry.package}@${entry.version} — ${mod.name || "unnamed"}`);

      // If the module has a register function, let it register its own routes
      if (typeof mod.register === "function") {
        mod.register(routeRegistry);
      }
    } catch (err) {
      console.log(`[init] preload ${entry.package}@${entry.version} failed: ${err.message}`);
    }
  }
}

// ============================================================
// 5. Lambda event handler — dispatches to registered routes
// ============================================================
async function handleEvent(event) {
  const route = event.route || "/";
  const handler = routeRegistry.get(route);

  if (!handler) {
    return {
      statusCode: 404,
      body: { error: `no handler for route: ${route}` },
    };
  }

  const req = JSON.stringify(event.body || {});
  const resp = await handler(req);

  return {
    statusCode: 200,
    body: JSON.parse(resp),
  };
}

// ============================================================
// 6. Bootstrap
// ============================================================
async function bootstrap() {
  console.log("=== Bootstrapping Lambda ===");
  console.log("");

  // Preload
  await preloadPackages(pkgCfg.preload || []);

  console.log("");
  console.log("=== Ready ===");
  console.log(`Registered routes: ${[...routeRegistry.keys()].join(", ")}`);
  console.log("");

  // Simulate event
  console.log("--- Simulating event ---");
  const event = {
    route: "/ping",
    body: {},
  };

  try {
    const result = await handleEvent(event);
    console.log("Lambda response:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.log("Lambda error:", err.message);
  }
}

bootstrap().catch(console.error);
