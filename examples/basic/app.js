/**
 * example/basic/app.js
 *
 * Basic example — statically register a module, no S3 warehouse.
 *
 * Install:
 *   npm install github:aura-studio/dynamic-node
 *
 * Or in package.json:
 *   "dependencies": {
 *     "@aura-studio/dynamic-node": "github:aura-studio/dynamic-node"
 *   }
 */

const { registerPackage, getPackage, closePackage } = require("@aura-studio/dynamic-node");

// A module that exports handlers — no Tunnel interface needed.
const helloModule = {
  name: "hello-module-v1",
  VERSION: "1.0.0",

  // Routes this module handles
  routes: {
    "/greet": async (req) => {
      const request = JSON.parse(req);
      console.log(`[hello] greeting: ${request.name || "World"}`);
      return JSON.stringify({
        message: `Hello, ${request.name || "World"}!`,
        module: "hello-module-v1",
      });
    },
    "/status": async () => {
      return JSON.stringify({ status: "ok", module: "hello-module-v1" });
    },
  },

  // Self-registration function — the module registers its own routes
  register(registry) {
    for (const [route, handler] of Object.entries(this.routes)) {
      registry.set(route, handler);
    }
    console.log(`[hello] registered ${Object.keys(this.routes).length} routes`);
  },
};

// ============================================================
// No S3 warehouse — pure static registration
// ============================================================
async function main() {
  // Register a static package
  await registerPackage("hello-world", "v1", helloModule);

  // Retrieve the module
  const mod = await getPackage("hello-world", "v1");
  console.log("[main] module name:", mod.name);

  // Use the module's handler directly
  const resp = await mod.routes["/greet"](JSON.stringify({ name: "developer" }));
  console.log("[main] response:", resp);

  // Or use the registration pattern with a route registry
  const routeRegistry = new Map();
  mod.register(routeRegistry);

  // Dispatch a request via the registry
  const handler = routeRegistry.get("/status");
  if (handler) {
    const statusResp = await handler();
    console.log("[main] status:", statusResp);
  }

  // Close
  await closePackage("hello-world", "v1");
  console.log("[main] done");
}

main().catch(console.error);
