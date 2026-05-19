import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DynamicCenter, packageCenter as singleton } from "../src/package-center";
import { Tunnel } from "../src/tunnel";
import { MockTunnel } from "./test-helpers";

describe("DynamicCenter", () => {
  let center: DynamicCenter;

  beforeEach(() => {
    center = new DynamicCenter();
    // Reset singleton state between tests where used
  });

  describe("useNamespace / useDefaultVersion", () => {
    it("defaults to 'default' namespace and version", async () => {
      const m = new MockTunnel();
      await center.registerPackage("pkg", "v1", m);
      // Access via default namespace should work
      const t = await center.getTunnel("pkg", "v1");
      expect(t).toBe(m);
    });

    it("uses custom namespace", async () => {
      center.useNamespace("myorg");
      const m = new MockTunnel();
      await center.registerPackage("pkg", "v1", m);
      const t = await center.getTunnel("pkg", "v1");
      expect(t).toBe(m);
    });

    it("uses custom defaultVersion as fallback", async () => {
      center.useDefaultVersion("stable");
      const m = new MockTunnel();
      await center.registerPackage("pkg", "stable", m);

      // Request "latest" — should fallback to "stable"
      const t = await center.getTunnel("pkg", "latest");
      expect(t).toBe(m);
    });
  });

  describe("registerPackage", () => {
    it("registers and returns via getTunnel (Level 1 cache)", async () => {
      const m = new MockTunnel();
      await center.registerPackage("myapp", "v1", m);

      const t = await center.getTunnel("myapp", "v1");
      expect(t).toBe(m);
      expect(m.initCalled).toBe(true);
    });

    it("calls tunnel.init() during registration", async () => {
      const m = new MockTunnel();
      await center.registerPackage("app", "v2", m);
      // registerPackage → tunnelCenter.registerTunnel → tunnel.init()
      expect(m.initCalled).toBe(true);
    });
  });

  describe("getTunnel", () => {
    it("returns cached tunnel (Level 1 hit)", async () => {
      const m = new MockTunnel();
      await center.registerPackage("cached", "v1", m);

      // Second call should return cached instance without re-init
      m.reset();
      const t = await center.getTunnel("cached", "v1");
      expect(t).toBe(m);
      expect(m.initCalled).toBe(false); // not re-initialized from cache
    });

    it("throws when neither version found", async () => {
      await expect(
        center.getTunnel("nonexistent", "v999")
      ).rejects.toThrow("both provided version and default version not found");
    });
  });

  describe("closePackage", () => {
    it("closes and removes from Level 1 cache", async () => {
      const m = new MockTunnel();
      await center.registerPackage("temp", "v1", m);

      await center.closePackage("temp", "v1");
      expect(m.closeCalled).toBe(true);

      // Tunnel can still be retrieved from Level 2 (tunnelCenter)
      // Go has the same behavior — close only clears Level 1
      const t = await center.getTunnel("temp", "v1");
      expect(t).toBe(m);
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
      const exact = new MockTunnel("exact");
      const def = new MockTunnel("default");
      await center.registerPackage("app", "v2", exact);
      await center.registerPackage("app", "default", def);

      const t = await center.getTunnel("app", "v2");
      expect(t.meta()).toBe("exact");
    });

    it("falls back to default version when exact not found", async () => {
      center.useDefaultVersion("default");
      const def = new MockTunnel("default");
      await center.registerPackage("app", "default", def);

      const t = await center.getTunnel("app", "v99");
      expect(t.meta()).toBe("default");
    });
  });

  describe("multi-tunnel coexistence (cache level)", () => {
    it("Level 1 cache stores two different packages independently", async () => {
      const m1 = new MockTunnel("pkg-a");
      const m2 = new MockTunnel("pkg-b");
      await center.registerPackage("a", "v1", m1);
      await center.registerPackage("b", "v1", m2);

      const t1 = await center.getTunnel("a", "v1");
      const t2 = await center.getTunnel("b", "v1");

      expect(t1.meta()).toBe("pkg-a");
      expect(t2.meta()).toBe("pkg-b");
      expect(t1).not.toBe(t2);
    });

    it("Level 1 stores two versions of same package as separate entries", async () => {
      const m1 = new MockTunnel("v1");
      const m2 = new MockTunnel("v2");
      await center.registerPackage("svc", "v1", m1);
      await center.registerPackage("svc", "v2", m2);

      const t1 = await center.getTunnel("svc", "v1");
      const t2 = await center.getTunnel("svc", "v2");

      expect(t1.meta()).toBe("v1");
      expect(t2.meta()).toBe("v2");
      expect(t1).not.toBe(t2);
    });

    it("version fallback correctly backfills both keys", async () => {
      center.useDefaultVersion("default");
      const def = new MockTunnel("default");
      await center.registerPackage("app", "default", def);

      // Request a version that doesn't exist → fallback to default
      const t = await center.getTunnel("app", "v99");

      // Both "v99" and "default" should now be cached
      const direct = await center.getTunnel("app", "default");
      const backfill = await center.getTunnel("app", "v99");

      expect(direct).toBe(def);
      expect(backfill).toBe(def);
      expect(direct).toBe(backfill);
    });

    it("changing namespace later does not affect previously loaded tunnels", async () => {
      center.useNamespace("ns-a");
      const ma = new MockTunnel("ns-a-tunnel");
      await center.registerPackage("pkg", "v1", ma);

      // Switch namespace
      center.useNamespace("ns-b");
      const mb = new MockTunnel("ns-b-tunnel");
      await center.registerPackage("pkg", "v1", mb);

      // Both can be accessed — but currently only ns-b is the active namespace
      // ns-a tunnels still exist in cache, just not reachable via current namespace
      center.useNamespace("ns-a");
      const ta = await center.getTunnel("pkg", "v1");
      expect(ta.meta()).toBe("ns-a-tunnel");

      center.useNamespace("ns-b");
      const tb = await center.getTunnel("pkg", "v1");
      expect(tb.meta()).toBe("ns-b-tunnel");
    });
  });

  describe("singleton", () => {
    it("is a shared instance", () => {
      expect(singleton).toBeDefined();
    });
  });
});