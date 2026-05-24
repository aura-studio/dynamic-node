"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  assert,
  dynamic,
  TARGET_PACKAGES,
  assertAllTargetZips,
  callTunnel,
  cleanupRemote,
  cleanGenerated,
  clearRuntimePackages,
  cli,
  createContext,
  ensureBuilt,
  ensureConfig,
  ensureDependencies,
  getRuntimePackage,
  invokeJSON,
  invokeService,
  invokeServiceHTTP,
  invokeWire,
  listArtifacts,
  removePath,
  runNpm,
  setRuntimeToolchain,
  startDockerS3,
  writeConfig,
  ok,
} = require("./common");

const steps = new Map([
  ["00-clean", stepClean],
  ["01-smoke", stepSmoke],
  ["02-build-all", stepBuildAll],
  ["03-local", stepLocal],
  ["04-service", stepService],
  ["05-wire", stepWire],
  ["06-default-version", stepDefaultVersion],
  ["07-validation-errors", stepValidationErrors],
  ["08-remote-s3", stepRemoteS3],
  ["99-run-all-local", runAllLocal],
  ["99-run-all-with-s3", runAllWithS3],
  ["99-run-all-docker-s3", runAllWithDockerS3],
]);

async function runStep(name, env = process.env) {
  const step = steps.get(name);
  if (!step) {
    throw new Error(`unknown example step: ${name}`);
  }
  const ctx = createContext(env);
  await step(ctx);
}

async function main(defaultStep) {
  const step = process.argv[2] || defaultStep;
  try {
    await runStep(step);
  } catch (err) {
    console.error("error:", err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

async function stepClean(ctx) {
  cleanGenerated(ctx);
  ok("generated example files removed");
}

async function stepSmoke(ctx) {
  ensureDependencies(ctx);
  runNpm(["test"], { cwd: ctx.repoRoot, env: ctx.env });
  cli(ctx, ["--help"]);
  cli(ctx, ["version"]);
  cli(ctx, ["toolchain", "describe", "all"]);

  for (const name of [
    "useWarehouse",
    "useNamespace",
    "useDefaultVersion",
    "registerPackage",
    "getPackage",
    "getTunnel",
    "closePackage",
    "isTunnelNode",
    "assertTunnelNode",
    "callTunnelInit",
    "callTunnelInvoke",
    "callTunnelMeta",
    "callTunnelClose",
    "isPackageNotExist",
  ]) {
    assert.equal(typeof dynamic[name], "function", `${name} should be exported`);
  }
  for (const name of [
    "Template",
    "Tunnel",
    "TunnelNode",
    "TunnelCenter",
    "PackageCenter",
    "Dynamic",
    "DynamicIndex",
    "PackageNotExistError",
  ]) {
    assert.equal(typeof dynamic[name], "function", `${name} should be exported`);
  }
  assert.ok(dynamic.toolchain);
  assert.ok(dynamic.allowed);
  assert.ok(dynamic.AllowedType);

  const template = new dynamic.Template();
  assert.equal(dynamic.isTunnelNode(template), true);
  assert.equal(await template.Invoke("/smoke", ""), "");

  ok("smoke test passed");
}

async function stepBuildAll(ctx) {
  ensureConfig(ctx);
  cli(ctx, ["build", "-c", ctx.configPath]);
  listArtifacts(ctx);
  assertAllTargetZips(ctx);
  ok("dynamic-node-cli artifacts built");
}

async function stepLocal(ctx) {
  ensureBuilt(ctx);

  for (const targetPackage of ["bundle", "full"]) {
    console.log(`--- testing invokeJSON [${targetPackage}] ---`);
    const tunnel = await getRuntimePackage(ctx, targetPackage);
    const response = await invokeJSON(tunnel, `/${targetPackage}`, { name: targetPackage });
    assert.equal(response.message, `hello ${targetPackage}`);
    assert.equal(response.initialized, true);
    assert.equal(response.route, `/${targetPackage}`);
    assert.equal(typeof response.platform, "string");
    assert.equal(typeof response.node, "string");
    console.log(JSON.stringify(response));
    const meta = await callTunnel(tunnel, "meta");
    const metaObject = typeof meta === "string" ? JSON.parse(meta) : meta;
    assert.equal(metaObject.dynamic.package, "sample-app");
    await callTunnel(tunnel, "close");
  }

  ok("local bundle/full packages loaded by dynamic-node");
}

async function stepService(ctx) {
  ensureBuilt(ctx);

  for (const targetPackage of ["service-bundle", "service-full"]) {
    console.log(`--- testing invokeService [${targetPackage}] ---`);
    const tunnel = await getRuntimePackage(ctx, targetPackage);
    const envelope = await invokeService(tunnel, "/greet-user", { name: targetPackage });
    console.log(JSON.stringify(envelope));
    assert.equal(envelope.meta.handler, "greetUser");
    assert.equal(envelope.payload.message, `hello ${targetPackage}`);
    assert.equal(envelope.payload.route, "/greet-user");
    await invokeServiceHTTP(tunnel, targetPackage);
    await callTunnel(tunnel, "close");
  }

  ok("service-node wrapped bundle/full packages loaded by dynamic-node");
}

async function stepWire(ctx) {
  ensureBuilt(ctx);

  for (const targetPackage of ["wire-bundle", "wire-full"]) {
    console.log(`--- testing invokeWire [${targetPackage}] ---`);
    const tunnel = await getRuntimePackage(ctx, targetPackage);
    await invokeWire(tunnel, targetPackage);
    await callTunnel(tunnel, "close");
  }

  ok("wire-node wrapped bundle/full packages loaded by dynamic-node");
}

async function stepDefaultVersion(ctx) {
  ensureBuilt(ctx);
  setRuntimeToolchain(ctx, "bundle");
  dynamic.useWarehouse(ctx.warehouseDir, "");
  dynamic.useNamespace("test");
  dynamic.useDefaultVersion(ctx.testId);
  const tunnel = await dynamic.getPackage("bundle", "latest");
  const response = await invokeJSON(tunnel, "/fallback", { name: "fallback" });
  assert.equal(response.message, "hello fallback");
  ok("default version fallback works");
}

async function stepValidationErrors(ctx) {
  assert.throws(() => dynamic.useWarehouse("", "s3://bucket"), /invalid warehouse configuration/);
  assert.throws(() => dynamic.useWarehouse("INVALID PATH?", ""), /invalid local warehouse path/);
  assert.throws(() => dynamic.useNamespace("Invalid_Namespace"), /invalid package namespace/);
  assert.throws(() => dynamic.useDefaultVersion("Invalid_Version"), /invalid default package version/);
  await assert.rejects(dynamic.getPackage("Invalid_Package", "v1"), /invalid package name/);
  await assert.rejects(dynamic.getPackage("valid", "Invalid_Version"), /invalid package version/);
  ok("validation errors match dynamic constraints");
}

async function stepRemoteS3(ctx) {
  const hasS3Config = ctx.remoteWasExplicit || ctx.env.AWS_ENDPOINT_URL || ctx.env.AWS_ENDPOINT_URL_S3;
  let docker = null;
  let runCtx = ctx;
  if (!hasS3Config) {
    docker = await startDockerS3(ctx);
    runCtx = docker.ctx;
    console.log(`docker s3 endpoint: ${docker.endpoint}`);
  }

  try {
    ensureBuilt(runCtx);
    cli(runCtx, ["push", "-c", runCtx.configPath]);
    await clearRuntimePackages(runCtx);
    removePath(runCtx.warehouseDir);

    for (const targetPackage of TARGET_PACKAGES) {
      console.log(`--- testing S3 remote [${targetPackage}] ---`);
      const tunnel = await getRuntimePackage(runCtx, targetPackage, runCtx.remote);
      if (targetPackage.startsWith("service-")) {
        const envelope = await invokeService(tunnel, "/greet-user", { name: targetPackage });
        assert.equal(envelope.payload.message, `hello ${targetPackage}`);
        await invokeServiceHTTP(tunnel, targetPackage);
      } else if (targetPackage.startsWith("wire-")) {
        await invokeWire(tunnel, targetPackage);
      } else {
        const response = await invokeJSON(tunnel, "/remote", { name: targetPackage });
        assert.equal(response.message, `hello ${targetPackage}`);
        console.log(JSON.stringify(response));
      }
      await callTunnel(tunnel, "close");
    }

    ok("S3 remote packages downloaded, extracted, and loaded");
  } finally {
    if (runCtx.env.DYNAMIC_NODE_TEST_KEEP_REMOTE !== "1") {
      await cleanupRemote(runCtx).catch((err) => {
        console.error(`warning: remote cleanup failed: ${err.message}`);
      });
    }
    if (docker && ctx.env.DYNAMIC_NODE_TEST_KEEP_DOCKER !== "1") {
      try {
        docker.stop();
      } catch (err) {
        console.error(`warning: docker stop failed: ${err.message}`);
      }
    }
  }
}

async function runAllLocal(ctx) {
  for (const name of [
    "00-clean",
    "01-smoke",
    "02-build-all",
    "03-local",
    "04-service",
    "05-wire",
    "06-default-version",
    "07-validation-errors",
  ]) {
    await steps.get(name)(ctx);
  }
  ok("all local examples passed");
}

async function runAllWithS3(ctx) {
  for (const name of [
    "00-clean",
    "01-smoke",
    "02-build-all",
    "03-local",
    "04-service",
    "05-wire",
    "06-default-version",
    "07-validation-errors",
    "08-remote-s3",
  ]) {
    await steps.get(name)(ctx);
  }
  ok("all examples with S3 passed");
}

async function runAllWithDockerS3(ctx) {
  const docker = await startDockerS3(ctx);
  try {
    await runAllWithS3(docker.ctx);
    console.log(`docker s3 endpoint: ${docker.endpoint}`);
    ok("all examples with Docker S3 passed");
  } finally {
    if (ctx.env.DYNAMIC_NODE_TEST_KEEP_DOCKER !== "1") {
      try {
        docker.stop();
      } catch (err) {
        console.error(`warning: docker stop failed: ${err.message}`);
      }
    }
  }
}

if (require.main === module) {
  main("99-run-all-local");
}

module.exports = { main, runStep };
