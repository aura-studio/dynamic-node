const { TunnelCenter } = require("../src/tunnel-center");

function makeTunnel(name) {
  const calls = [];
  return {
    name,
    calls,
    init() {
      calls.push("init");
    },
    async invoke(route, request) {
      return `${name}:${route}:${request}`;
    },
    meta() {
      return JSON.stringify({ name });
    },
    close() {
      calls.push("close");
    },
  };
}

describe("TunnelCenter", () => {
  it("loads exports.Tunnel and initializes once", async () => {
    const tunnel = makeTunnel("direct");
    const center = new TunnelCenter({
      async load(name) {
        expect(name).toBe("default_pkg_v1");
        return { Tunnel: tunnel };
      },
    });

    const first = await center.getTunnel("default_pkg_v1");
    const second = await center.getTunnel("default_pkg_v1");

    expect(first).toBe(tunnel);
    expect(second).toBe(tunnel);
    expect(tunnel.calls).toEqual(["init"]);
  });

  it("loads exports.New and validates the returned tunnel", async () => {
    const tunnel = makeTunnel("factory");
    const center = new TunnelCenter({
      async load() {
        return { New: () => tunnel };
      },
    });

    expect(await center.getTunnel("default_pkg_v1")).toBe(tunnel);
  });

  it("rejects modules without Tunnel or New", async () => {
    const center = new TunnelCenter({
      async load() {
        return { handler() {} };
      },
    });

    await expect(center.getTunnel("default_pkg_v1")).rejects.toThrow(
      "symbol is not a Tunnel"
    );
  });

  it("closes and removes cached tunnels", async () => {
    const tunnel = makeTunnel("closable");
    const center = new TunnelCenter({
      async load() {
        return { Tunnel: tunnel };
      },
    });

    await center.getTunnel("default_pkg_v1");
    await center.closeTunnel("default_pkg_v1");

    expect(tunnel.calls).toEqual(["init", "close"]);
  });
});
