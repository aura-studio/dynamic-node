/**
 * example/basic/app.js
 *
 * 最简示例 — 静态注册 Tunnel，不走 S3 仓库。
 *
 * 安装方式（引用 GitHub 上的库）：
 *   npm install github:aura-studio/dynamic-node
 *
 * 或在 package.json 中：
 *   "dependencies": {
 *     "@aura-studio/dynamic-node": "github:aura-studio/dynamic-node"
 *   }
 */

const { registerPackage, getPackage, closePackage, Template } = require("@aura-studio/dynamic-node");

// 实现自己的 Tunnel（继承 Template 空实现）
class HelloTunnel extends Template {
  meta() {
    return "hello-tunnel-v1";
  }

  async invoke(route, req) {
    const request = JSON.parse(req);
    console.log(`[HelloTunnel] routing: ${route}`);
    console.log(`[HelloTunnel] request: ${JSON.stringify(request)}`);

    return JSON.stringify({
      message: `Hello from dynamic-node, ${request.name || "World"}!`,
      route,
      tunnel: this.meta(),
    });
  }
}

// ============================================================
// 不使用 S3 仓库，纯静态注册方式
// ============================================================
async function main() {
  // 注册一个静态包
  await registerPackage("hello-world", "v1", new HelloTunnel());

  // 获取并调用
  const tunnel = await getPackage("hello-world", "v1");
  console.log("[main] tunnel meta:", tunnel.meta());

  const resp = await tunnel.invoke("greet", JSON.stringify({ name: "developer" }));
  console.log("[main] response:", resp);

  // 关闭
  await closePackage("hello-world", "v1");
  console.log("[main] done");
}

main().catch(console.error);