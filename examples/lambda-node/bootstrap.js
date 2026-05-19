/**
 * example/lambda-node/bootstrap.js
 *
 * Lambda 启动入口 — 读取 lambda-node.yaml, 初始化 dynamic-node。
 *
 * 此示例演示上层 lambda 工程如何:
 *   1) 解析 lambda-node.yaml 配置文件
 *   2) 将 YAML 配置映射到 dynamic-node API 调用
 *   3) 预加载指定的包
 *   4) 处理 Lambda 事件
 *
 * 使用方式:
 *   node bootstrap.js
 *
 * 或通过环境变量覆盖 toolchain:
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
  Template,
  toolchain,
} = require("@aura-studio/dynamic-node");

// ============================================================
// 1. 解析配置文件
// ============================================================
const configPath = path.join(__dirname, "lambda-node.yaml");
const rawYaml = fs.readFileSync(configPath, "utf-8");
const config = YAML.parse(rawYaml);

console.log("=== lambda-node.yaml ===");
console.log(JSON.stringify(config, null, 2));
console.log("");

// ============================================================
// 2. 映射 YAML → dynamic-node API
// ============================================================
const dyncfg = config.dynamic;

// 2a. Toolchain — 手动设置(优先) 或 环境变量 或 自动检测
const tc = dyncfg.environment.toolchain;
if (tc.os) toolchain.setOS(tc.os);
if (tc.arch) toolchain.setArch(tc.arch);
if (tc.compiler) toolchain.setCompiler(tc.compiler);
if (tc.variant) toolchain.setVariant(tc.variant);

console.log("toolchain:", toolchain.toString());

// 2b. Warehouse — 本地仓库 + S3 远程仓库
const wh = dyncfg.environment.warehouse;
useWarehouse(wh.local, wh.remote || "");
console.log("warehouse:", wh.local, wh.remote ? `→ ${wh.remote}` : "(local only)");

// 2c. Package — 命名空间 + 默认版本
const pkgCfg = dyncfg.package;
useNamespace(pkgCfg.namespace || "default");
useDefaultVersion(pkgCfg.defaultVersion || "default");
console.log("namespace:", pkgCfg.namespace, "defaultVersion:", pkgCfg.defaultVersion);
console.log("");

// ============================================================
// 3. 静态注册 (不需要走 S3 的内置隧道)
// ============================================================
class BuiltinPing extends Template {
  meta() { return "builtin-ping"; }
  async invoke(route, req) {
    return JSON.stringify({ pong: true, route, timestamp: new Date().toISOString() });
  }
}

registerPackage("ping", "v1", new BuiltinPing());
console.log("[init] registered builtin ping@v1");

// ============================================================
// 4. 预加载 (从 S3 拉取)
// ============================================================
async function preloadPackages(packages) {
  for (const entry of packages) {
    try {
      const tunnel = await getPackage(entry.package, entry.version);
      console.log(`[init] preloaded ${entry.package}@${entry.version} — ${tunnel.meta()}`);
    } catch (err) {
      console.log(`[init] preload ${entry.package}@${entry.version} failed: ${err.message}`);
    }
  }
}

// ============================================================
// 5. Lambda 事件处理
// ============================================================
async function handleEvent(event) {
  const { route, pkg, version } = event;

  // 获取包
  const tunnel = await getPackage(pkg || "ping", version || "v1");

  // 调用
  const req = JSON.stringify(event.body || {});
  const resp = await tunnel.invoke(route || "/", req);

  // 返回 Lambda 响应格式
  return {
    statusCode: 200,
    body: JSON.parse(resp),
  };
}

// ============================================================
// 6. 启动
// ============================================================
async function bootstrap() {
  console.log("=== Bootstrapping Lambda ===");
  console.log("");

  // 预加载
  await preloadPackages(pkgCfg.preload || []);

  console.log("");
  console.log("=== Ready ===");
  console.log("");

  // 模拟事件处理
  console.log("--- Simulating event ---");
  const event = {
    pkg: "hello",
    version: "v1",
    route: "/hello",
    body: { name: "LambdaUser" },
  };

  try {
    const result = await handleEvent(event);
    console.log("Lambda response:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.log("Lambda error:", err.message);
  }

  // 内置 ping 测试
  console.log("");
  console.log("--- Builtin ping test ---");
  const pingResult = await handleEvent({ route: "/ping" });
  console.log("Ping response:", JSON.stringify(pingResult, null, 2));
}

bootstrap().catch(console.error);