const { PackageCenter, packageCenter: singleton } = require("../src/package-center");

describe("PackageCenter", () => {
  let center;

  beforeEach(() => {
    center = new PackageCenter();
  });

  describe("useNamespace / useDefaultVersion", () => {
    it("defaults to 'default' namespace and version", async () => {
      const mod = { name: "test-pkg", version: "1.0" };
      await center.registerPackage("pkg", "v1", mod);
      const result = await center.getPackage("pkg", "v1");
      expect(result).toBe(mod);
    });

    it("uses custom namespace", async () => {
      center.useNamespace("myorg");
      const mod = { name: "myorg-pkg" };
      await center.registerPackage("pkg", "v1", mod);
      const result = await center.getPackage("pkg", "v1");
      expect(result).toBe(mod);
    });

    it("uses custom defaultVersion as fallback", async () => {
      center.useDefaultVersion("stable");
      const mod = { name: "stable-pkg" };
      await center.registerPackage("pkg", "stable", mod);

      const result = await center.getPackage("pkg", "latest");
      expect(result).toBe(mod);
    });
  });

  describe("registerPackage", () => {
    it("registers and returns via getPackage", async () => {
      const mod = { name: "myapp", handler: () => "response" };
      await center.registerPackage("myapp", "v1", mod);

      const result = await center.getPackage("myapp", "v1");
      expect(result).toBe(mod);
    });

    it("overwrites existing package with same key", async () => {
      const mod1 = { name: "v1" };
      const mod2 = { name: "v2" };
      await center.registerPackage("app", "v1", mod1);
      await center.registerPackage("app", "v1", mod2);

      const result = await center.getPackage("app", "v1");
      expect(result).toBe(mod2);
    });

    it("accepts any type of module exports", async () => {
      // Object
      await center.registerPackage("obj", "v1", { foo: "bar" });
      expect(await center.getPackage("obj", "v1")).toEqual({ foo: "bar" });

      // Function
      const fn = () => "hello";
      await center.registerPackage("fn", "v1", fn);
      expect(await center.getPackage("fn", "v1")).toBe(fn);

      // String
      await center.registerPackage("str", "v1", "just-a-string");
      expect(await center.getPackage("str", "v1")).toBe("just-a-string");
    });
  });

  describe("getPackage", () => {
    it("returns cached module", async () => {
      const mod = { name: "cached" };
      await center.registerPackage("cached", "v1", mod);

      const result1 = await center.getPackage("cached", "v1");
      const result2 = await center.getPackage("cached", "v1");
      expect(result1).toBe(mod);
      expect(result2).toBe(mod);
    });

    it("throws when neither version found", async () => {
      await expect(
        center.getPackage("nonexistent", "v999")
      ).rejects.toThrow("both provided version and default version not found");
    });
  });

  describe("closePackage", () => {
    it("removes from cache", async () => {
      const mod = { name: "temp" };
      await center.registerPackage("temp", "v1", mod);

      await center.closePackage("temp", "v1");

      await expect(
        center.getPackage("temp", "v1")
      ).rejects.toThrow("both provided version and default version not found");
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
      const exact = { name: "exact" };
      const def = { name: "default" };
      await center.registerPackage("app", "v2", exact);
      await center.registerPackage("app", "default", def);

      const result = await center.getPackage("app", "v2");
      expect(result.name).toBe("exact");
    });

    it("falls back to default version when exact not found", async () => {
      center.useDefaultVersion("default");
      const def = { name: "default" };
      await center.registerPackage("app", "default", def);

      const result = await center.getPackage("app", "v99");
      expect(result.name).toBe("default");
    });
  });

  describe("multi-package coexistence", () => {
    it("stores two different packages independently", async () => {
      const modA = { name: "pkg-a" };
      const modB = { name: "pkg-b" };
      await center.registerPackage("a", "v1", modA);
      await center.registerPackage("b", "v1", modB);

      const resultA = await center.getPackage("a", "v1");
      const resultB = await center.getPackage("b", "v1");

      expect(resultA.name).toBe("pkg-a");
      expect(resultB.name).toBe("pkg-b");
      expect(resultA).not.toBe(resultB);
    });

    it("stores two versions of same package as separate entries", async () => {
      const modV1 = { name: "v1" };
      const modV2 = { name: "v2" };
      await center.registerPackage("svc", "v1", modV1);
      await center.registerPackage("svc", "v2", modV2);

      const resultV1 = await center.getPackage("svc", "v1");
      const resultV2 = await center.getPackage("svc", "v2");

      expect(resultV1.name).toBe("v1");
      expect(resultV2.name).toBe("v2");
      expect(resultV1).not.toBe(resultV2);
    });

    it("version fallback correctly backfills both keys", async () => {
      center.useDefaultVersion("default");
      const def = { name: "default" };
      await center.registerPackage("app", "default", def);

      const result = await center.getPackage("app", "v99");

      const direct = await center.getPackage("app", "default");
      const backfill = await center.getPackage("app", "v99");

      expect(direct).toBe(def);
      expect(backfill).toBe(def);
      expect(direct).toBe(backfill);
    });

    it("changing namespace later does not affect previously loaded packages", async () => {
      center.useNamespace("ns-a");
      const modA = { name: "ns-a-mod" };
      await center.registerPackage("pkg", "v1", modA);

      center.useNamespace("ns-b");
      const modB = { name: "ns-b-mod" };
      await center.registerPackage("pkg", "v1", modB);

      center.useNamespace("ns-a");
      const resultA = await center.getPackage("pkg", "v1");
      expect(resultA.name).toBe("ns-a-mod");

      center.useNamespace("ns-b");
      const resultB = await center.getPackage("pkg", "v1");
      expect(resultB.name).toBe("ns-b-mod");
    });

    it("closing one package does not affect others", async () => {
      const modKeep = { name: "keep-me" };
      const modDrop = { name: "drop-me" };
      await center.registerPackage("keep", "v1", modKeep);
      await center.registerPackage("drop", "v1", modDrop);

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
