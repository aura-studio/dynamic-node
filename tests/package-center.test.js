const {
  PackageCenter,
  packageCenter: singleton,
} = require("../src/package-center");
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
      return JSON.stringify({ name, route, request });
    },
    meta() {
      return JSON.stringify({ name });
    },
    close() {
      calls.push("close");
    },
  };
}

function makeCenter() {
  return new PackageCenter(new TunnelCenter({
    async load() {
      throw new Error("dynamic: warehouse package not exists");
    },
  }));
}

describe("PackageCenter", () => {
  let center;

  beforeEach(() => {
    center = makeCenter();
  });

  describe("useNamespace / useDefaultVersion", () => {
    it("defaults to 'default' namespace and version", async () => {
      const tunnel = makeTunnel("test-pkg");
      await center.registerPackage("pkg", "v1", tunnel);
      const result = await center.getPackage("pkg", "v1");
      expect(result).toBe(tunnel);
    });

    it("uses custom namespace", async () => {
      center.useNamespace("myorg");
      const tunnel = makeTunnel("myorg-pkg");
      await center.registerPackage("pkg", "v1", tunnel);
      const result = await center.getPackage("pkg", "v1");
      expect(result).toBe(tunnel);
    });

    it("uses custom defaultVersion as fallback", async () => {
      center.useDefaultVersion("stable");
      const tunnel = makeTunnel("stable-pkg");
      await center.registerPackage("pkg", "stable", tunnel);

      const result = await center.getPackage("pkg", "latest");
      expect(result).toBe(tunnel);
    });
  });

  describe("registerPackage", () => {
    it("registers, initializes, and returns a tunnel", async () => {
      const tunnel = makeTunnel("myapp");
      await center.registerPackage("myapp", "v1", tunnel);

      const result = await center.getPackage("myapp", "v1");
      expect(result).toBe(tunnel);
      expect(tunnel.calls).toEqual(["init"]);
    });

    it("overwrites existing package with same key", async () => {
      const tunnel1 = makeTunnel("v1");
      const tunnel2 = makeTunnel("v2");
      await center.registerPackage("app", "v1", tunnel1);
      await center.registerPackage("app", "v1", tunnel2);

      const result = await center.getPackage("app", "v1");
      expect(result).toBe(tunnel2);
    });

    it("rejects values that are not TunnelNode compatible", async () => {
      await expect(
        center.registerPackage("obj", "v1", { foo: "bar" })
      ).rejects.toThrow("symbol is not a Tunnel");
    });
  });

  describe("getPackage", () => {
    it("returns cached tunnel", async () => {
      const tunnel = makeTunnel("cached");
      await center.registerPackage("cached", "v1", tunnel);

      const result1 = await center.getPackage("cached", "v1");
      const result2 = await center.getPackage("cached", "v1");
      expect(result1).toBe(tunnel);
      expect(result2).toBe(tunnel);
    });

    it("throws when neither version found", async () => {
      await expect(
        center.getPackage("nonexistent", "v999")
      ).rejects.toThrow("both provided version and default version not found");
    });
  });

  describe("closePackage", () => {
    it("closes and removes package-center cache", async () => {
      const tunnel = makeTunnel("temp");
      await center.registerPackage("temp", "v1", tunnel);

      await center.closePackage("temp", "v1");

      expect(tunnel.calls).toEqual(["init", "close"]);
    });

    it("does nothing for non-existent package", async () => {
      await expect(
        center.closePackage("nonexistent", "v1")
      ).resolves.toBeUndefined();
    });
  });

  describe("version fallback chain", () => {
    it("prioritizes exact version over default", async () => {
      center.useDefaultVersion("default");
      const exact = makeTunnel("exact");
      const def = makeTunnel("default");
      await center.registerPackage("app", "v2", exact);
      await center.registerPackage("app", "default", def);

      const result = await center.getPackage("app", "v2");
      expect(result.name).toBe("exact");
    });

    it("falls back to default version when exact not found", async () => {
      center.useDefaultVersion("default");
      const def = makeTunnel("default");
      await center.registerPackage("app", "default", def);

      const result = await center.getPackage("app", "v99");
      expect(result.name).toBe("default");
    });
  });

  describe("multi-package coexistence", () => {
    it("stores two different packages independently", async () => {
      const tunnelA = makeTunnel("pkg-a");
      const tunnelB = makeTunnel("pkg-b");
      await center.registerPackage("a", "v1", tunnelA);
      await center.registerPackage("b", "v1", tunnelB);

      const resultA = await center.getPackage("a", "v1");
      const resultB = await center.getPackage("b", "v1");

      expect(resultA.name).toBe("pkg-a");
      expect(resultB.name).toBe("pkg-b");
      expect(resultA).not.toBe(resultB);
    });

    it("stores two versions of same package as separate entries", async () => {
      const tunnelV1 = makeTunnel("v1");
      const tunnelV2 = makeTunnel("v2");
      await center.registerPackage("svc", "v1", tunnelV1);
      await center.registerPackage("svc", "v2", tunnelV2);

      const resultV1 = await center.getPackage("svc", "v1");
      const resultV2 = await center.getPackage("svc", "v2");

      expect(resultV1.name).toBe("v1");
      expect(resultV2.name).toBe("v2");
      expect(resultV1).not.toBe(resultV2);
    });

    it("version fallback correctly backfills both keys", async () => {
      center.useDefaultVersion("default");
      const def = makeTunnel("default");
      await center.registerPackage("app", "default", def);

      await center.getPackage("app", "v99");

      const direct = await center.getPackage("app", "default");
      const backfill = await center.getPackage("app", "v99");

      expect(direct).toBe(def);
      expect(backfill).toBe(def);
    });

    it("changing namespace later does not affect previously loaded packages", async () => {
      center.useNamespace("ns-a");
      const tunnelA = makeTunnel("ns-a-mod");
      await center.registerPackage("pkg", "v1", tunnelA);

      center.useNamespace("ns-b");
      const tunnelB = makeTunnel("ns-b-mod");
      await center.registerPackage("pkg", "v1", tunnelB);

      center.useNamespace("ns-a");
      const resultA = await center.getPackage("pkg", "v1");
      expect(resultA.name).toBe("ns-a-mod");

      center.useNamespace("ns-b");
      const resultB = await center.getPackage("pkg", "v1");
      expect(resultB.name).toBe("ns-b-mod");
    });

    it("closing one package does not affect others", async () => {
      const tunnelKeep = makeTunnel("keep-me");
      const tunnelDrop = makeTunnel("drop-me");
      await center.registerPackage("keep", "v1", tunnelKeep);
      await center.registerPackage("drop", "v1", tunnelDrop);

      await center.closePackage("drop", "v1");

      const result = await center.getPackage("keep", "v1");
      expect(result.name).toBe("keep-me");
    });
  });

  describe("singleton", () => {
    it("is a shared instance", () => {
      expect(singleton).toBeDefined();
    });
  });
});
