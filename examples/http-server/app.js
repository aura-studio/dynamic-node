/**
 * examples/http-server/app.js
 *
 * HTTP server that dynamically loads handler bundles from S3 via dynamic-node.
 *
 * Architecture:
 *   - dynamic-node: download / cache / require() — returns raw module.exports
 *   - bundle.js:    exports { basePath, handler } — defines its own route prefix
 *   - HTTP server:  matches basePath, strips prefix, passes relative path to handler
 *
 * Start:
 *   AWS_PROFILE=aws-3 node app.js
 *
 * Test:
 *   curl http://localhost:8080/api/hello
 *   curl http://localhost:8080/api/hello/user/123
 */

const http = require("http");
const {
  useWarehouse,
  useNamespace,
  getPackage,
  toolchain,
} = require("@aura-studio/dynamic-node");

// ---------------------------------------------------------------------------
// Toolchain — match the S3 upload path
// ---------------------------------------------------------------------------
toolchain.setOS("darwin15.7.3");
toolchain.setArch("amd64v1");
toolchain.setCompiler("node25.8.0");
toolchain.setVariant("bundle");

// ---------------------------------------------------------------------------
// Warehouse — local cache + S3 remote
// ---------------------------------------------------------------------------
const LOCAL_WAREHOUSE = "/tmp/dynamic-node-http-warehouse";
const REMOTE_WAREHOUSE = "s3://dynamic-loader-code-255491288557";
useWarehouse(LOCAL_WAREHOUSE, REMOTE_WAREHOUSE);
useNamespace("hotscripts");

// ---------------------------------------------------------------------------
// Loaded bundles — each bundle defines its own { basePath, handler }
// ---------------------------------------------------------------------------
const bundles = [];

async function loadBundle(pkg, version) {
  console.log(`[bootstrap] loading ${pkg}@${version} ...`);
  const mod = await getPackage(pkg, version);

  const basePath = mod.basePath || `/api/${pkg}`;
  const handler = mod.handler;

  if (typeof handler !== "function") {
    throw new Error(`bundle ${pkg} does not export handler function`);
  }

  bundles.push({ basePath, handler });
  console.log(`[bootstrap] ${pkg}@${version} -> ${basePath}`);
  console.log(`[bootstrap] exports: ${Object.keys(mod).join(", ")}`);
  console.log("");
}

// ---------------------------------------------------------------------------
// HTTP Server — matches basePath, strips prefix, forwards to handler
// ---------------------------------------------------------------------------
async function handleRequest(req, res) {
  const { url, method } = req;

  // Gather body
  let body = "";
  for await (const chunk of req) { body += chunk; }

  // Split path and query
  const [pathname, queryString] = url.split("?");

  // Find matching bundle (longest basePath match first)
  for (const { basePath, handler } of bundles) {
    if (pathname === basePath || pathname.startsWith(basePath + "/")) {
      // Strip basePath, keep the relative path
      const relativePath = pathname === basePath
        ? "/"
        : pathname.slice(basePath.length);

      const event = {
        httpMethod: method,
        path: relativePath,       // relative path — bundle doesn't see its prefix
        rawPath: pathname,        // full path if needed
        queryStringParameters: parseQuery(queryString || ""),
        body: body ? tryParse(body) : null,
        headers: req.headers,
      };

      console.log(`[http] ${method} ${url} -> ${basePath} [${relativePath}]`);

      try {
        const result = await handler(event, {});
        res.writeHead(result.statusCode || 200, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify(result.body));
      } catch (err) {
        console.error(`[http] handler error:`, err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // 404
  console.log(`[http] ${method} ${url} -> 404`);
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    error: "not found",
    path: url,
    registered: bundles.map(b => b.basePath),
  }));
}

function parseQuery(qs) {
  if (!qs) return {};
  const params = {};
  for (const part of qs.split("&")) {
    const [k, v] = part.split("=");
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
  }
  return params;
}

function tryParse(s) {
  try { return JSON.parse(s); }
  catch { return s; }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== dynamic-node HTTP Server ===");
  console.log(`toolchain: ${toolchain.toString()}`);
  console.log(`warehouse: ${LOCAL_WAREHOUSE} -> ${REMOTE_WAREHOUSE}`);
  console.log("");

  // Load bundles — each defines its own { basePath, handler }
  await loadBundle("hello", "v1");
  // Add more: await loadBundle("world", "v1");
  // Add more: await loadBundle("users", "v2");

  const server = http.createServer(handleRequest);
  server.listen(8080, () => {
    console.log("=== Server listening on http://localhost:8080 ===");
    console.log("");
    console.log("Try:");
    for (const { basePath } of bundles) {
      console.log(`  curl http://localhost:8080${basePath}`);
    }
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});