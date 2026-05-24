"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} = require("@aws-sdk/client-s3");
const dynamic = require("../../src");

const SCRIPT_DIR = __dirname;
const EXAMPLES_DIR = path.dirname(SCRIPT_DIR);
const REPO_ROOT = path.dirname(EXAMPLES_DIR);
const AURA_ROOT = path.dirname(REPO_ROOT);

const TARGET_PACKAGES = [
  "bundle",
  "full",
  "service-bundle",
  "service-full",
  "wire-bundle",
  "wire-full",
];

function createContext(env = process.env) {
  const testId = env.DYNAMIC_NODE_TEST_ID || "manual";
  const npmCache = env.DYNAMIC_NODE_TEST_NPM_CACHE || path.join(EXAMPLES_DIR, ".npm-cache");
  const childEnv = { ...env };
  for (const key of Object.keys(childEnv)) {
    if (key.toLowerCase() === "npm_config_cache") {
      delete childEnv[key];
    }
  }

  const cliRoot = env.DYNAMIC_NODE_CLI_ROOT || path.join(AURA_ROOT, "dynamic-node-cli");
  return {
    env: {
      ...childEnv,
      npm_config_cache: npmCache,
      NPM_CONFIG_CACHE: npmCache,
    },
    scriptDir: SCRIPT_DIR,
    examplesDir: EXAMPLES_DIR,
    repoRoot: REPO_ROOT,
    auraRoot: AURA_ROOT,
    cliRoot,
    cliMain: path.join(cliRoot, "src", "main.js"),
    warehouseDir: env.DYNAMIC_NODE_TEST_WAREHOUSE || path.join(EXAMPLES_DIR, "warehouse"),
    configPath: env.DYNAMIC_NODE_TEST_CONFIG || path.join(EXAMPLES_DIR, "dynamic-node-cli.yaml"),
    testId,
    remote: env.DYNAMIC_NODE_TEST_REMOTE || `s3://dynamic-node-test/${testId}`,
    remoteWasExplicit: Boolean(env.DYNAMIC_NODE_TEST_REMOTE),
  };
}

function ensureDependencies(ctx) {
  if (!fs.existsSync(path.join(ctx.repoRoot, "node_modules"))) {
    runNpm(["install"], { cwd: ctx.repoRoot, env: ctx.env });
  }
  if (!fs.existsSync(ctx.cliMain)) {
    throw new Error(`dynamic-node-cli not found: ${ctx.cliMain}`);
  }
  if (!fs.existsSync(path.join(ctx.cliRoot, "node_modules"))) {
    runNpm(["install"], { cwd: ctx.cliRoot, env: ctx.env });
  }
}

function cli(ctx, args, options = {}) {
  ensureDependencies(ctx);
  return run(process.execPath, [ctx.cliMain, ...args], {
    cwd: ctx.cliRoot,
    env: ctx.env,
    ...options,
  });
}

function cliOutput(ctx, args) {
  return cli(ctx, args, { encoding: "utf8" }).stdout.trim();
}

function runNpm(args, options = {}) {
  if (process.platform === "win32") {
    return run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm", ...args], options);
  }
  return run("npm", args, options);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.encoding ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: options.encoding,
    shell: false,
  });
  if (result.error || result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr}` : "";
    throw new Error(
      `command failed: ${command} ${args.join(" ")} (${result.error?.message ?? result.status})${stderr}`,
    );
  }
  return result;
}

function getToolchain(ctx, variant) {
  return {
    os: cliOutput(ctx, ["toolchain", "describe", "os"]),
    arch: cliOutput(ctx, ["toolchain", "describe", "arch"]),
    compiler: cliOutput(ctx, ["toolchain", "describe", "compiler"]),
    variant,
  };
}

function setRuntimeToolchain(ctx, variant) {
  const toolchain = getToolchain(ctx, variant);
  dynamic.toolchain.setOS(toolchain.os);
  dynamic.toolchain.setArch(toolchain.arch);
  dynamic.toolchain.setCompiler(toolchain.compiler);
  dynamic.toolchain.setVariant(toolchain.variant);
  return toolchain;
}

function writeConfig(ctx) {
  ensureDependencies(ctx);
  const bundle = getToolchain(ctx, "bundle");
  const full = getToolchain(ctx, "full");
  const warehouse = toPosix(ctx.warehouseDir);
  const examples = toPosix(ctx.examplesDir);

  const content = `environments:
  - name: bundle-env
    toolchain:
      os: ${bundle.os}
      arch: ${bundle.arch}
      compiler: ${bundle.compiler}
      variant: bundle
    warehouse:
      local: ${warehouse}
      remote:
        - ${ctx.remote}
  - name: full-env
    toolchain:
      os: ${full.os}
      arch: ${full.arch}
      compiler: ${full.compiler}
      variant: full
    warehouse:
      local: ${warehouse}
      remote:
        - ${ctx.remote}

procedures:
  - name: sample-bundle
    environment: bundle-env
    source:
      module: ${examples}
      package: sample-app
      version: latest
    target:
      namespace: test
      package: bundle
      version: ${ctx.testId}
  - name: sample-full
    environment: full-env
    source:
      module: ${examples}
      package: sample-app
      version: latest
    target:
      namespace: test
      package: full
      version: ${ctx.testId}
  - name: service-bundle
    environment: bundle-env
    source:
      module: ${examples}
      package: service-app
      version: latest
    target:
      namespace: test
      package: service-bundle
      version: ${ctx.testId}
  - name: service-full
    environment: full-env
    source:
      module: ${examples}
      package: service-app
      version: latest
    target:
      namespace: test
      package: service-full
      version: ${ctx.testId}
  - name: wire-bundle
    environment: bundle-env
    source:
      module: ${examples}
      package: wire-app
      version: latest
    target:
      namespace: test
      package: wire-bundle
      version: ${ctx.testId}
  - name: wire-full
    environment: full-env
    source:
      module: ${examples}
      package: wire-app
      version: latest
    target:
      namespace: test
      package: wire-full
      version: ${ctx.testId}
`;

  fs.mkdirSync(path.dirname(ctx.configPath), { recursive: true });
  fs.writeFileSync(ctx.configPath, content);
  printContext(ctx);
  console.log(`created ${ctx.configPath}`);
}

function ensureConfig(ctx) {
  if (!fs.existsSync(ctx.configPath)) {
    writeConfig(ctx);
  }
}

function ensureBuilt(ctx) {
  ensureConfig(ctx);
  if (!hasAllTargetZips(ctx)) {
    cli(ctx, ["build", "-c", ctx.configPath]);
  }
}

function hasAllTargetZips(ctx) {
  return TARGET_PACKAGES.every((targetPackage) => Boolean(findTargetZip(ctx, targetPackage)));
}

function findTargetZip(ctx, targetPackage) {
  const matches = findArtifacts(ctx, `libnode_test_${targetPackage}_${ctx.testId}.zip`);
  return matches[0] || "";
}

function assertAllTargetZips(ctx) {
  for (const targetPackage of TARGET_PACKAGES) {
    assert.ok(findTargetZip(ctx, targetPackage), `${targetPackage} zip was not created`);
  }
}

function findArtifacts(ctx, pattern) {
  if (!fs.existsSync(ctx.warehouseDir)) {
    return [];
  }
  const matcher = globToRegExp(pattern);
  const matches = [];
  walk(ctx.warehouseDir, (filePath) => {
    if (matcher.test(path.basename(filePath))) {
      matches.push(filePath);
    }
  });
  return matches.sort();
}

function listArtifacts(ctx) {
  if (!fs.existsSync(ctx.warehouseDir)) {
    return;
  }
  const files = [];
  walk(ctx.warehouseDir, (filePath) => files.push(filePath));
  for (const file of files.sort()) {
    console.log(file);
  }
}

async function getRuntimePackage(ctx, targetPackage, remote = "") {
  const variant = targetPackage.endsWith("bundle") || targetPackage === "bundle" ? "bundle" : "full";
  applyDynamicEnv(ctx);
  setRuntimeToolchain(ctx, variant);
  dynamic.useWarehouse(ctx.warehouseDir, remote);
  dynamic.useNamespace("test");
  return dynamic.getPackage(targetPackage, ctx.testId);
}

async function clearRuntimePackages(ctx) {
  dynamic.useNamespace("test");
  for (const targetPackage of TARGET_PACKAGES) {
    await dynamic.closePackage(targetPackage, ctx.testId);
    await dynamic.tunnelCenter.closeTunnel(`test_${targetPackage}_${ctx.testId}`);
  }
}

async function invokeJSON(tunnel, route, payload) {
  const response = await callTunnel(tunnel, "invoke", route, JSON.stringify(payload));
  return JSON.parse(response);
}

async function invokeService(tunnel, route, payload) {
  const response = await callTunnel(tunnel, "invoke", route, encodeEnvelope(payload));
  return decodeEnvelope(response);
}

async function invokeServiceHTTP(tunnel, targetPackage) {
  const server = http.createServer(async (req, res) => {
    try {
      const bodyText = await readBody(req);
      const payload = bodyText ? JSON.parse(bodyText) : {};
      const url = new URL(req.url, "http://dynamic-node.local");
      const responseEnvelope = await callTunnel(
        tunnel,
        "invoke",
        url.pathname,
        encodeEnvelope(payload, {
          method: req.method,
          url: req.url,
          target: targetPackage,
        }),
      );
      const envelope = decodeEnvelope(responseEnvelope);

      res.statusCode = envelope.meta.Error ? 500 : 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        mode: targetPackage,
        meta: envelope.meta,
        payload: envelope.payload,
      }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain");
      res.end(err && err.stack ? err.stack : String(err));
    }
  });

  try {
    const baseUrl = await listen(server);
    const response = await fetch(`${baseUrl}/greet-user`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dynamic-node-target": targetPackage,
      },
      body: JSON.stringify({ name: targetPackage }),
    });
    const text = await response.text();
    console.log(`HTTP ${targetPackage} response: ${text}`);
    const body = JSON.parse(text);

    assert.equal(response.status, 200);
    assert.equal(body.mode, targetPackage);
    assert.equal(body.meta.handler, "greetUser");
    assert.equal(body.payload.message, `hello ${targetPackage}`);
    assert.equal(body.payload.route, "/greet-user");
    return body;
  } finally {
    await closeServer(server);
  }
}

async function callTunnel(tunnel, lower, ...args) {
  const upper = lower[0].toUpperCase() + lower.slice(1);
  const fn = typeof tunnel[lower] === "function" ? tunnel[lower] : tunnel[upper];
  if (typeof fn !== "function") {
    throw new Error(`tunnel does not implement ${lower}/${upper}`);
  }
  return fn.apply(tunnel, args);
}

function encodeEnvelope(payload, meta = {}) {
  return JSON.stringify({
    meta,
    data: Buffer.from(JSON.stringify(payload)).toString("base64"),
  });
}

function decodeEnvelope(raw) {
  const envelope = JSON.parse(raw || "{}");
  const text = Buffer.from(envelope.data || "", "base64").toString("utf8");
  return {
    meta: envelope.meta || {},
    payload: text ? JSON.parse(text) : null,
  };
}

async function invokeWire(tunnel, targetPackage) {
  const server = http.createServer(async (req, res) => {
    try {
      await callTunnel(tunnel, "invoke", "/wire", { req, res });
    } catch (err) {
      res.statusCode = 500;
      res.end(err && err.stack ? err.stack : String(err));
    }
  });

  try {
    const baseUrl = await listen(server);
    const response = await fetch(`${baseUrl}/hello?case=${encodeURIComponent(targetPackage)}`, {
      headers: { "x-dynamic-node-target": targetPackage },
    });
    const text = await response.text();
    console.log(`HTTP ${targetPackage} response: ${text}`);
    const body = JSON.parse(text);
    assert.equal(response.status, 200);
    assert.equal(body.message, "hello wire-node");
    assert.equal(body.method, "GET");
    assert.equal(body.target, targetPackage);
    return body;
  } finally {
    await closeServer(server);
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function cleanGenerated(ctx) {
  for (const target of [
    path.join(ctx.examplesDir, ".tmp"),
    ctx.warehouseDir,
    ctx.configPath,
    path.join(ctx.examplesDir, ".npm-cache"),
    path.join(ctx.examplesDir, "sample-app", "node_modules"),
    path.join(ctx.examplesDir, "service-app", "node_modules"),
    path.join(ctx.examplesDir, "wire-app", "node_modules"),
    path.join(ctx.examplesDir, "sample-app", "package-lock.json"),
    path.join(ctx.examplesDir, "service-app", "package-lock.json"),
    path.join(ctx.examplesDir, "wire-app", "package-lock.json"),
  ]) {
    removePath(target);
  }
}

function printContext(ctx) {
  console.log(`REPO_ROOT=${ctx.repoRoot}`);
  console.log(`CLI_ROOT=${ctx.cliRoot}`);
  console.log(`WAREHOUSE_DIR=${ctx.warehouseDir}`);
  console.log(`CONFIG_PATH=${ctx.configPath}`);
  console.log(`TEST_ID=${ctx.testId}`);
  console.log(`REMOTE=${ctx.remote}`);
  if (ctx.env.AWS_ENDPOINT_URL || ctx.env.AWS_ENDPOINT_URL_S3) {
    console.log(`AWS_ENDPOINT_URL=${ctx.env.AWS_ENDPOINT_URL || ctx.env.AWS_ENDPOINT_URL_S3}`);
  }
}

async function startDockerS3(ctx) {
  const port = await getFreePort();
  const container = `dynamic-node-s3-${sanitizeDockerName(ctx.testId)}`;
  const image = ctx.env.DYNAMIC_NODE_TEST_S3_IMAGE || "minio/minio:latest";
  const accessKey = ctx.env.AWS_ACCESS_KEY_ID || "minioadmin";
  const secretKey = ctx.env.AWS_SECRET_ACCESS_KEY || "minioadmin";

  try {
    run("docker", ["rm", "-f", container], {
      cwd: ctx.repoRoot,
      env: ctx.env,
      encoding: "utf8",
    });
  } catch {
    // Container may not exist before the first run.
  }

  run(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--name",
      container,
      "-e",
      `MINIO_ROOT_USER=${accessKey}`,
      "-e",
      `MINIO_ROOT_PASSWORD=${secretKey}`,
      "-p",
      `127.0.0.1:${port}:9000`,
      image,
      "server",
      "/data",
      "--console-address",
      ":9001",
    ],
    { cwd: ctx.repoRoot, env: ctx.env },
  );

  const endpoint = `http://127.0.0.1:${port}`;
  await waitForHttp(`${endpoint}/minio/health/ready`);

  const dockerEnv = {
    ...ctx.env,
    AWS_ACCESS_KEY_ID: accessKey,
    AWS_SECRET_ACCESS_KEY: secretKey,
    AWS_REGION: "us-east-1",
    AWS_ENDPOINT_URL: endpoint,
    AWS_S3_FORCE_PATH_STYLE: "true",
    DYNAMIC_NODE_TEST_REMOTE: `s3://dynamic-node-test/${ctx.testId}`,
  };
  const dockerCtx = createContext(dockerEnv);
  await createBucket(dockerCtx);

  return {
    ctx: dockerCtx,
    endpoint,
    container,
    stop() {
      run("docker", ["stop", container], {
        cwd: ctx.repoRoot,
        env: ctx.env,
        encoding: "utf8",
      });
    },
  };
}

async function createBucket(ctx) {
  const parsed = parseS3Uri(ctx.remote);
  const client = createS3Client(ctx);
  await client.send(new CreateBucketCommand({ Bucket: parsed.bucket })).catch((err) => {
    if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(err.name)) {
      throw err;
    }
  });
}

async function cleanupRemote(ctx, { deleteBucket = false } = {}) {
  const parsed = parseS3Uri(ctx.remote);
  const client = createS3Client(ctx);

  for (;;) {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: parsed.bucket,
        Prefix: parsed.prefix,
      }),
    );
    const objects = (page.Contents || [])
      .filter((item) => item.Key)
      .map((item) => ({ Key: item.Key }));
    if (objects.length === 0) {
      break;
    }
    await client.send(
      new DeleteObjectsCommand({
        Bucket: parsed.bucket,
        Delete: { Objects: objects, Quiet: true },
      }),
    );
  }

  if (deleteBucket) {
    await client.send(new DeleteBucketCommand({ Bucket: parsed.bucket })).catch((err) => {
      if (err.name !== "NoSuchBucket") {
        throw err;
      }
    });
  }
}

function createS3Client(ctx) {
  const endpoint = ctx.env.AWS_ENDPOINT_URL_S3 || ctx.env.AWS_ENDPOINT_URL || "";
  return new S3Client({
    region: ctx.env.AWS_REGION || "us-east-1",
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: ctx.env.AWS_ACCESS_KEY_ID && ctx.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: ctx.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: ctx.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  });
}

function applyDynamicEnv(ctx) {
  // The CLI build/push commands run as child processes and receive ctx.env
  // automatically. Runtime loading happens in this Node process, so S3-compatible
  // endpoints such as Docker MinIO must be mirrored into process.env before
  // dynamic-node creates its AWS SDK client.
  for (const key of [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_REGION",
    "AWS_ENDPOINT_URL",
    "AWS_ENDPOINT_URL_S3",
    "AWS_S3_FORCE_PATH_STYLE",
    "S3_FORCE_PATH_STYLE",
    "DYNAMIC_NODE_S3_ENDPOINT",
    "DYNAMIC_NODE_S3_FORCE_PATH_STYLE",
  ]) {
    if (ctx.env[key] !== undefined) {
      process.env[key] = ctx.env[key];
    }
  }
}

function parseS3Uri(value) {
  const url = new URL(value.includes("://") ? value : `s3://${value}`);
  const bucket = url.hostname;
  const rawPrefix = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  const prefix = rawPrefix ? `${rawPrefix}/` : "";
  return { bucket, prefix };
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url) {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`S3 container did not become ready: ${lastError?.message || "timeout"}`);
}

function walk(root, visit) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walk(current, visit);
      continue;
    }
    visit(current);
  }
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function sanitizeDockerName(value) {
  return value.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "manual";
}

function ok(message) {
  console.log(`ok: ${message}`);
}

module.exports = {
  assert,
  dynamic,
  TARGET_PACKAGES,
  createContext,
  ensureDependencies,
  cli,
  cliOutput,
  run,
  runNpm,
  getToolchain,
  setRuntimeToolchain,
  writeConfig,
  ensureConfig,
  ensureBuilt,
  hasAllTargetZips,
  findTargetZip,
  assertAllTargetZips,
  listArtifacts,
  getRuntimePackage,
  clearRuntimePackages,
  invokeJSON,
  invokeService,
  invokeServiceHTTP,
  invokeWire,
  callTunnel,
  removePath,
  cleanGenerated,
  startDockerS3,
  cleanupRemote,
  ok,
};
